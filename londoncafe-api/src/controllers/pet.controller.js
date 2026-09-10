// src/controllers/pet.controller.js
const User = require("../models/User");
const { isUserVIP } = require("./me.controller");

// Mismo patrón de decaimiento por tiempo real que applyEnergyDecay() en
// buddy.controller.js -- hunger baja cada N minutos, happiness baja con
// ella (más rápido si hunger llega a 0).
const HUNGER_DECAY_EVERY_MIN = 30;
const HUNGER_DECAY_AMOUNT = 3;
const HAPPINESS_DECAY_AMOUNT = 2;
const HAPPINESS_DECAY_AMOUNT_HUNGRY = 5;

const FEED_HUNGER_RESTORE = 40;
const FEED_HAPPINESS_RESTORE = 15;
const FEED_COOLDOWN_MIN = 20;

const SPECIES = new Set(["cat", "dog", "hamster"]);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function moodFromPet(pet) {
  if (!pet?.owned) return null;
  const hunger = Number(pet.hunger ?? 100);
  const happiness = Number(pet.happiness ?? 100);
  if (hunger <= 0) return "hungry";
  if (happiness >= 70 && hunger >= 60) return "happy";
  if (happiness >= 40) return "meh";
  return "sad";
}

function applyPetDecay(user, now = new Date()) {
  if (!user.pet?.owned) return;

  const last = user.pet.lastStatsAt ? new Date(user.pet.lastStatsAt) : now;
  const diffMin = Math.floor((now.getTime() - last.getTime()) / (1000 * 60));
  if (diffMin < HUNGER_DECAY_EVERY_MIN) return;

  const steps = Math.floor(diffMin / HUNGER_DECAY_EVERY_MIN);
  const prevHunger = Number(user.pet.hunger ?? 100);

  user.pet.hunger = clamp(prevHunger - steps * HUNGER_DECAY_AMOUNT, 0, 100);

  const happinessAmount = prevHunger <= 0 ? HAPPINESS_DECAY_AMOUNT_HUNGRY : HAPPINESS_DECAY_AMOUNT;
  user.pet.happiness = clamp(Number(user.pet.happiness ?? 100) - steps * happinessAmount, 0, 100);

  user.pet.lastStatsAt = new Date(last.getTime() + steps * HUNGER_DECAY_EVERY_MIN * 60 * 1000);
}

// GET /pet
async function getPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const now = new Date();
    applyPetDecay(user, now);
    user.markModified("pet");
    await user.save();

    const vip = await isUserVIP(uid);

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet), isVIP: vip });
  } catch (err) {
    console.error("getPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/adopt  body: { species, name }
async function adoptPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const { species, name } = req.body || {};
    if (!SPECIES.has(species)) {
      return res.status(400).json({ ok: false, error: "INVALID_SPECIES" });
    }
    const cleanName = typeof name === "string" ? name.trim().slice(0, 20) : "";
    if (!cleanName) {
      return res.status(400).json({ ok: false, error: "MISSING_NAME" });
    }

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    if (user.pet?.owned) {
      return res.status(400).json({ ok: false, error: "ALREADY_OWNED" });
    }

    const vip = await isUserVIP(uid);
    if (!vip) return res.status(403).json({ ok: false, error: "VIP_REQUIRED" });

    const now = new Date();
    user.pet = {
      owned: true,
      species,
      name: cleanName,
      hunger: 100,
      happiness: 100,
      lastStatsAt: now,
      lastFedAt: null,
      adoptedAt: now,
    };
    user.markModified("pet");
    await user.save();

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet) });
  } catch (err) {
    console.error("adoptPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/feed
async function feedPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);

    const lastFed = user.pet.lastFedAt ? new Date(user.pet.lastFedAt) : null;
    if (lastFed) {
      const minsSince = Math.floor((now.getTime() - lastFed.getTime()) / (1000 * 60));
      if (minsSince < FEED_COOLDOWN_MIN) {
        return res.status(429).json({
          ok: false,
          error: "FEED_COOLDOWN",
          secondsLeft: (FEED_COOLDOWN_MIN - minsSince) * 60,
        });
      }
    }

    user.pet.hunger = clamp(Number(user.pet.hunger ?? 0) + FEED_HUNGER_RESTORE, 0, 100);
    user.pet.happiness = clamp(Number(user.pet.happiness ?? 0) + FEED_HAPPINESS_RESTORE, 0, 100);
    user.pet.lastFedAt = now;

    user.markModified("pet");
    await user.save();

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet) });
  } catch (err) {
    console.error("feedPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { getPet, adoptPet, feedPet };
