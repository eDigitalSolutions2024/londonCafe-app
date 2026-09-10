// src/controllers/pet.controller.js
const User = require("../models/User");
const { isUserVIP } = require("./me.controller");
const { applyDailyRefillOnAppOpen } = require("../utils/buddy");

// --- Decaimiento por tiempo real (mismo patrón que applyEnergyDecay de
//     buddy.controller.js): las 4 barras bajan cada N minutos. ---
const DECAY_EVERY_MIN = 30;
const DECAY = { hunger: 3, energy: 2, hygiene: 2, happiness: 2 };
// happiness cae más rápido si algo anda mal (hambre 0 / sucio / sin energía)
const HAPPINESS_DECAY_BAD = 5;
// Al bajar la higiene lo suficiente, la mascota "hace un desastre" (popó)
const MESS_HYGIENE_THRESHOLD = 12;

// --- Alimentar: consume del MISMO inventario que el avatar. Café = antojito
//     (mucho ánimo, poco hambre); pan = comida (llena el hambre). Comer
//     ensucia un poco. ---
const FOOD = {
  coffee: { hunger: 15, happiness: 30, inv: "coffee", noneError: "NO_COFFEE" },
  bread: { hunger: 45, happiness: 10, inv: "bread", noneError: "NO_BREAD" },
};
const FEED_HYGIENE_COST = 8;
const FEED_MESS_HYGIENE = 30; // si tras comer la higiene queda por debajo -> desastre
const FEED_XP = 5;

// --- Jugar: mini-juego, el cliente manda score 0..1. Sube ánimo (escala
//     con el score) pero cansa. Cooldown para que no sea infinito. ---
const PLAY_COOLDOWN_MIN = 12;
const PLAY_ENERGY_COST = 6;

// --- Limpiar / Dormir ---
const CLEAN_COOLDOWN_MIN = 2;
const CLEAN_HAPPINESS = 6;
const CLEAN_XP = 8;
const SLEEP_COOLDOWN_MIN = 20;
const SLEEP_MAX_ENERGY_TO_ALLOW = 80; // si tiene >80 de energía, "no tiene sueño"
const SLEEP_HAPPINESS = 4;
const SLEEP_XP = 10;

const SPECIES = new Set(["cat", "dog", "hamster"]);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// xp acumulado para llegar al nivel L: 30 * (L-1) * L  ->  0, 60, 180, 360, 600...
function levelInfo(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (30 * level * (level + 1) <= x) level++;
  const floor = 30 * (level - 1) * level;
  const ceil = 30 * level * (level + 1);
  return { level, xpInLevel: x - floor, xpForNext: ceil - floor };
}

function ageInfo(pet) {
  const born = pet?.adoptedAt ? new Date(pet.adoptedAt) : null;
  const days = born ? Math.floor((Date.now() - born.getTime()) / 86400000) : 0;
  let stage = "adulto";
  if (days < 2) stage = "bebé";
  else if (days < 6) stage = "joven";
  return { ageDays: days, stage };
}

function moodFromPet(pet) {
  if (!pet?.owned) return null;
  const hunger = Number(pet.hunger ?? 100);
  const happiness = Number(pet.happiness ?? 100);
  const energy = Number(pet.energy ?? 100);
  const hygiene = Number(pet.hygiene ?? 100);

  if (energy <= 20) return "sleepy";
  if (pet.mess || hygiene <= 20) return "dirty";
  if (hunger <= 0) return "hungry";
  if (happiness >= 70 && hunger >= 50 && hygiene >= 50) return "happy";
  if (happiness >= 40) return "meh";
  return "sad";
}

// La necesidad más urgente (para el badge del Home)
function primaryNeed(pet) {
  if (!pet?.owned) return null;
  if (pet.mess) return "clean";
  if (Number(pet.hunger ?? 100) <= 25) return "feed";
  if (Number(pet.energy ?? 100) <= 25) return "sleep";
  if (Number(pet.hygiene ?? 100) <= 30) return "clean";
  if (Number(pet.happiness ?? 100) <= 35) return "play";
  return null;
}

function pantryOf(user) {
  return {
    coffee: Math.max(0, Number(user.buddy?.coffee) || 0),
    bread: Math.max(0, Number(user.buddy?.bread) || 0),
  };
}

function petView(user, extra = {}) {
  const pet = user.pet;
  const li = levelInfo(pet.xp);
  const ai = ageInfo(pet);
  return {
    ok: true,
    pet,
    mood: moodFromPet(pet),
    need: primaryNeed(pet),
    level: li.level,
    xpInLevel: li.xpInLevel,
    xpForNext: li.xpForNext,
    ageDays: ai.ageDays,
    stage: ai.stage,
    pantry: pantryOf(user),
    ...extra,
  };
}

function applyPetDecay(user, now = new Date()) {
  if (!user.pet?.owned) return;

  const last = user.pet.lastStatsAt ? new Date(user.pet.lastStatsAt) : now;
  const diffMin = Math.floor((now.getTime() - last.getTime()) / (1000 * 60));
  if (diffMin < DECAY_EVERY_MIN) return;

  const steps = Math.floor(diffMin / DECAY_EVERY_MIN);
  const p = user.pet;

  p.hunger = clamp(Number(p.hunger ?? 100) - steps * DECAY.hunger, 0, 100);
  p.energy = clamp(Number(p.energy ?? 100) - steps * DECAY.energy, 0, 100);
  p.hygiene = clamp(Number(p.hygiene ?? 100) - steps * DECAY.hygiene, 0, 100);

  const bad = p.hunger <= 0 || p.mess || p.hygiene <= 15 || p.energy <= 0;
  const hDecay = bad ? HAPPINESS_DECAY_BAD : DECAY.happiness;
  p.happiness = clamp(Number(p.happiness ?? 100) - steps * hDecay, 0, 100);

  if (!p.mess && p.hygiene <= MESS_HYGIENE_THRESHOLD) p.mess = true;

  p.lastStatsAt = new Date(last.getTime() + steps * DECAY_EVERY_MIN * 60 * 1000);
}

