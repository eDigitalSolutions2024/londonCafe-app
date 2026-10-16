// src/controllers/auth.controller.js

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const PasswordReset = require("../models/PasswordReset");
const { generateOtp6, hashOtp } = require("../utils/otp");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const { signAccessToken } = require("../utils/tokens");
const { getWallet, creditBonus } = require("../utils/wallet");
const { sendExpoPushNotification } = require("../utils/push");

const OTP_EXPIRE_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

// ✅ Referidos -- "invita a un amigo". Mismo monto para ambos (quien invita
// y quien se une) -- más que el refill diario (3), menos que el regalo de
// cumpleaños (50, pero eso es una vez al año): es la recompensa por traer
// gente nueva de verdad, no solo por abrir la app.
const REFERRAL_COINS = 30;
const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I, se confunden al escribirlos a mano

function randomReferralCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  return s;
}

/** Genera y guarda un código único para quien todavía no tiene uno (cuentas de antes de esta feature, o recién creadas). */
async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomReferralCode();
    const taken = await User.exists({ referralCode: code });
    if (!taken) {
      user.referralCode = code;
      await user.save();
      return code;
    }
  }
  throw new Error("No se pudo generar un código de referido único");
}

/** Paga la recompensa a ambos lados de un referido -- se llama sin await desde verifyEmail, nunca debe tronar esa respuesta. */
async function rewardReferral(user) {
  const inviter = await User.findById(user.referredBy).select("_id name expoPushToken");
  if (!inviter) return;

  await creditBonus(user._id, { coins: REFERRAL_COINS, key: `REFERRAL-NEW-${user._id}`, reason: "Te invitaron a London Café" });
  await creditBonus(inviter._id, { coins: REFERRAL_COINS, key: `REFERRAL-INVITER-${inviter._id}-${user._id}`, reason: `Invitaste a ${user.name || "un amigo"}` });

  user.referralRewardedAt = new Date();
  await user.save();

  if (user.expoPushToken) {
    await sendExpoPushNotification(
      user.expoPushToken,
      "🎁 ¡Bono de bienvenida!",
      `Por llegar invitado, ganaste ${REFERRAL_COINS} BuddyCoins.`,
      { type: "referral-reward", coins: REFERRAL_COINS }
    ).catch(() => {});
  }
  if (inviter.expoPushToken) {
    await sendExpoPushNotification(
      inviter.expoPushToken,
      "🎁 ¡Tu amigo ya se unió!",
      `${user.name || "Tu invitado"} verificó su cuenta -- ganaste ${REFERRAL_COINS} BuddyCoins.`,
      { type: "referral-reward", coins: REFERRAL_COINS }
    ).catch(() => {});
  }
}

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

const DAILY_ADD_COFFEE = 3;
const DAILY_ADD_BREAD = 3;
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

// Mismos ids "gratis" que la app muestra en RegisterScreen/AvatarCustomizeScreen
// (hair_07 y hair_f_05 son VIP -- nadie puede elegirlos al registrarse,
// ni siquiera mandando el id a mano, porque nadie tiene Buddy Coins todavía).
const FREE_HAIR_IDS = new Set([
  "hair_01", "hair_02", "hair_03", "hair_04", "hair_05",
  "hair_f_01", "hair_f_02", "hair_f_03", "hair_f_04",
]);

const PET_SPECIES = new Set(["cat", "dog", "hamster"]);

