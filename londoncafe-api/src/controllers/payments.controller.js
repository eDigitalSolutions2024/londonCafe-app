// src/controllers/payments.controller.js
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const AppMenuItem = require("../models/AppMenuItem");
const User = require("../models/User");

/**
 * ✅ Recibe [{ _id, qty }]
 * ✅ Consulta precios en DB (NO confiar en cliente)
 * ✅ Devuelve amount en centavos (integer)
 */
async function calcOrderAmountFromDB(items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];

  const ids = [
    ...new Set(
      normalizedItems
        .map((it) => String(it?._id || "").trim())
        .filter(Boolean)
    ),
  ];

  if (ids.length === 0) return 0;

  const docs = await AppMenuItem.find({
    _id: { $in: ids },
    active: true,
  }).lean();

  const byId = new Map(docs.map((d) => [String(d._id), d]));

  function normalizeChoiceLabel(choice) {
    if (!choice) return "";
    if (typeof choice === "string") return choice.trim();
    return String(choice.label || "").trim();
  }

  function getExtraFromOptionGroup(group, selectedValue) {
    if (!group?.enabled) return 0;

    const selectedLabel = normalizeChoiceLabel(selectedValue);
    if (!selectedLabel) return 0;

    const found = Array.isArray(group.choices)
      ? group.choices.find((c) => normalizeChoiceLabel(c).toLowerCase() === selectedLabel.toLowerCase())
      : null;

    if (!found) return 0;

    if (typeof found === "string") return 0;

    return Number(found.extraPrice || 0);
  }

  function getFlavorsExtra(group, selectedFlavors) {
    if (!group?.enabled) return 0;
    if (!Array.isArray(selectedFlavors) || selectedFlavors.length === 0) return 0;

    let total = 0;

    for (const flavor of selectedFlavors) {
      const selectedLabel = normalizeChoiceLabel(flavor);
      if (!selectedLabel) continue;

      const found = Array.isArray(group.choices)
        ? group.choices.find((c) => normalizeChoiceLabel(c).toLowerCase() === selectedLabel.toLowerCase())
        : null;

      if (!found) continue;

      if (typeof found === "string") continue;

      total += Number(found.extraPrice || 0);
    }

    return total;
  }

  let total = 0;

  for (const it of normalizedItems) {
    const id = String(it?._id || "").trim();
    if (!id) continue;

    const doc = byId.get(id);
    if (!doc) throw new Error(`ITEM_NOT_FOUND:${id}`);

    const qty = Math.max(1, Math.min(99, Number(it?.qty) || 1));
    const basePrice = Number(doc.price) || 0;

    const selectedOptions = it?.selectedOptions || {};

    const milkExtra = getExtraFromOptionGroup(doc?.options?.milk, selectedOptions.milk);
    const tempExtra = getExtraFromOptionGroup(doc?.options?.temp, selectedOptions.temp);
    const flavorsExtra = getFlavorsExtra(doc?.options?.flavors, selectedOptions.flavors);

    const unitTotal = basePrice + milkExtra + tempExtra + flavorsExtra;

    total += unitTotal * qty;
  }

  return Math.round(total * 100);
}

exports.createPaymentSheet = async (req, res) => {
  try {
    const { items, customerEmail } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "CART_EMPTY" });
    }

    let amount;
    try {
      amount = await calcOrderAmountFromDB(items);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.startsWith("ITEM_NOT_FOUND:")) {
        return res.status(400).json({ ok: false, error: "ITEM_NOT_FOUND" });
      }
      if (msg === "DB_PRICING_NOT_CONNECTED") {
        return res.status(500).json({ ok: false, error: "DB_PRICING_NOT_CONNECTED" });
      }
      throw e;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail || undefined,
      metadata: {
        source: "londoncafe-app",
        userId: req.user?.id ? String(req.user.id) : "",
      },
    });

    return res.json({
  ok: true,
  paymentIntentClientSecret: paymentIntent.client_secret,
  paymentIntentId: paymentIntent.id,
});
  } catch (e) {
    console.log("❌ createPaymentSheet:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PAYMENT_INTENT_FAILED" });
  }
};

