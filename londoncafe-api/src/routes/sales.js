const express = require("express");
const Sale = require("../models/Sale");
const PointsHistory = require("../models/PointsHistory");
const User = require("../models/User"); // usa tu modelo actual de usuario
const posAuth = require("../middleware/posAuth");

const router = express.Router();

router.post("/from-pos", posAuth, async (req, res) => {
  try {
    const { saleId, userId, total, currency, itemsCount, paidAt, branch } = req.body;

    if (!saleId || !userId || typeof total !== "number" || !paidAt) {
      return res.status(400).json({ ok: false, message: "Missing/invalid fields" });
    }

    // idempotencia: si ya llegó esa venta, no duplicar puntos
    const existing = await Sale.findOne({ saleId });
    if (existing) {
      return res.json({ ok: true, message: "Sale already synced", saleId, pointsAdded: 0 });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    const pointsPerMxn = Number(process.env.POINTS_PER_MXN || 10);
    const points = Math.floor(total / pointsPerMxn);

    await Sale.create({
      saleId,
      userId,
      total,
      currency: currency || "MXN",
      itemsCount: itemsCount || 0,
      paidAt: new Date(paidAt),
      branch: branch || "LondonCafe-JRZ",
      source: "POS",
    });

    user.points = (user.points || 0) + points;
    await user.save();

    await PointsHistory.create({ userId, saleId, points, type: "earn" });

    return res.json({
      ok: true,
      message: "Sale synced",
      saleId,
      pointsAdded: points,
      totalUserPoints: user.points,
    });
  } catch (err) {
    // duplicado por carrera (dos requests casi al mismo tiempo)
    if (err && err.code === 11000) {
      return res.json({ ok: true, message: "Sale already synced (dup key)", pointsAdded: 0 });
    }
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