function cooldownLeft(lastAt, minutes, now) {
  if (!lastAt) return 0;
  const mins = Math.floor((now.getTime() - new Date(lastAt).getTime()) / (1000 * 60));
  return mins < minutes ? (minutes - mins) * 60 : 0;
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
    applyDailyRefillOnAppOpen(user, now); // misma despensa que el avatar
    user.markModified("pet");
    user.markModified("buddy");
    await user.save();

    const vip = await isUserVIP(uid);
    return res.json(petView(user, { isVIP: vip }));
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
    if (!SPECIES.has(species)) return res.status(400).json({ ok: false, error: "INVALID_SPECIES" });
    const cleanName = typeof name === "string" ? name.trim().slice(0, 20) : "";
    if (!cleanName) return res.status(400).json({ ok: false, error: "MISSING_NAME" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (user.pet?.owned) return res.status(400).json({ ok: false, error: "ALREADY_OWNED" });

    const vip = await isUserVIP(uid);
    if (!vip) return res.status(403).json({ ok: false, error: "VIP_REQUIRED" });

    const now = new Date();
    user.pet = {
      owned: true,
      species,
      name: cleanName,
      hunger: 100,
      happiness: 100,
      energy: 100,
      hygiene: 100,
      mess: false,
      xp: 0,
      lastStatsAt: now,
      lastFedAt: null,
      lastPlayAt: null,
      lastCleanAt: null,
      lastSleepAt: null,
      adoptedAt: now,
    };
    user.markModified("pet");
    await user.save();

    return res.json(petView(user));
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

    user.buddy[food.inv] = have - 1;

    const p = user.pet;
    p.hunger = clamp(Number(p.hunger ?? 0) + food.hunger, 0, 100);
    p.happiness = clamp(Number(p.happiness ?? 0) + food.happiness, 0, 100);
    p.hygiene = clamp(Number(p.hygiene ?? 100) - FEED_HYGIENE_COST, 0, 100);
    if (p.hygiene < FEED_MESS_HYGIENE) p.mess = true;
    p.xp = Math.max(0, Number(p.xp) || 0) + FEED_XP;
    p.lastFedAt = now;

    user.markModified("pet");
    user.markModified("buddy");
    await user.save();

    return res.json(petView(user, { action: "feed", food: type }));
  } catch (err) {
    console.error("feedPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/play  body: { score }  (0..1, fracción de aciertos del mini-juego)
async function playPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);

    const left = cooldownLeft(user.pet.lastPlayAt, PLAY_COOLDOWN_MIN, now);
    if (left > 0) return res.status(429).json({ ok: false, error: "PLAY_COOLDOWN", secondsLeft: left });

    let score = Number(req.body?.score);
    if (!Number.isFinite(score)) score = 0.5;
    score = clamp(score, 0, 1);

    const p = user.pet;
    const happyGain = Math.round(12 + score * 20); // 12..32
    const xpGain = Math.round(8 + score * 14); // 8..22

    p.happiness = clamp(Number(p.happiness ?? 0) + happyGain, 0, 100);
    p.energy = clamp(Number(p.energy ?? 100) - PLAY_ENERGY_COST, 0, 100);
    p.xp = Math.max(0, Number(p.xp) || 0) + xpGain;
    p.lastPlayAt = now;

    user.markModified("pet");
    await user.save();

    return res.json(petView(user, { action: "play", happyGain, xpGain }));
  } catch (err) {
    console.error("playPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/clean
async function cleanPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);

    const p = user.pet;
    if (!p.mess && Number(p.hygiene ?? 100) >= 95) {
      return res.status(400).json({ ok: false, error: "ALREADY_CLEAN" });
    }
    const left = cooldownLeft(p.lastCleanAt, CLEAN_COOLDOWN_MIN, now);
    if (left > 0) return res.status(429).json({ ok: false, error: "CLEAN_COOLDOWN", secondsLeft: left });

    p.hygiene = 100;
    p.mess = false;
    p.happiness = clamp(Number(p.happiness ?? 0) + CLEAN_HAPPINESS, 0, 100);
    p.xp = Math.max(0, Number(p.xp) || 0) + CLEAN_XP;
    p.lastCleanAt = now;

    user.markModified("pet");
    await user.save();

    return res.json(petView(user, { action: "clean" }));
  } catch (err) {
    console.error("cleanPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /pet/sleep
async function sleepPet(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (!user.pet?.owned) return res.status(400).json({ ok: false, error: "NO_PET" });

    const now = new Date();
    applyPetDecay(user, now);

    const p = user.pet;
    if (Number(p.energy ?? 100) > SLEEP_MAX_ENERGY_TO_ALLOW) {
      return res.status(400).json({ ok: false, error: "NOT_TIRED" });
    }
    const left = cooldownLeft(p.lastSleepAt, SLEEP_COOLDOWN_MIN, now);
    if (left > 0) return res.status(429).json({ ok: false, error: "SLEEP_COOLDOWN", secondsLeft: left });

    p.energy = 100;
    p.happiness = clamp(Number(p.happiness ?? 0) + SLEEP_HAPPINESS, 0, 100);
    p.xp = Math.max(0, Number(p.xp) || 0) + SLEEP_XP;
    p.lastSleepAt = now;

    user.markModified("pet");
    await user.save();

    return res.json(petView(user, { action: "sleep" }));
  } catch (err) {
    console.error("sleepPet ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { getPet, adoptPet, feedPet, playPet, cleanPet, sleepPet };
