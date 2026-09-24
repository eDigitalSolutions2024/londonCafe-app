// londoncafe-api/src/routes/giftcards.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

const GiftCard = require("../models/GiftCard");
const User = require("../models/User");
const { generateGiftCardCode } = require("../utils/giftCardCode");
const { requireAuth } = require("../middleware/auth.middleware");
const { creditBonus } = require("../utils/wallet");

// Helpers
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getMyEmail(req) {
  const payloadEmail = normalizeEmail(req.user?.email);
  if (payloadEmail) return payloadEmail;

  const uid = req.user?.uid;
  if (!uid) return "";
  const me = await User.findById(uid).select("email").lean();
  return normalizeEmail(me?.email);
}

// 1) Iniciar el cobro -- ANTES esto no existía: /purchase creaba la gift
// card directo en la DB sin cobrar nada (bug real: "no sale Stripe para
// cobrarla"). Mismo patrón que el Pase VIP (ver createVipPassSheet en
// payments.controller.js): el server arma el PaymentIntent, el cliente
// lo cobra con presentPaymentSheet, y SOLO si el pago se confirma (ver
// /purchase/confirm abajo, o el webhook de Stripe como red de respaldo)
// se crea la tarjeta de verdad.
router.post("/purchase/sheet", requireAuth, async (req, res) => {
  try {
    const fromUserId = req.user?.uid;
    if (!fromUserId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const { amount, toEmail, toUserId, message } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ ok: false, msg: "Monto inválido." });
    }

    let resolvedToUserId = null;
    let resolvedToEmail = null;

    if (toUserId) {
      const u = await User.findById(toUserId).select("_id email").lean();
      if (!u) return res.status(404).json({ ok: false, msg: "Usuario destino no encontrado." });
      resolvedToUserId = String(u._id);
      resolvedToEmail = normalizeEmail(u.email);
    } else if (toEmail) {
      resolvedToEmail = normalizeEmail(toEmail);
      if (!resolvedToEmail.includes("@")) {
        return res.status(400).json({ ok: false, msg: "Email inválido." });
      }
      const u = await User.findOne({ email: resolvedToEmail }).select("_id").lean();
      if (u) resolvedToUserId = String(u._id);
    } else {
      return res.status(400).json({ ok: false, msg: "Falta destinatario (toEmail o toUserId)." });
    }

    const me = await User.findById(fromUserId).select("email").lean();

    // El monto/destinatario/mensaje viajan en el metadata del PaymentIntent
    // (no en un registro propio todavía) -- así createGiftCardForPaymentIntent
    // tiene todo lo que necesita para crear la tarjeta sin depender de que
    // el cliente vuelva a mandar el mismo formulario en /purchase/confirm.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parsedAmount * 100),
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      receipt_email: me?.email || undefined,
      metadata: {
        source: "giftcard",
        fromUserId: String(fromUserId),
        toUserId: resolvedToUserId || "",
        toEmail: resolvedToEmail || "",
        message: String(message || "").slice(0, 480),
        amount: String(parsedAmount),
      },
    });

    return res.json({
      ok: true,
      paymentIntentClientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("giftcards /purchase/sheet:", err);
    return res.status(500).json({ ok: false, msg: "No se pudo iniciar el cobro." });
  }
});

// Crea la gift card de verdad a partir de un PaymentIntent ya cobrado --
// compartido entre /purchase/confirm (el cliente la llama justo después
// de presentPaymentSheet) y el webhook de Stripe (payment_intent.succeeded,
// ver handleStripeWebhook en payments.controller.js) como red de respaldo
// si la app se cierra/pierde red justo después del cobro. Idempotente por
// paymentIntentId -- un segundo intento encuentra la ya creada.
async function createGiftCardForPaymentIntent(pi) {
  const existing = await GiftCard.findOne({ paymentIntentId: pi.id });
  if (existing) return existing;

  const md = pi.metadata || {};
  const fromUserId = md.fromUserId;
  if (!fromUserId) return null;

  let code = generateGiftCardCode();
  for (let i = 0; i < 5; i++) {
    const exists = await GiftCard.findOne({ code }).select("_id").lean();
    if (!exists) break;
    code = generateGiftCardCode();
  }

  const gift = await GiftCard.create({
    code,
    amount: Number(md.amount) || +(pi.amount / 100).toFixed(2),
    currency: "MXN",
    fromUser: fromUserId,
    toUser: md.toUserId || null,
    toEmail: md.toEmail || null,
    message: md.message || "",
    status: "ACTIVE",
    paymentIntentId: pi.id,
  });
  return gift;
}

