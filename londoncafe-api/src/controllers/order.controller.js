const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";

// ajusta la ruta si está en otra carpeta
const { redeemOrder, earnOrder } = require("../utils/wallet");

async function createOrderFromApp(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const {
      source,
      paymentIntentId,
      total,
      currency,
      items,
      customerName,
      name,
      nombre,
      customer,
      generalNotes,
      customerPhone,
    } = req.body || {};

    const finalCustomerName = String(
      customerName ||
      name ||
      nombre ||
      customer?.name ||
      customer?.fullName ||
      ""
    ).trim();

    if (!paymentIntentId) {
      return res.status(400).json({ ok: false, error: "PAYMENT_INTENT_ID_REQUIRED" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "ITEMS_REQUIRED" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ ok: false, error: "PAYMENT_INTENT_NOT_FOUND" });
    }

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        ok: false,
        error: "PAYMENT_NOT_CONFIRMED",
        paymentStatus: paymentIntent.status,
      });
    }

    // ⚠️ Antes no se revisaba NADA de esto -- cualquier paymentIntentId
    // "succeeded" (de cualquier persona, o incluso de otro flujo como el
    // Pase VIP o una gift card) servía para crear una orden y cobrar
    // Buddy Coins a la cuenta que el body dijera. Ahora se exige que el
    // PaymentIntent haya sido creado por ESTE flujo (source:
    // "londoncafe-app", ver createPaymentSheet en payments.controller.js)
    // Y para ESTE usuario autenticado.
    if (paymentIntent.metadata?.source !== "londoncafe-app" || paymentIntent.metadata?.userId !== String(uid)) {
      return res.status(403).json({ ok: false, error: "PAYMENT_MISMATCH" });
    }

    // Total REAL cobrado (Stripe, en centavos) -- ya no el que mandara el
    // cliente. El `total` del body se ignora para todo lo que importa
    // (registro de la orden y cálculo de Buddy Coins); antes ambos venían
    // de ahí sin verificar nada, así que cualquiera podía inflar el total
    // reportado para farmear puntos sin pagar más.
    const verifiedTotal = +(paymentIntent.amount / 100).toFixed(2);

    const orderPayload = {
  source: source || "app",
  paymentIntentId,
  paymentStatus: paymentIntent.status === "succeeded" ? "paid" : "pending",
  total: verifiedTotal,
  currency: currency || "mxn",
  customerName: finalCustomerName,
  customerPhone: customerPhone || "",
  generalNotes: generalNotes || "",
  userId: uid,
  status: "pending",
  createdAt: new Date().toISOString(),
  items: items.map((it) => ({
    productId: it.productId,
    title: it.title,
    imageUrl: it.imageUrl || "",
    qty: Number(it.qty || 0),
    unitPrice: Number(it.unitPrice || 0),
    lineTotal: Number(it.lineTotal || 0),
    categorySnapshot: it.categorySnapshot || "General",
    selectedOptions: it.selectedOptions || {},
    notes: it.notes || "",
  })),
};

    console.log("[FROM-APP] POS_URL:", POS_URL);
    console.log("[FROM-APP] finalCustomerName:", finalCustomerName);
    console.log("[FROM-APP] orderPayload:", JSON.stringify(orderPayload, null, 2));

    const posRes = await fetch(`${POS_URL}/orders/online`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const posText = await posRes.text();
    let posData = {};
    try {
      posData = posText ? JSON.parse(posText) : {};
    } catch {
      posData = { raw: posText };
    }

    console.log("[FROM-APP] pos status:", posRes.status);
    console.log("[FROM-APP] pos data:", posData);

    if (!posRes.ok) {
      return res.status(502).json({
        ok: false,
        error: "POS_ORDER_CREATE_FAILED",
        posStatus: posRes.status,
        posData,
      });
    }

    // =========================
    // BUDDYCOINS AL PAGAR -- SOLO Wallet V2 (abono sobre lo realmente cobrado y
    // canje si se usaron Buddy Coins -- ver buddyCoinsApplied en el metadata,
    // reservado en createPaymentSheet pero nunca descontado hasta que el pago
    // se confirma aquí).
    // =========================
    let buddyCoinsAwarded = 0;
    let buddyCoinsRedeemed = 0;

    // Wallet V2 es la ÚNICA fuente de BuddyCoins. Canje y abono se asientan con
    // el id de la orden del POS (posData.order._id): es la misma clave que usa
    // el POS al entregar (EARN:ORDER:<id>), así que si después se marca
    // entregada, no se abona dos veces; y un reintento de esta llamada tampoco
    // duplica nada (ambos endpoints son idempotentes por orden).
    try {
      const posOrderId = String(posData?.order?._id || "");
      if (!posOrderId) {
        console.error("[FROM-APP] el POS no devolvió el id de la orden; no se pudo asentar BuddyCoins", posData);
      } else {
        const requestedCoins = Math.max(0, Math.floor(Number(paymentIntent.metadata?.buddyCoinsApplied) || 0));
        if (requestedCoins > 0) {
          // Subtotal sobre el que se calculó el tope al crear el PaymentIntent
          // (monto después del cupón, antes de los coins).
          const baseCents =
            Number(paymentIntent.metadata?.buddyBaseCents) ||
            paymentIntent.amount + Math.round(Number(paymentIntent.metadata?.buddyDiscountCents) || 0);
          const redeemed = await redeemOrder(String(uid), {
            orderId: posOrderId,
            requestedCoins,
            subtotalInPesos: +(baseCents / 100).toFixed(2),
          });
          buddyCoinsRedeemed = redeemed.appliedCoins;
        }

        // Abono sobre lo realmente cobrado por Stripe (ya sin coins ni cupón).
        const earned = await earnOrder(String(uid), { orderId: posOrderId, paidInPesos: verifiedTotal });
        buddyCoinsAwarded = earned.earnedCoins;
      }
    } catch (loyaltyError) {
      console.error("[FROM-APP] buddycoins error:", loyaltyError);
    }


    return res.status(201).json({
      ok: true,
      message: "ORDER_CREATED",
      order: posData,
      buddyCoinsAwarded,
      buddyCoinsRedeemed,
    });
  } catch (error) {
    console.error("createOrderFromApp error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "INTERNAL_ERROR",
    });
  }
}

async function getMyOrders(req, res) {
  try {
    // Antes confiaba en :userId de la URL -- cualquiera podía leer el
    // historial de pedidos de cualquier otra cuenta con solo cambiar el
    // id. Ahora siempre es la cuenta autenticada, el param de la URL ya
    // no se usa (se deja en la ruta por compatibilidad con el cliente,
    // que igual sigue mandándolo).
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "BAD_TOKEN",
      });
    }

    console.log("[GET MY ORDERS] userId:", userId);

    const posRes = await fetch(`${POS_URL}/orders/my/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const posText = await posRes.text();
    let posData = {};

    try {
      posData = posText ? JSON.parse(posText) : {};
    } catch {
      posData = { raw: posText };
    }

    console.log("[GET MY ORDERS] pos status:", posRes.status);
    console.log("[GET MY ORDERS] pos data:", posData);

    if (!posRes.ok) {
      return res.status(502).json({
        ok: false,
        error: "POS_FETCH_ORDERS_FAILED",
        posStatus: posRes.status,
        posData,
      });
    }

    return res.json({
      ok: true,
      orders: Array.isArray(posData?.orders)
        ? posData.orders
        : Array.isArray(posData)
        ? posData
        : [],
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "INTERNAL_ERROR",
    });
  }
}

module.exports = {
  createOrderFromApp,
   getMyOrders,
};