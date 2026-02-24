/*// src/controllers/payments.controller.js
const Stripe = require("stripe");
// const MenuItem = require("../models/MenuItem"); // <-- AJUSTA ESTO a tu modelo real
// Ej: const Menu = require("../models/Menu"); o Product, etc.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * ✅ Recibe [{ _id, qty }]
 * ✅ Consulta precios en DB (NO confiar en cliente)
 * ✅ Devuelve amount en centavos (integer)
 
async function calcOrderAmountFromDB(items = []) {
  // 1) normaliza / consolida
  const map = new Map(); // id -> qty
  for (const it of items) {
    const id = String(it?._id || "").trim();
    if (!id) continue;

    const qty = Math.max(1, Math.min(99, Number(it?.qty) || 1));
    map.set(id, (map.get(id) || 0) + qty);
  }

  const ids = Array.from(map.keys());
  if (ids.length === 0) return 0;

  // 2) consulta en DB (AJUSTA A TU MODELO/CAMPOS)
  // Ejemplo esperado de doc: { _id, title, price, active }
  // const docs = await MenuItem.find({ _id: { $in: ids }, active: true }).lean();

  // ⚠️ TEMPORAL si aún no conectas el modelo:
  // Lanza error para que no se te vaya a producción con precio del cliente
  throw new Error("DB_PRICING_NOT_CONNECTED");

  // 3) calcular total
  /*
  const byId = new Map(docs.map(d => [String(d._id), d]));

  let total = 0;
  for (const id of ids) {
    const doc = byId.get(id);
    if (!doc) {
      // si no existe o está inactivo
      throw new Error(`ITEM_NOT_FOUND:${id}`);
    }
    const unit = Number(doc.price) || 0;
    const qty = map.get(id) || 0;
    total += unit * qty;
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
      // Errores controlados
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
        // orderId: "..." // luego lo agregamos
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
      req.body, // <-- raw Buffer
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
      console.log("✅ payment_intent.succeeded:", pi.id);

      // TODO: marcar orden pagada
      // const orderId = pi.metadata?.orderId;
      // if (orderId) ...
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      console.log("⚠️ payment_intent.payment_failed:", pi.id);
    }

    return res.json({ received: true }); // 2xx OK
  } catch (e) {
    console.log("❌ webhook handler error:", e?.message || e);
    return res.status(500).json({ error: "WEBHOOK_FAILED" });
  }
};*/