async function register(req, res) {
  try {
    const { name, email, password, gender, phone, birthDate, avatarHair, petSpecies, petName, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "INVALID_EMAIL" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "WEAK_PASSWORD" });
    }

    // ✅ Phone — ahora requerido (antes opcional): lo necesitamos como
    // llave alterna de búsqueda en POS/Kiosk para clientes que pagan sin
    // traer la app a la mano. Las cuentas ya existentes sin teléfono no
    // se ven afectadas -- solo se exige desde aquí en adelante.
    const phoneStr = String(phone || "").trim();
    if (!phoneStr) {
      return res.status(400).json({ error: "MISSING_PHONE" });
    }
    if (!/^\+?[0-9]{10,16}$/.test(phoneStr)) {
      return res.status(400).json({ error: "INVALID_PHONE" });
    }
    // Cuenta de invitado (creada en POS/Kiosk o por el QR del ticket con solo
    // el teléfono): si la persona se registra con ese MISMO teléfono, la
    // cuenta se COMPLETA (correo, contraseña...) en vez de rechazarla --
    // conserva puntos e historial desde el día 1. El teléfono puede estar
    // guardado con o sin "+", por eso se busca en ambas formas.
    const phoneAlt = phoneStr.startsWith("+") ? phoneStr.slice(1) : `+${phoneStr}`;
    let phoneOwner = await User.findOne({ phone: phoneStr });
    if (!phoneOwner) {
      const guestAlt = await User.findOne({ phone: phoneAlt, isGuest: true });
      if (guestAlt) phoneOwner = guestAlt;
    }
    // Solo una cuenta que sigue siendo de invitado se puede completar; una
    // cuenta ya verificada con ese teléfono sí es un duplicado real.
    const guestToComplete = phoneOwner && phoneOwner.isGuest === true ? phoneOwner : null;
    if (phoneOwner && !guestToComplete) return res.status(409).json({ error: "PHONE_ALREADY_EXISTS" });
    const validPhone = phoneStr;

    // ✅ birthDate — optional
    let bd = null;
    const birthStr = String(birthDate || "").trim();
    if (birthStr) {
      bd = new Date(birthStr);
      if (Number.isNaN(bd.getTime())) {
        return res.status(400).json({ error: "INVALID_BIRTHDATE" });
      }
      const today = new Date();
      if (bd > today) return res.status(400).json({ error: "INVALID_BIRTHDATE" });
      const minAge = new Date();
      minAge.setFullYear(minAge.getFullYear() - 13);
      if (bd > minAge) return res.status(400).json({ error: "UNDERAGE" });
    }

    // ✅ Duplicados: email
    const emailLower = String(email).toLowerCase();
    const exists = await User.findOne({ email: emailLower });
    if (exists && !(guestToComplete && String(exists._id) === String(guestToComplete._id))) {
      return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });
    }

    const allowed = ["male", "female", "other"];
    const safeGender = allowed.includes(String(gender)) ? String(gender) : "other";

    const DEFAULT_HAIR_BY_GENDER = {
      female: "hair_f_01",
      male: "hair_01",
      other: "hair_01",
    };

    const chosenHair = FREE_HAIR_IDS.has(String(avatarHair)) ? String(avatarHair) : null;

    const avatarConfig = {
      skin: "skin_01",
      hair: chosenHair || DEFAULT_HAIR_BY_GENDER[safeGender] || "hair_01",
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    };

    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Mascota VIP opcional desde el registro -- válido porque toda cuenta
    // nueva es VIP automática su primer mes (ver isUserVIP en
    // me.controller.js), así que no hace falta gatear esto por separado:
    // si mandó especie+nombre válidos, se adopta de una vez.
    const cleanPetName = typeof petName === "string" ? petName.trim().slice(0, 20) : "";
    const petChoice = PET_SPECIES.has(petSpecies) && cleanPetName
      ? {
          owned: true,
          species: petSpecies,
          name: cleanPetName,
          hunger: 100,
          happiness: 100,
          energy: 100,
          hygiene: 100,
          mess: false,
          xp: 0,
          lastStatsAt: new Date(),
          adoptedAt: new Date(),
        }
      : null;

    // ✅ Código de invitación opcional -- si no existe o es el propio (nadie
    // se refiere a sí mismo), simplemente se ignora en vez de tronar el
    // registro por un código mal escrito.
    let inviter = null;
    const cleanReferralCode = String(referralCode || "").trim().toUpperCase();
    if (cleanReferralCode) {
      inviter = await User.findOne({ referralCode: cleanReferralCode });
    }

    let user;
    if (guestToComplete) {
      // Se completa la cuenta existente: puntos, historial y demás se quedan.
      // isGuest sigue en true hasta que verifique el correo (verifyEmail).
      guestToComplete.name = name;
      guestToComplete.email = emailLower;
      guestToComplete.passwordHash = passwordHash;
      guestToComplete.isEmailVerified = false;
      guestToComplete.gender = safeGender;
      guestToComplete.avatarConfig = avatarConfig;
      guestToComplete.phone = validPhone;
      if (bd) guestToComplete.birthDate = bd;
      if (petChoice) guestToComplete.pet = petChoice;
      if (inviter && !guestToComplete.referredBy && String(inviter._id) !== String(guestToComplete._id)) {
        guestToComplete.referredBy = inviter._id;
      }
      await guestToComplete.save();
      user = guestToComplete;
    } else {
      user = await User.create({
        name,
        email: emailLower,
        passwordHash,
        isEmailVerified: false,
        gender: safeGender,
        avatarConfig,
        ...(validPhone ? { phone: validPhone } : {}),
        ...(bd ? { birthDate: bd } : {}),
        ...(petChoice ? { pet: petChoice } : {}),
        ...(inviter ? { referredBy: inviter._id } : {}),
      });
    }

    // Su propio código para invitar a otros, de una vez (no hasta que lo pida).
    try {
      await ensureReferralCode(user);
    } catch (e) {
      console.error("No se pudo generar referralCode:", e?.message);
    }

    // Reintento de registro sobre la misma cuenta: se limpian códigos viejos.
    if (guestToComplete) await EmailVerification.deleteMany({ userId: user._id });

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
      console.log(`🟣 [DEV OTP] Tel: ${user.phone} | Code: ${code}`);
    } else {
      // ✅ Verificación por correo -- la SMS vía Twilio queda en pausa hasta
      // tener un número realmente aprovisionado (la cuenta sigue en Trial y
      // no posee ningún número propio, ver sesión). Mismo saneamiento que
      // tenía la rama de SMS: si el correo no se puede entregar, no dejar
      // la cuenta a medias.
      try {
        await sendVerificationEmail({ to: user.email, code });
      } catch (emailErr) {
        console.error("REGISTER EMAIL SEND ERROR:", emailErr);
        await EmailVerification.deleteMany({ userId: user._id });
        if (guestToComplete) {
          // NO se borra la cuenta de invitado (tiene puntos): solo se le
          // quita lo que se acaba de agregar para poder reintentar.
          await User.updateOne(
            { _id: user._id },
            { $unset: { email: 1, passwordHash: 1 }, $set: { isEmailVerified: false } }
          );
        } else {
          await User.deleteOne({ _id: user._id });
        }
        return res.status(502).json({ error: "EMAIL_SEND_FAILED" });
      }
    }

    return res.json({
      ok: true,
      next: "VERIFY_EMAIL",
      email: user.email,
      phone: user.phone,
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
    // Una cuenta de invitado que completó su registro deja de serlo al
    // confirmar su correo.
    if (user.isGuest) user.isGuest = false;
    await user.save();
    await EmailVerification.deleteMany({ userId: user._id });

    // Recompensa de referido -- se paga hasta que el invitado verifica de
    // verdad (no al registrarse), para no regalar BuddyCoins por cuentas
    // fantasma. Sin await: nunca debe retrasar la respuesta de "ya quedó
    // verificado" por un hipo del Wallet V2. NOTA para cuando se arme la
    // verificación por SMS (mañana): este mismo bloque de recompensa
    // necesita moverse/copiarse al handler que confirme el código por SMS,
    // o el referido dejaría de pagarse en cuanto ese sea el flujo real.
    if (user.referredBy && !user.referralRewardedAt) {
      rewardReferral(user).catch((e) => console.error("rewardReferral error:", e?.message));
    }

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
      console.log(`🟣 [DEV OTP - RESEND] Tel: ${user.phone} | Code: ${code}`);
    } else {
      try {
        await sendVerificationEmail({ to: user.email, code });
      } catch (emailErr) {
        console.error("RESEND EMAIL SEND ERROR:", emailErr);
        return res.status(502).json({ error: "EMAIL_SEND_FAILED" });
      }
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
        // ✅ BUG encontrado: en todo el resto del cliente/backend se lee
        // `user._id` (convención Mongoose), pero esta respuesta solo traía
        // `id` -- user._id quedaba `undefined` en TODA sesión restaurada
        // por login. Efecto real: App.js guardaba el "ya viste el tour de
        // bienvenida" bajo la llave `onboarding_seen_v1_${user._id}`, que
        // con _id undefined es SIEMPRE la misma llave rota -- y el guard
        // `if (user?._id)` en finishOnboarding impedía que ese guardado
        // corriera JAMÁS, así que el tour reaparecía en cada apertura de
        // la app sin importar cuántas veces se "terminara". Se agrega
        // _id sin quitar `id` (por si algo más ya depende de ese nombre).
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        gender: user.gender,
        avatarConfig: user.avatarConfig,
        avatar3d: user.avatar3d,
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

// Mismo patrón OTP que register/verifyEmail: código de 6 dígitos hasheado,
// expira en 10 min, cooldown de reenvío de 60s, tope de intentos. Se
// responde USER_NOT_FOUND si el correo no existe -- igual que
// resendVerification, para no divergir del resto del auth en este mismo
// archivo.
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const last = await PasswordReset.findOne({ userId: user._id }).sort({ createdAt: -1 });
    const now = new Date();

    if (last && now < last.resendAvailableAt) {
      const secondsLeft = Math.ceil((last.resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({ error: "RESEND_COOLDOWN", secondsLeft });
    }

    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

    await PasswordReset.create({
      userId: user._id,
      codeHash,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    });

    const showOtp = process.env.DEV_SHOW_OTP === "true";
    if (process.env.NODE_ENV === "development" && showOtp) {
      console.log(`🟣 [DEV OTP - RESET PASSWORD] Email: ${user.email} | Code: ${code}`);
    } else {
      await sendPasswordResetEmail({ to: user.email, code, name: user.name });
    }

    return res.json({ ok: true, cooldown: RESEND_COOLDOWN_SEC });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: "MISSING_FIELDS" });
    if (String(newPassword).length < 8) return res.status(400).json({ error: "WEAK_PASSWORD" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const record = await PasswordReset.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ error: "NO_RESET_PENDING" });

    const now = new Date();
    if (now > record.expiresAt) return res.status(400).json({ error: "OTP_EXPIRED" });
    if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

    const incomingHash = hashOtp(String(code));
    if (incomingHash !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "INVALID_CODE", attemptsLeft: MAX_ATTEMPTS - record.attempts });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    await PasswordReset.deleteMany({ userId: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
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

    // Wallet V2 es la única fuente de saldo (points/lifetimePoints conservan su
    // nombre para las apps ya instaladas). Si el POS no responde: null, nunca
    // el campo legado.
    const wallet = await getWallet(String(user._id)).catch(() => null);

    return res.json({
      user: {
        id: user._id,
        _id: user._id, // ver comentario en login() -- mismo bug, mismo fix.
        name: user.name,
        email: user.email,
        username: user.username,
        gender: user.gender,
        isEmailVerified: user.isEmailVerified,
        avatarConfig: user.avatarConfig,
        avatar3d: user.avatar3d,
        buddy: user.buddy,
        points: wallet ? wallet.balance : null,
        lifetimePoints: wallet ? wallet.totalEarned : null,
        visits: user.visits,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = { register, verifyEmail, resendVerification, login, me, forgotPassword, resetPassword, ensureReferralCode };
