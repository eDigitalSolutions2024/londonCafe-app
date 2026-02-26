// londoncafe-api/src/routes/giftcards.js
const express = require("express");
const router = express.Router();

const GiftCard = require("../models/GiftCard");
const User = require("../models/User");
const { generateGiftCardCode } = require("../utils/giftCardCode");
const { requireAuth } = require("../middleware/auth.middleware");

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

// 1) Comprar / enviar giftcard
router.post("/purchase", requireAuth, async (req, res) => {
  try {
    const fromUserId = req.user?.uid;
    if (!fromUserId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const { amount, toEmail, toUserId, message } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ ok: false, msg: "Monto inválido." });
    }

    let resolvedToUser = null;
    let resolvedToEmail = null;

    if (toUserId) {
      resolvedToUser = await User.findById(toUserId).select("_id email").lean();
      if (!resolvedToUser) {
        return res.status(404).json({ ok: false, msg: "Usuario destino no encontrado." });
      }
      resolvedToEmail = normalizeEmail(resolvedToUser.email);
    } else if (toEmail) {
      resolvedToEmail = normalizeEmail(toEmail);
      if (!resolvedToEmail.includes("@")) {
        return res.status(400).json({ ok: false, msg: "Email inválido." });
      }
      resolvedToUser = await User.findOne({ email: resolvedToEmail }).select("_id email").lean();
    } else {
      return res.status(400).json({ ok: false, msg: "Falta destinatario (toEmail o toUserId)." });
    }

    // código único
    let code = generateGiftCardCode();
    for (let i = 0; i < 5; i++) {
      const exists = await GiftCard.findOne({ code }).select("_id").lean();
      if (!exists) break;
      code = generateGiftCardCode();
    }

    const gift = await GiftCard.create({
      code,
      amount: parsedAmount,
      currency: "MXN",
      fromUser: fromUserId,
      toUser: resolvedToUser ? resolvedToUser._id : null,
      toEmail: resolvedToEmail,
      message: message || "",
      status: "ACTIVE",
    });

    return res.json({ ok: true, gift });
  } catch (err) {
    console.error("giftcards /purchase:", err);
    return res.status(500).json({ ok: false, msg: "Error al crear gift card." });
  }
});

// 2) Mis giftcards (recibidas + enviadas)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, msg: "NO_TOKEN" });

    const myEmail = await getMyEmail(req);

    const received = await GiftCard.find({
    $or: [{ toUser: userId }, { toEmail: normalizeEmail(req.user.email) }],
    })
    .sort({ createdAt: -1 })
    .populate("fromUser", "name username avatarConfig")  // 👈 esto
    .lean();

    const sent = await GiftCard.find({ fromUser: userId })
    .sort({ createdAt: -1 })
    .populate("toUser", "name username avatarConfig email") // opcional
    .lean();

    return res.json({ ok: true, received, sent });
  } catch (err) {
    console.error("giftcards /mine:", err);
    return res.status(500).json({ ok: false, msg: "Error al cargar gift cards." });
  }
});

// 3) Canjear por código
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