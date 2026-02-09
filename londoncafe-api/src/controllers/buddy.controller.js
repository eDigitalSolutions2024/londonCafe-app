const User = require("../models/User");

// Ajustes
const ENERGY_DECAY_EVERY_MIN = 30;
const ENERGY_DECAY_AMOUNT = 1;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ensureBuddy(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  if (typeof user.buddy.energy !== "number") user.buddy.energy = 80;
  if (typeof user.buddy.coffee !== "number") user.buddy.coffee = 0;
  if (typeof user.buddy.bread !== "number") user.buddy.bread = 0;

  if (!user.buddy.lastEnergyAt) user.buddy.lastEnergyAt = now;
  if (user.buddy.lastLoginAt === undefined) user.buddy.lastLoginAt = null;
  if (user.buddy.lastRefillAt === undefined) user.buddy.lastRefillAt = null;
}

function applyEnergyDecay(user, now = new Date()) {
  ensureBuddy(user, now);

  const last = new Date(user.buddy.lastEnergyAt || now);
  const diffMin = Math.floor((now.getTime() - last.getTime()) / (1000 * 60));

  if (diffMin < ENERGY_DECAY_EVERY_MIN) return;

  const steps = Math.floor(diffMin / ENERGY_DECAY_EVERY_MIN);
  user.buddy.energy = clamp(user.buddy.energy - steps * ENERGY_DECAY_AMOUNT, 0, 100);

  user.buddy.lastEnergyAt = new Date(
    last.getTime() + steps * ENERGY_DECAY_EVERY_MIN * 60 * 1000
  );
}

// POST /buddy/feed
async function feedBuddy(req, res) {
  try {
    const { type } = req.body || {};
    if (!["coffee", "bread"].includes(type)) {
      return res.status(400).json({ ok: false, error: "INVALID_TYPE" });
    }

    const user = await User.findById(req.user.uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const now = new Date();
    applyEnergyDecay(user, now);
    ensureBuddy(user, now);

    if (type === "coffee") {
      if ((user.buddy.coffee ?? 0) <= 0) {
        return res.status(400).json({ ok: false, error: "NO_COFFEE" });
      }
      user.buddy.coffee -= 1;
      user.buddy.energy = clamp(user.buddy.energy + 40, 0, 100);
    } else {
      if ((user.buddy.bread ?? 0) <= 0) {
        return res.status(400).json({ ok: false, error: "NO_BREAD" });
      }
      user.buddy.bread -= 1;
      user.buddy.energy = clamp(user.buddy.energy + 40, 0, 100);
    }

    await user.save();

    return res.json({ ok: true, buddy: user.buddy });
  } catch (err) {
    console.error("feedBuddy ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { feedBuddy };