// 2) El cliente llama esto DESPUÉS de que presentPaymentSheet() confirma
// éxito -- mismo patrón que /vip-pass/confirm: se re-verifica con Stripe
// (nunca basta con que el cliente diga "ya pagué") antes de crear nada.
router.post("/purchase/confirm", requireAuth, async (req, res) => {
  try {
    const fromUserId = req.user?.uid;
    if (!fromUserId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ ok: false, msg: "Falta paymentIntentId." });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ ok: false, msg: "El pago no se completó." });
    }
    if (pi.metadata?.source !== "giftcard" || pi.metadata?.fromUserId !== String(fromUserId)) {
      return res.status(403).json({ ok: false, msg: "El pago no corresponde a esta cuenta." });
    }

    const gift = await createGiftCardForPaymentIntent(pi);
    if (!gift) return res.status(500).json({ ok: false, msg: "No se pudo crear la tarjeta." });

    return res.json({ ok: true, gift });
  } catch (err) {
    console.error("giftcards /purchase/confirm:", err);
    return res.status(500).json({ ok: false, msg: "Error al confirmar la gift card." });
  }
});

// 3) Mis giftcards (recibidas + enviadas)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const received = await GiftCard.find({
    $or: [{ toUser: userId }, { toEmail: normalizeEmail(req.user.email) }],
    })
    .sort({ createdAt: -1 })
    .populate("fromUser", "name username avatarConfig avatar3d")  // 👈 esto
    .lean();

    const sent = await GiftCard.find({ fromUser: userId })
    .sort({ createdAt: -1 })
    .populate("toUser", "name username avatarConfig avatar3d email") // opcional
    .lean();

    return res.json({ ok: true, received, sent });
  } catch (err) {
    console.error("giftcards /mine:", err);
    return res.status(500).json({ ok: false, msg: "Error al cargar gift cards." });
  }
});

// 4) Canjear por código
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const rawCode = String(req.body.code || "").trim().toUpperCase();
    if (!rawCode) return res.status(400).json({ ok: false, msg: "Falta el código." });

    const gift = await GiftCard.findOne({ code: rawCode });
    if (!gift) return res.status(404).json({ ok: false, msg: "Código no existe." });

    if (gift.status !== "ACTIVE") {
      return res.status(400).json({ ok: false, msg: "Esta tarjeta ya fue canjeada o cancelada." });
    }

    if (gift.expiresAt && new Date() > new Date(gift.expiresAt)) {
      return res.status(400).json({ ok: false, msg: "Esta tarjeta ya expiró." });
    }

    const myEmail = await getMyEmail(req);

    const isRecipient =
      (gift.toUser && String(gift.toUser) === String(userId)) ||
      (gift.toEmail && normalizeEmail(gift.toEmail) === normalizeEmail(myEmail));

    if (!isRecipient) {
      return res.status(403).json({ ok: false, msg: "Esta tarjeta no está asignada a tu cuenta." });
    }

    // Acredita el valor como Buddy Coins (1 peso de gift card = 1 Buddy Coin)
    // en Wallet V2, la ÚNICA fuente de saldo, y se usan en Ordena/Kiosk/POS igual
    // que cualquier otro saldo. Va ANTES de marcar la tarjeta como canjeada: si
    // el Wallet no responde, la tarjeta sigue vigente y se puede reintentar (la
    // clave GIFTCARD-<id> evita acreditar dos veces).
    try {
      await creditBonus(String(userId), {
        coins: Math.floor(Number(gift.amount) || 0),
        key: `GIFTCARD-${String(gift._id)}`,
        reason: `Tarjeta de regalo canjeada (${gift.code})`,
      });
    } catch (walletErr) {
      console.error("giftcards /redeem wallet:", walletErr?.message);
      return res.status(502).json({ ok: false, msg: "No se pudo acreditar tu saldo en este momento. Intenta de nuevo." });
    }

    gift.status = "REDEEMED";
    gift.redeemedAt = new Date();
    gift.redeemedBy = userId;
    await gift.save();

    return res.json({ ok: true, gift, credited: gift.amount });
  } catch (err) {
    console.error("giftcards /redeem:", err);
    return res.status(500).json({ ok: false, msg: "Error al canjear gift card." });
  }
});

module.exports = router;
module.exports.createGiftCardForPaymentIntent = createGiftCardForPaymentIntent;
