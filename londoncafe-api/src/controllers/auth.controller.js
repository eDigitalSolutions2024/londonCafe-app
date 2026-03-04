// src/controllers/auth.controller.js

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const { generateOtp6, hashOtp } = require("../utils/otp");
const { sendVerificationEmail } = require("../utils/email");
const { signAccessToken } = require("../utils/tokens");

const OTP_EXPIRE_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

// =========================
// ✅ BUDDY / ENERGÍA LOGIC
// =========================

// ✅ NUEVAS REGLAS:
// - En 1 día baja 50 puntos (2 días = -100)
// - Café/pan se acumulan por día (no se resetean)
// - El +40 de café/pan se aplica en buddy.controller.js (feed), no aquí

const ENERGY_LOSS_PER_DAY = 50;
const MINUTES_PER_DAY = 1440;
const LOSS_PER_MIN = ENERGY_LOSS_PER_DAY / MINUTES_PER_DAY;

const DAILY_ADD_COFFEE = 1;
const DAILY_ADD_BREAD = 1;
const MAX_STACK = 20; // opcional (para no acumular infinito). Sube/baja a tu gusto.

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
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

// ✅ Decay continuo: 50 puntos por día
function applyEnergyDecay(user, now = new Date()) {
  ensureBuddy(user, now);

  const last = new Date(user.buddy.lastEnergyAt || now);
  const minutes = Math.floor((now.getTime() - last.getTime()) / (1000 * 60));
  if (minutes <= 0) return;

  const lost = minutes * LOSS_PER_MIN;

  user.buddy.energy = clamp(Math.round((user.buddy.energy ?? 0) - lost), 0, 100);
  user.buddy.lastEnergyAt = now;
}

// utils/buddy.js  (o el archivo donde tengas tu lógica de buddy)
function applyDailyRefillOnAppOpen(user, now = new Date()) {
  ensureBuddy(user, now);

  const lastRefill = user.buddy.lastRefillAt ? new Date(user.buddy.lastRefillAt) : null;

  if (!lastRefill || !isSameDay(lastRefill, now)) {
    user.buddy.coffee = clamp((user.buddy.coffee ?? 0) + DAILY_ADD_COFFEE, 0, MAX_STACK);
    user.buddy.bread  = clamp((user.buddy.bread  ?? 0) + DAILY_ADD_BREAD,  0, MAX_STACK);
    user.buddy.lastRefillAt = now;
  }

  // opcional: guardar la última vez que entró a la app
  user.buddy.lastLoginAt = now;
}

function moodFromEnergy(energy) {
  const e = Number(energy ?? 80);
  if (e >= 80) return "HAPPY";
  if (e >= 50) return "OK";
  if (e >= 20) return "TIRED";
  return "SAD";
}

// =========================
// ✅ AUTH LOGIC
// =========================

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").toLowerCase());
}

