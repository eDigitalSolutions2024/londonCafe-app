const express = require("express");
const jwt = require("jsonwebtoken");

const Redemption = require("../models/Redemption");
const User = require("../models/User");

// ✅ Soporta AMBOS estilos de export:
// 1) module.exports = { requireAuth }
// 2) module.exports = requireAuth
const authMod = require("../middleware/auth.middleware");
const apiKeyMod = require("../middleware/apiKey.middleware");

const requireAuth = authMod.requireAuth || authMod;
const requireApiKey = apiKeyMod.requireApiKey || apiKeyMod;

if (typeof requireAuth !== "function") {
  throw new Error("❌ requireAuth NO es function. Revisa auth.middleware export.");
}
if (typeof requireApiKey !== "function") {
  throw new Error("❌ requireApiKey NO es function. Revisa apiKey.middleware export.");
}

const router = express.Router();

const QR_SECRET = process.env.REWARDS_QR_SECRET;

const COST = {
  coffee_free: 200,
  bread_free: 200,
};

router.get("/ping", (_req, res) => res.json({ ok: true, message: "rewards up" }));

// ✅ crear canje (genera token QR)
router.post("/redeem", requireAuth, async (req, res) => {
  try {
    // tu middleware deja: req.user = payload; // { uid: ... }
    const userId = req.user?.uid;

    const { rewardType } = req.body || {};

    if (!QR_SECRET) return res.status(500).json({ ok: false, message: "Falta REWARDS_QR_SECRET" });
    if (!userId) return res.status(401).json({ ok: false, message: "No auth (uid missing)" });
    if (!COST[rewardType]) return res.status(400).json({ ok: false, message: "rewardType inválido" });

    const costPoints = COST[rewardType];

    const u = await User.findById(userId);
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no existe" });

    if ((u.points || 0) < costPoints) {
      return res.status(400).json({ ok: false, message: "Puntos insuficientes" });
    }

    // expira en 10 min
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const redemption = await Redemption.create({
      userId,
      rewardType,
      costPoints,
      status: "created",
      expiresAt,
    });

    const token = jwt.sign(
      {
        redemptionId: redemption._id.toString(),
        userId: String(userId),
        rewardType,
        costPoints,
      },
      QR_SECRET,
      { expiresIn: "10m" }
    );

    return res.json({
      ok: true,
      token,
      redemptionId: redemption._id,
      expiresAt,
    });
  } catch (e) {
    console.log("❌ /rewards/redeem", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// ✅ consumir canje (solo POS con x-api-key)
router.post("/consume", requireApiKey, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, message: "Falta token" });
    if (!QR_SECRET) return res.status(500).json({ ok: false, message: "Falta REWARDS_QR_SECRET" });

    let payload;
    try {
      payload = jwt.verify(token, QR_SECRET);
    } catch {
      return res.status(400).json({ ok: false, message: "QR inválido o expirado" });
    }

    const { redemptionId, userId, costPoints, rewardType } = payload;

    const redemption = await Redemption.findById(redemptionId);
    if (!redemption) return res.status(404).json({ ok: false, message: "Canje no existe" });

    if (redemption.status === "consumed") {
      return res.status(409).json({ ok: false, message: "Este QR ya fue usado" });
    }

    if (redemption.expiresAt && redemption.expiresAt.getTime() < Date.now()) {
      redemption.status = "expired";
      await redemption.save();
      return res.status(400).json({ ok: false, message: "QR expirado" });
    }

    // seguridad extra
    if (String(redemption.userId) !== String(userId) || redemption.rewardType !== rewardType) {
      return res.status(400).json({ ok: false, message: "QR no coincide" });
    }

    const u = await User.findById(userId);
    if (!u) return res.status(404).json({ ok: false, message: "Usuario no existe" });

    if ((u.points || 0) < costPoints) {
      return res.status(400).json({ ok: false, message: "Puntos insuficientes" });
    }

    // descuenta puntos + marca consumido
    u.points = (u.points || 0) - costPoints;
    await u.save();

    redemption.status = "consumed";
    redemption.consumedAt = new Date();
    redemption.consumedBy = "POS";
    await redemption.save();

    return res.json({
      ok: true,
      message: "Canje aplicado",
      rewardType,
      costPoints,
      remainingPoints: u.points,
    });
  } catch (e) {
    console.log("❌ /rewards/consume", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
