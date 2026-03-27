const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";

// ajusta la ruta si está en otra carpeta
const User = require("../models/User");

async function createOrderFromApp(req, res) {
  try {
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
      userId, // 👈 nuevo
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

    const orderPayload = {
  source: source || "app",
  paymentIntentId,
  paymentStatus: paymentIntent.status === "succeeded" ? "paid" : "pending",
  total: Number(total || 0),
  currency: currency || "mxn",
  customerName: finalCustomerName,
  customerPhone: customerPhone || "",
  generalNotes: generalNotes || "",
  userId: userId || null, // 👈 nuevo
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
    // BUDDYCOINS AL PAGAR
    // =========================
    let buddyCoinsAwarded = 0;

try {
  const userId = req.user?._id || req.user?.id || req.body.userId || null;

  console.log("============== DEBUG BUDDY ==============");
  console.log("req.user:", req.user);
  console.log("userId:", userId);
  console.log("=========================================");

  if (userId) {
    const user = await User.findById(userId);

    if (user) {
      const orderTotal = Number(total || 0);
      const pointsToAward = Math.floor(orderTotal / 10);

      const alreadyAwarded = (user.pointsHistory || []).some(
        (entry) =>
          entry?.type === "EARN" &&
          String(entry?.ref || "") === String(paymentIntentId)
      );

      if (!alreadyAwarded && pointsToAward > 0) {
        user.points = Number(user.points || 0) + pointsToAward;
        user.lifetimePoints = Number(user.lifetimePoints || 0) + pointsToAward;

        user.pointsHistory.push({
          type: "EARN",
          points: pointsToAward,
          source: "APP_ORDER",
          ref: paymentIntentId,
          note: `Compra pagada en app por ${orderTotal} MXN`,
          createdAt: new Date(),
        });

        await user.save();
        buddyCoinsAwarded = pointsToAward;
      }
    }
  }
} catch (loyaltyError) {
  console.error("[FROM-APP] buddycoins error:", loyaltyError);
}

    return res.status(201).json({
      ok: true,
      message: "ORDER_CREATED",
      order: posData,
      buddyCoinsAwarded,
    });
  } catch (error) {
    console.error("createOrderFromApp error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "INTERNAL_ERROR",
    });
  }
}

module.exports = {
  createOrderFromApp,
};