// ✅ Tienda -- Pase VIP. $49 normal, $19 como promo de lanzamiento durante
// el 2do mes de la cuenta (el 1er mes ya es VIP gratis solo, ver
// isUserVIP en me.controller.js -- no tendría sentido cobrarles ahí).
const VIP_PASS_PRICE_NORMAL_CENTS = 4900;
const VIP_PASS_PRICE_LAUNCH_CENTS = 1900;
const VIP_PASS_DURATION_DAYS = 30;

function vipPassPriceForUser(createdAt) {
  const ageDays = createdAt ? (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  const isSecondMonth = ageDays >= 30 && ageDays < 60;
  return isSecondMonth ? VIP_PASS_PRICE_LAUNCH_CENTS : VIP_PASS_PRICE_NORMAL_CENTS;
}

// ✅ GET -- para que la pantalla de Tienda muestre el precio correcto
// (normal vs promo del 2do mes) y si ya tiene un pase activo ANTES de
// arrancar el flujo de pago.
exports.getVipPassStatus = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid).select("createdAt vipPass");
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const active = !!(user.vipPass?.active && user.vipPass.expiresAt && new Date(user.vipPass.expiresAt) > new Date());
    const priceCents = vipPassPriceForUser(user.createdAt);
    const isLaunchPromo = priceCents === VIP_PASS_PRICE_LAUNCH_CENTS;

    return res.json({
      ok: true,
      active,
      expiresAt: user.vipPass?.expiresAt || null,
      priceCents,
      normalPriceCents: VIP_PASS_PRICE_NORMAL_CENTS,
      isLaunchPromo,
    });
  } catch (e) {
    console.log("❌ getVipPassStatus:", e?.message || e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
};

exports.createVipPassSheet = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid).select("createdAt email vipPass");
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    if (user.vipPass?.active && user.vipPass.expiresAt && new Date(user.vipPass.expiresAt) > new Date()) {
      return res.status(400).json({ ok: false, error: "ALREADY_ACTIVE" });
    }

    const amount = vipPassPriceForUser(user.createdAt);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email || undefined,
      metadata: { source: "vip-pass", userId: String(uid) },
    });

    return res.json({
      ok: true,
      paymentIntentClientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
    });
  } catch (e) {
    console.log("❌ createVipPassSheet:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PAYMENT_INTENT_FAILED" });
  }
};

// ✅ El cliente llama esto DESPUÉS de que presentPaymentSheet() confirma
// éxito (mismo patrón que el checkout del carrito en CartScreen.jsx) --
// pero acá SÍ se re-verifica con Stripe antes de activar nada (no basta
// con que el cliente diga "ya pagué"): se recupera el PaymentIntent real,
// se checa que su status sea "succeeded" y que el metadata (source +
// userId) coincida con quien está pidiendo el pase, así nadie activa VIP
// con el paymentIntentId de otra persona.
exports.confirmVipPass = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ ok: false, error: "MISSING_PAYMENT_INTENT" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    // Reintento del mismo pago (ej. la app se cerró justo después de
    // presentPaymentSheet) -- ya se procesó, responde ok sin duplicar.
    if (user.vipPass?.lastPaymentIntentId === paymentIntentId && user.vipPass?.active) {
      return res.json({ ok: true, vipPass: user.vipPass });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ ok: false, error: "PAYMENT_NOT_COMPLETED" });
    }
    if (pi.metadata?.source !== "vip-pass" || pi.metadata?.userId !== String(uid)) {
      return res.status(403).json({ ok: false, error: "PAYMENT_MISMATCH" });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + VIP_PASS_DURATION_DAYS * 24 * 60 * 60 * 1000);
    user.vipPass = { active: true, purchasedAt: now, expiresAt, lastPaymentIntentId: paymentIntentId };
    await user.save();

    return res.json({ ok: true, vipPass: user.vipPass });
  } catch (e) {
    console.log("❌ confirmVipPass:", e?.message || e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // ✅ raw buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      console.log("✅ payment_intent.succeeded:", pi.id, pi.metadata);
      // TODO: marcar orden pagada en DB usando pi.metadata.orderId
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      console.log("⚠️ payment_intent.payment_failed:", pi.id, pi.last_payment_error?.message);
    }

    return res.json({ received: true });
  } catch (e) {
    console.log("❌ webhook handler error:", e?.message || e);
    return res.status(500).json({ error: "WEBHOOK_FAILED" });
  }
};