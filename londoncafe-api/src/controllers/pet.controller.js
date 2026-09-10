// src/controllers/pet.controller.js
const User = require("../models/User");
const { isUserVIP } = require("./me.controller");
const { applyDailyRefillOnAppOpen } = require("../utils/buddy");

// --- Decaimiento por tiempo real (mismo patrón que applyEnergyDecay de
//     buddy.controller.js): hunger baja cada N min, happiness baja con
//     ella (más rápido si la mascota ya está en hambre 0). ---
const HUNGER_DECAY_EVERY_MIN = 30;
const HUNGER_DECAY_AMOUNT = 3;
const HAPPINESS_DECAY_AMOUNT = 2;
const HAPPINESS_DECAY_AMOUNT_HUNGRY = 5;

// --- Alimentar: consume del MISMO inventario que el avatar
//     (user.buddy.coffee / user.buddy.bread). Una sola despensa para los
//     dos. El café es un antojito -> sube mucho el ánimo, poco el hambre.
//     El pan es comida de verdad -> llena el hambre, sube poco el ánimo. ---
const FOOD = {
  coffee: { hunger: 15, happiness: 30, inv: "coffee", noneError: "NO_COFFEE" },
  bread: { hunger: 45, happiness: 10, inv: "bread", noneError: "NO_BREAD" },
};

// --- Jugar: gratis (no gasta comida), solo sube ánimo, con cooldown
//     para que no sea spam infinito. ---
const PLAY_HAPPINESS = 20;
const PLAY_COOLDOWN_MIN = 15;

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

// Despensa compartida con el avatar
function pantryOf(user) {
  return {
    coffee: Math.max(0, Number(user.buddy?.coffee) || 0),
    bread: Math.max(0, Number(user.buddy?.bread) || 0),
  };
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
    // Misma despensa que el avatar -> recárgala también al abrir esta
    // pantalla (idempotente dentro de 24h, igual que en getMe()).
    applyDailyRefillOnAppOpen(user, now);
    user.markModified("pet");
    user.markModified("buddy");
    await user.save();

    const vip = await isUserVIP(uid);

    return res.json({
      ok: true,
      pet: user.pet,
      mood: moodFromPet(user.pet),
      isVIP: vip,
      pantry: pantryOf(user),
    });
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
      lastPlayAt: null,
      adoptedAt: now,
    };
    user.markModified("pet");
    await user.save();

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet), pantry: pantryOf(user) });
  } catch (err) {
    console.error("adoptPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/feed  body: { type: "coffee" | "bread" }
async function feedPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const { type } = req.body || {};
    const food = FOOD[type];
    if (!food) return res.status(400).json({ ok: false, error: "INVALID_TYPE" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);
    applyDailyRefillOnAppOpen(user, now);

    if (!user.buddy) user.buddy = {};
    const have = Math.max(0, Number(user.buddy[food.inv]) || 0);
    if (have <= 0) return res.status(400).json({ ok: false, error: food.noneError });

    // Consume de la despensa compartida con el avatar
    user.buddy[food.inv] = have - 1;

    user.pet.hunger = clamp(Number(user.pet.hunger ?? 0) + food.hunger, 0, 100);
    user.pet.happiness = clamp(Number(user.pet.happiness ?? 0) + food.happiness, 0, 100);
    user.pet.lastFedAt = now;

    user.markModified("pet");
    user.markModified("buddy");
    await user.save();

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet), pantry: pantryOf(user) });
  } catch (err) {
    console.error("feedPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/play
async function playPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);

    const lastPlay = user.pet.lastPlayAt ? new Date(user.pet.lastPlayAt) : null;
    if (lastPlay) {
      const minsSince = Math.floor((now.getTime() - lastPlay.getTime()) / (1000 * 60));
      if (minsSince < PLAY_COOLDOWN_MIN) {
        return res.status(429).json({
          ok: false,
          error: "PLAY_COOLDOWN",
          secondsLeft: (PLAY_COOLDOWN_MIN - minsSince) * 60,
        });
      }
    }

    user.pet.happiness = clamp(Number(user.pet.happiness ?? 0) + PLAY_HAPPINESS, 0, 100);
    user.pet.lastPlayAt = now;

    user.markModified("pet");
    await user.save();

    return res.json({ ok: true, pet: user.pet, mood: moodFromPet(user.pet), pantry: pantryOf(user) });
  } catch (err) {
    console.error("playPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { getPet, adoptPet, feedPet, playPet };