async function register(req, res) {
  try {
    const { name, email, password, gender, phone, birthDate } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "INVALID_EMAIL" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "WEAK_PASSWORD" });
    }

    // ✅ Validación phone (mínimo 10 dígitos, opcional +)
    const phoneStr = String(phone || "").trim();
    if (!phoneStr) {
      return res.status(400).json({ error: "MISSING_PHONE" });
    }
    if (!/^\+?[0-9]{10,16}$/.test(phoneStr)) {
      return res.status(400).json({ error: "INVALID_PHONE" });
    }

    // ✅ Validación birthDate (esperamos ISO YYYY-MM-DD)
    const birthStr = String(birthDate || "").trim();
    if (!birthStr) {
      return res.status(400).json({ error: "MISSING_BIRTHDATE" });
    }
    const bd = new Date(birthStr);
    if (Number.isNaN(bd.getTime())) {
      return res.status(400).json({ error: "INVALID_BIRTHDATE" });
    }
    // no futuro
    const today = new Date();
    if (bd > today) {
      return res.status(400).json({ error: "INVALID_BIRTHDATE" });
    }
    // mínimo 13 años (igual que frontend)
    const min = new Date();
    min.setFullYear(min.getFullYear() - 13);
    if (bd > min) {
      return res.status(400).json({ error: "UNDERAGE" });
    }

    // ✅ Duplicados: email
    const emailLower = String(email).toLowerCase();
    const exists = await User.findOne({ email: emailLower });
    if (exists) return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });

    // ✅ Duplicados: phone (si lo hiciste unique+sparse en schema, esto también lo atrapará)
    const phoneExists = await User.findOne({ phone: phoneStr });
    if (phoneExists) return res.status(409).json({ error: "PHONE_ALREADY_EXISTS" });

    const allowed = ["male", "female", "other"];
    const safeGender = allowed.includes(String(gender)) ? String(gender) : "other";

    const DEFAULT_HAIR_BY_GENDER = {
      female: "hair_f_01",
      male: "hair_01",
      other: "hair_01",
    };

    const avatarConfig = {
      skin: "skin_01",
      hair: DEFAULT_HAIR_BY_GENDER[safeGender] || "hair_01",
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    };

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: emailLower,
      passwordHash,
      isEmailVerified: false,
      gender: safeGender,
      avatarConfig,

      // ✅ NUEVO
      phone: phoneStr,
      birthDate: bd,
    });

    // OTP
    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

    await EmailVerification.create({
      userId: user._id,
      codeHash,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    });

    const showOtp = process.env.DEV_SHOW_OTP === "true";
    if (process.env.NODE_ENV === "development" && showOtp) {
      console.log(`🟣 [DEV OTP] Email: ${user.email} | Code: ${code}`);
    } else {
      await sendVerificationEmail({ to: user.email, code });
    }

    return res.json({
      ok: true,
      next: "VERIFY_EMAIL",
      email: user.email,
      cooldown: RESEND_COOLDOWN_SEC,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    // ✅ Por si se te fue el unique index y tronó aquí
    if (err && err.code === 11000) {
      const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : "";
      if (key === "email") return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });
      if (key === "phone") return res.status(409).json({ error: "PHONE_ALREADY_EXISTS" });
      return res.status(409).json({ error: "DUPLICATE" });
    }

    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
}
async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });

    const record = await EmailVerification.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ error: "NO_VERIFICATION_PENDING" });

    const now = new Date();
    if (now > record.expiresAt) return res.status(400).json({ error: "OTP_EXPIRED" });
    if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

    const incomingHash = hashOtp(String(code));
    if (incomingHash !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "INVALID_CODE", attemptsLeft: MAX_ATTEMPTS - record.attempts });
    }

    user.isEmailVerified = true;
    await user.save();
    await EmailVerification.deleteMany({ userId: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });

    const last = await EmailVerification.findOne({ userId: user._id }).sort({ createdAt: -1 });
    const now = new Date();

    if (last && now < last.resendAvailableAt) {
      const secondsLeft = Math.ceil((last.resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({ error: "RESEND_COOLDOWN", secondsLeft });
    }

    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

    await EmailVerification.create({
      userId: user._id,
      codeHash,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    });

    const showOtp = process.env.DEV_SHOW_OTP === "true";
    if (process.env.NODE_ENV === "development" && showOtp) {
      console.log(`🟣 [DEV OTP - RESEND] Email: ${user.email} | Code: ${code}`);
    } else {
      await sendVerificationEmail({ to: user.email, code });
    }

    return res.json({ ok: true, cooldown: RESEND_COOLDOWN_SEC });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    if (!user.isEmailVerified) return res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    // ✅ Energía “viva”
    const now = new Date();
    applyEnergyDecay(user, now);  // primero decay por tiempo
    //applyLoginRefill(user, now);  // luego refill diario acumulable
    await user.save();

    const token = signAccessToken({ uid: user._id });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        gender: user.gender,
        avatarConfig: user.avatarConfig,
        buddy: {
          energy: user.buddy?.energy ?? 80,
          mood: moodFromEnergy(user.buddy?.energy ?? 80),
          coffee: user.buddy?.coffee ?? 0,
          bread: user.buddy?.bread ?? 0,
          lastLoginAt: user.buddy?.lastLoginAt ?? null,
          lastRefillAt: user.buddy?.lastRefillAt ?? null,
          lastEnergyAt: user.buddy?.lastEnergyAt ?? null,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    // ✅ cada refresh recalcula energía por tiempo
    const now = new Date();
    applyEnergyDecay(user, now);
    await user.save();

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        gender: user.gender,
        isEmailVerified: user.isEmailVerified,
        avatarConfig: user.avatarConfig,
        buddy: user.buddy,
        points: user.points,
        lifetimePoints: user.lifetimePoints,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = { register, verifyEmail, resendVerification, login, me };
