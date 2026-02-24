// src/controllers/payments.controller.js
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/**
 * ✅ Recibe [{ _id, qty }]
 * ✅ Consulta precios en DB (NO confiar en cliente)
 * ✅ Devuelve amount en centavos (integer)
 */
async function calcOrderAmountFromDB(items = []) {
  const map = new Map(); // id -> qty
  for (const it of items) {
    const id = String(it?._id || "").trim();
    if (!id) continue;

    const qty = Math.max(1, Math.min(99, Number(it?.qty) || 1));
    map.set(id, (map.get(id) || 0) + qty);
  }

  const ids = Array.from(map.keys());
  if (ids.length === 0) return 0;

  // ✅ TODO: Conecta tu modelo real.
  // Ejemplo:
  // const MenuItem = require("../models/MenuItem");
  // const docs = await MenuItem.find({ _id: { $in: ids }, active: true }).lean();

  throw new Error("DB_PRICING_NOT_CONNECTED");

  // const byId = new Map(docs.map(d => [String(d._id), d]));
  // let total = 0;
  // for (const id of ids) {
  //   const doc = byId.get(id);
  //   if (!doc) throw new Error(`ITEM_NOT_FOUND:${id}`);
  //   const unit = Number(doc.price) || 0;
  //   const qty = map.get(id) || 0;
  //   total += unit * qty;
  // }
  // return Math.round(total * 100);
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
    });
  } catch (e) {
    console.log("❌ createPaymentSheet:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PAYMENT_INTENT_FAILED" });
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