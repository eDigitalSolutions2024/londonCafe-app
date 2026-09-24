// src/controllers/me.controller.js
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const PointsHistory = require("../models/PointsHistory");
const PointClaim = require("../models/PointClaims");
const Redemption = require("../models/Redemption");
const Receipt = require("../models/Receipt");
const Sale = require("../models/Sale");
const GiftCard = require("../models/GiftCard");
const { generateOtp6, hashOtp } = require("../utils/otp");
const { sendVerificationEmail } = require("../utils/email");

// 👇 agrega esto (ajusta la ruta según dónde lo pusiste)
const {
  applyEnergyDecay,
  applyDailyRefillOnAppOpen,
  claimDailyReward,
  getRefillTimer, // ✅
  dayKeyLocal,
  normalizeStreakAutoReset, 
  addDaysToKey,// ✅
} = require("../utils/buddy");

const { sendExpoPushNotification } = require("../utils/push");
const { getWallet, withWalletPoints, creditBonus, spendCoins } = require("../utils/wallet");

const RECOVERY_COST = 25;

const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";

/** helper: saca uid del token */
function getUid(req) {
  return req.user?.uid || req.user?.sub || req.user?.userId || req.user?.id || null;
}

function calcCanRecover(user) {
  return (
    !!user?.buddy?.streakBrokenDay &&
    user?.buddy?.streakRecoveryUsed === false &&
    Number(user?.buddy?.streakPrevCount || 0) > 0
  );
}

async function claimReward(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const now = new Date();

    const result = claimDailyReward(user, now);

    // Wallet V2 es la única fuente de saldo. Se acredita ANTES de guardar la
    // racha: si el Wallet no responde, no se marca el día como reclamado y la
    // persona puede reintentar (la clave por día evita duplicar el bono).
    let balanceAfter = null;
    if (result.ok && result.reward?.coins > 0) {
      try {
        const credited = await creditBonus(String(user._id), {
          coins: result.reward.coins,
          key: result.today,
          reason: "Recompensa diaria / racha",
        });
        balanceAfter = credited.balanceAfter;
      } catch (walletErr) {
        console.log("claimReward wallet error:", walletErr?.message);
        return res.status(502).json({ error: "WALLET_UNAVAILABLE" });
      }
    }

    user.markModified("buddy");
    await user.save();

    if (!Number.isFinite(balanceAfter)) {
      balanceAfter = await getWallet(String(user._id)).then((w) => w.balance).catch(() => null);
    }

    const canRecover = calcCanRecover(user);

    return res.json({
      ok: true,
      claim: result,
      streak: {
        count: user.buddy?.streakCount || 0,
        best: user.buddy?.bestStreak || 0,
        claimedToday: user.buddy?.lastClaimDay === dayKeyLocal(now),
        canRecover,
        recoveryCost: RECOVERY_COST,
      },
      buddy: user.buddy,
      points: balanceAfter,
    });
  } catch (err) {
    console.log("claimReward FULL:", err); // 👈 para ver stack completo
    return res.status(500).json({ error: "SERVER_ERROR", message: err?.message });
  }
}

async function recoverStreak(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const now = new Date();

    // ✅ por si llaman recover sin pasar por /me antes (arma el recovery si aplica)
    normalizeStreakAutoReset(user, now);

    if (!calcCanRecover(user)) {
      return res.status(400).json({ ok: false, error: "NO_RECOVERY_AVAILABLE" });
    }

    // ✅ cobrar en Wallet V2 (única fuente de saldo). Idempotente por el día
    // en que se rompió la racha: reintentar no cobra dos veces.
    let balanceAfter;
    try {
      const spent = await spendCoins(String(user._id), {
        coins: RECOVERY_COST,
        idempotencyKey: `STREAK_RECOVER:${user.buddy?.streakBrokenDay || "na"}`,
        reason: "Recuperar racha",
      });
      if (!spent.ok) {
        return res.status(400).json({
          ok: false,
          error: "INSUFFICIENT_COINS",
          needed: RECOVERY_COST,
          current: spent.balance,
        });
      }
      balanceAfter = spent.balanceAfter;
    } catch (walletErr) {
      console.log("recoverStreak wallet error:", walletErr?.message);
      return res.status(502).json({ ok: false, error: "WALLET_UNAVAILABLE" });
    }

    // ✅ restaurar
const todayKey = dayKeyLocal(now);
const restored = Number(user.buddy.streakPrevCount || 0);

user.buddy.streakCount = restored;
user.buddy.streakRecoveryUsed = true;

// ✅ CLAVE: deja lastStreakDay en "ayer" para que HOY el claim sea consecutivo
user.buddy.lastStreakDay = addDaysToKey(todayKey, -1);

// ✅ CLAVE: permitir reclamar hoy (si quedara igual a hoy, bloquearía)
user.buddy.lastClaimDay = "";

    // ✅ limpiar para que NO se pueda repetir
    user.buddy.streakPrevCount = 0;
    user.buddy.streakBrokenDay = "";

    user.markModified("buddy");
    await user.save();

    return res.json({
      ok: true,
      points: balanceAfter,
      buddy: user.buddy,
      streak: {
        count: user.buddy?.streakCount || 0,
        best: user.buddy?.bestStreak || 0,
        claimedToday: user.buddy?.lastClaimDay === dayKeyLocal(now),
        canRecover: false,
        recoveryCost: RECOVERY_COST,
      },
    });
  } catch (err) {
    console.log("recoverStreak FULL:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err?.message });
  }
}

const ALLOWED_GENDERS = new Set(["male", "female", "other"]);

async function getMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const now = new Date();

    applyEnergyDecay(user, now);
    applyDailyRefillOnAppOpen(user, now);
    normalizeStreakAutoReset(user, now); // ✅ AQUÍ
    user.markModified("buddy"); // ✅ recomendado

    // ✅ Recuperar usuarios inactivos (ver pushJobs.js): esto SÍ significa
    // que la persona abrió la app de verdad, así que se marca como
    // actividad real y se resetean los avisos de "te extrañamos" -- si se
    // vuelve a quedar inactiva, puede recibirlos de nuevo más adelante.
    user.lastActiveAt = now;
    if (user.reengageFlags?.day1 || user.reengageFlags?.day7 || user.reengageFlags?.day30) {
      user.reengageFlags.day1 = false;
      user.reengageFlags.day7 = false;
      user.reengageFlags.day30 = false;
      user.markModified("reengageFlags");
    }

    // Cambio de correo abandonado: si pasaron 24h sin confirmarlo, se
    // cancela solo (mismo enfoque "lazy, al leer" que normalizeStreakAutoReset
    // arriba) -- si no, el banner "Confirma tu correo nuevo" se queda
    // pegado para siempre para quien no vuelve a esa pantalla.
    if (user.pendingEmail && user.pendingEmailRequestedAt) {
      const ageMs = now - new Date(user.pendingEmailRequestedAt);
      if (ageMs > PENDING_EMAIL_EXPIRE_MS) {
        user.pendingEmail = null;
        user.pendingEmailRequestedAt = null;
        await EmailVerification.deleteMany({ userId: uid });
      }
    }

    // ✅ calcula cuánto falta / si ya está listo
    const refillTimer = getRefillTimer(user, now);

    await user.save();

    const sanitizedUser = await User.findById(uid).select(
      "name gender username email pendingEmail isEmailVerified avatarConfig avatar3d createdAt buddy phone visits"
    );

    const canRecover = calcCanRecover(user);

    // ✅ manda el timer junto al user
    return res.json({
      ok: true,
      // points/lifetimePoints salen de Wallet V2 (mismos nombres que siempre).
      user: await withWalletPoints(sanitizedUser),
      refillTimer,
      streak: {
        count: user.buddy?.streakCount || 0,
        best: user.buddy?.bestStreak || 0,
        claimedToday: user.buddy?.lastClaimDay === dayKeyLocal(now),
        canRecover,
        recoveryCost: RECOVERY_COST,
      },
    });
  } catch (err) {
    console.log("getMe FULL:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err?.message });
  }
}

const EMAIL_CHANGE_OTP_EXPIRE_MIN = 10;
const EMAIL_CHANGE_RESEND_COOLDOWN_SEC = 60;
const EMAIL_CHANGE_MAX_ATTEMPTS = 5;
// Distinto del expirado del código OTP (10 min, arriba) -- esto es cuánto
// tiempo se deja pendingEmail/el banner de confirmación antes de darlo por
// abandonado y cancelarlo solo (ver el chequeo lazy en getMe()).
const PENDING_EMAIL_EXPIRE_MS = 24 * 60 * 60 * 1000;

async function updateMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { name, username, email, gender, phone } = req.body || {};
    const patch = {};
    let emailChangePending = false;

    if (typeof name === "string" && name.trim()) patch.name = name.trim();

    if (typeof username === "string") {
      const u = username.trim().toLowerCase();
      if (u.length === 0) {
        patch.username = null;
      } else {
        if (!/^[a-z0-9_]{3,20}$/.test(u)) {
          return res.status(400).json({ error: "BAD_USERNAME" });
        }
        patch.username = u;
      }
    }

    // ✅ El correo YA NO se aplica directo -- queda en pendingEmail hasta
    // que se confirme con un código mandado a la dirección nueva (POST
    // /me/confirm-email). Antes cualquiera con la sesión abierta podía
    // cambiarlo sin probar que era suyo.
    if (typeof email === "string" && email.trim()) {
      const newEmail = email.trim().toLowerCase();
      const current = await User.findById(uid).select("email");
      if (!current) return res.status(404).json({ error: "USER_NOT_FOUND" });

      if (newEmail !== current.email) {
        const taken = await User.findOne({ email: newEmail, _id: { $ne: uid } });
        if (taken) return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });

        patch.pendingEmail = newEmail;
        patch.pendingEmailRequestedAt = new Date();
        emailChangePending = true;

        const code = generateOtp6();
        const codeHash = hashOtp(code);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_OTP_EXPIRE_MIN * 60 * 1000);
        const resendAvailableAt = new Date(now.getTime() + EMAIL_CHANGE_RESEND_COOLDOWN_SEC * 1000);

        await EmailVerification.deleteMany({ userId: uid });
        await EmailVerification.create({ userId: uid, codeHash, expiresAt, attempts: 0, resendAvailableAt });

        const showOtp = process.env.DEV_SHOW_OTP === "true";
        if (process.env.NODE_ENV === "development" && showOtp) {
          console.log(`🟣 [DEV OTP - EMAIL CHANGE] Email: ${newEmail} | Code: ${code}`);
        } else {
          await sendVerificationEmail({ to: newEmail, code, name: name || undefined });
        }
      }
    }

    // ✅ NUEVO: actualizar género
    if (typeof gender === "string") {
      const g = gender.trim().toLowerCase();
      if (!ALLOWED_GENDERS.has(g)) {
        return res.status(400).json({ error: "BAD_GENDER" });
      }
      patch.gender = g;
    }

    // ✅ Teléfono: se agregó como requerido en el registro nuevo, pero las
    // cuentas viejas no lo tienen -- esto les da forma de sumarlo después
    // (para que también puedan buscarse por teléfono en POS/Kiosk). Mismo
    // formato/validación que en el registro.
    if (typeof phone === "string") {
      const p = phone.trim();
      if (p.length === 0) {
        patch.phone = undefined;
      } else {
        if (!/^\+?[0-9]{10,16}$/.test(p)) {
          return res.status(400).json({ error: "INVALID_PHONE" });
        }
        const taken = await User.findOne({ phone: p, _id: { $ne: uid } });
        if (taken) return res.status(409).json({ error: "PHONE_ALREADY_EXISTS" });
        patch.phone = p;
      }
    }

    // findByIdAndUpdate con $set no borra un campo si el valor es
    // `undefined` (Mongo lo ignora) -- para "quitar" el teléfono hay que
    // pasarlo explícito por $unset en vez de meterlo en el mismo patch.
    const unset = {};
    if (patch.phone === undefined && "phone" in patch) {
      delete patch.phone;
      unset.phone = "";
    }
    const update = Object.keys(unset).length ? { $set: patch, $unset: unset } : patch;

    const updated = await User.findByIdAndUpdate(uid, update, { new: true }).select(
      "name gender username email pendingEmail isEmailVerified avatarConfig phone createdAt"
    );

    return res.json({ ok: true, user: updated, emailChangePending });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "DUPLICATE" });
    console.log("updateMe error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// ✅ Confirma el cambio de correo iniciado en updateMe() -- mismo patrón
// que verifyEmail() en auth.controller.js, pero contra pendingEmail en
// vez del email de registro.
async function confirmEmailChange(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!user.pendingEmail) return res.status(400).json({ error: "NO_EMAIL_CHANGE_PENDING" });

    const record = await EmailVerification.findOne({ userId: uid }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ error: "NO_EMAIL_CHANGE_PENDING" });

    const now = new Date();
    if (now > record.expiresAt) return res.status(400).json({ error: "OTP_EXPIRED" });
    if (record.attempts >= EMAIL_CHANGE_MAX_ATTEMPTS) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

    const incomingHash = hashOtp(String(code));
    if (incomingHash !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "INVALID_CODE", attemptsLeft: EMAIL_CHANGE_MAX_ATTEMPTS - record.attempts });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.pendingEmailRequestedAt = null;
    await user.save();
    await EmailVerification.deleteMany({ userId: uid });

    return res.json({ ok: true, email: user.email });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });
    console.log("confirmEmailChange error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function resendEmailChangeCode(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!user.pendingEmail) return res.status(400).json({ error: "NO_EMAIL_CHANGE_PENDING" });

    const last = await EmailVerification.findOne({ userId: uid }).sort({ createdAt: -1 });
    const now = new Date();
    if (last && now < last.resendAvailableAt) {
      const secondsLeft = Math.ceil((last.resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({ error: "RESEND_COOLDOWN", secondsLeft });
    }

    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + EMAIL_CHANGE_RESEND_COOLDOWN_SEC * 1000);

    await EmailVerification.deleteMany({ userId: uid });
    await EmailVerification.create({ userId: uid, codeHash, expiresAt, attempts: 0, resendAvailableAt });

    const showOtp = process.env.DEV_SHOW_OTP === "true";
    if (process.env.NODE_ENV === "development" && showOtp) {
      console.log(`🟣 [DEV OTP - EMAIL CHANGE RESEND] Email: ${user.pendingEmail} | Code: ${code}`);
    } else {
      await sendVerificationEmail({ to: user.pendingEmail, code, name: user.name });
    }

    return res.json({ ok: true, cooldown: EMAIL_CHANGE_RESEND_COOLDOWN_SEC });
  } catch (err) {
    console.log("resendEmailChangeCode error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// Mismos 2 estilos marcados VIP en el editor (hair_07, hair_f_05) y mismo
// umbral que ya usa RewardsScreen.jsx en el cliente (200 Buddy Coins) --
// aquí es donde ese umbral se vuelve real: antes de esto, cualquiera podía
// guardar un hair VIP llamando la API directo, sin pasar por la pantalla.
const VIP_HAIR_IDS = new Set(["hair_07", "hair_f_05"]);
const VIP_THRESHOLD = 200;
// POS_URL ya está declarado arriba (línea 33), reusado aquí.

const VIP_TRIAL_DAYS = 30;

async function isUserVIP(uid) {
  // ✅ Dos formas de ser VIP sin depender del saldo del POS:
  // 1) Primer mes gratis de toda cuenta nueva (createdAt de los timestamps
  //    de Mongoose) -- prueban todo sin juntar 200 Buddy Coins primero.
  // 2) Pase VIP comprado en la Tienda (vipPass.active + no vencido, ver
  //    confirmVipPass abajo).
  // Si ninguna aplica, cae al chequeo normal de saldo real vía POS.
  try {
    const user = await User.findById(uid).select("createdAt vipPass").lean();
    const ageMs = user?.createdAt ? Date.now() - new Date(user.createdAt).getTime() : Infinity;
    if (ageMs < VIP_TRIAL_DAYS * 24 * 60 * 60 * 1000) return true;
    if (user?.vipPass?.active && user.vipPass.expiresAt && new Date(user.vipPass.expiresAt) > new Date()) {
      return true;
    }
  } catch (err) {
    console.log("isUserVIP trial/pass check error:", err?.message);
  }

  // Un solo blip de red al POS dejaba fuera a un VIP real (falla cerrado).
  // Reintentamos una vez antes de rendirnos.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const posRes = await fetch(`${POS_URL}/wallet/${uid}`, {
        headers: { "x-api-key": process.env.POS_API_KEY || "" },
      });
      if (posRes.status === 404) return false; // sin wallet todavía = saldo $0
      const data = await posRes.json().catch(() => ({}));
      if (!posRes.ok) {
        if (attempt === 0) continue;
        return false;
      }
      return (Number(data?.wallet?.balance) || 0) >= VIP_THRESHOLD;
    } catch (err) {
      console.log(`isUserVIP wallet check error (try ${attempt + 1}):`, err?.message);
      if (attempt === 0) continue;
      return false; // si el wallet no responde tras reintento, no se da acceso VIP
    }
  }
  return false;
}

async function updateAvatar(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { avatarConfig } = req.body || {};
    if (!avatarConfig || typeof avatarConfig !== "object") {
      return res.status(400).json({ error: "BAD_AVATAR" });
    }

    /**
     * ✅ TU CASO ACTUAL:
     * solo guardar "hair" (porque es el avatar completo)
     * y NO reemplazar todo avatarConfig, solo hacer $set a la(s) llave(s).
     */
    const allowed = ["hair"];
    const $set = {};

    for (const k of allowed) {
      if (k in avatarConfig) {
        $set[`avatarConfig.${k}`] = avatarConfig[k];
      }
    }

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: "NO_ALLOWED_FIELDS" });
    }

    if (VIP_HAIR_IDS.has($set["avatarConfig.hair"])) {
      const vip = await isUserVIP(uid);
      if (!vip) return res.status(403).json({ error: "VIP_REQUIRED" });
    }

    const updated = await User.findByIdAndUpdate(uid, { $set }, { new: true }).select("avatarConfig");

    return res.json({ ok: true, avatarConfig: updated.avatarConfig });
  } catch (err) {
    console.log("updateAvatar error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// --- Avatar 3D real -----------------------------------------------------
// Catálogo server-side de ids válidos por slot -- mismo motivo que
// VIP_HAIR_IDS arriba: sin esto, cualquiera podría mandar un id inventado
// por API directo. Debe reflejar exactamente lo que existe en
// src/assets/avatar3dParts.js del cliente -- ACTUALIZAR ambos lados juntos
// cuando se agreguen assets nuevos (ids de ejemplo hasta que el set real de
// modelos 3D quede elegido/importado -- ver plan).
// v2: el cuerpo/cabeza/pelo dejó de ser geometría por partes (hair/head/
// body/outfit/eyebrow/nose/mouth/pose por separado) -- ahora es UN
// personaje completo (modelo .glb real, Kenney CC0) elegido entre 12
// variantes ya diseñadas. `character` reemplaza a todo eso junto;
// `accessory` (lentes/gorra) sigue siendo geometría procedural aparte.
const AVATAR3D_PART_IDS = {
  character: new Set([
    "kenney_male_a", "kenney_male_c", "kenney_male_d", "kenney_male_e", "kenney_male_f",
    "kenney_female_a", "kenney_female_b", "kenney_female_c", "kenney_female_e", "kenney_female_f",
  ]),
  accessory: new Set([null, "acc3d_01", "acc3d_02"]),
  // Tono de piel real (recoloreo de textura, ver avatar3dParts.js del
  // cliente) -- independiente del personaje elegido. null = tono de
  // fábrica del personaje.
  skinTone: new Set([null, "a", "b", "c", "d", "e", "f"]),
};
const AVATAR3D_SLOTS = Object.keys(AVATAR3D_PART_IDS);

const SNAPSHOT_DIR = path.join(__dirname, "..", "..", "uploads", "avatars");
// Mismo dominio que el cliente ya usa como BASE_URL (src/api/client.js) --
// necesitamos la URL ABSOLUTA porque <Image source={{uri}}> en RN no
// resuelve rutas relativas como lo haría un navegador.
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "https://app.londoncafejrz.com";

// PUT /me/avatar3d   body: { parts: {character, accessory} }
async function updateAvatar3D(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { parts } = req.body || {};
    if (!parts || typeof parts !== "object") {
      return res.status(400).json({ error: "BAD_PARTS" });
    }

    const $set = { "avatar3d.owned": true, "avatar3d.updatedAt": new Date() };

    for (const slot of AVATAR3D_SLOTS) {
      if (!(slot in parts)) continue;
      const val = parts[slot];
      if (!AVATAR3D_PART_IDS[slot].has(val)) {
        return res.status(400).json({ error: "INVALID_PART", slot });
      }
      $set[`avatar3d.parts.${slot}`] = val;
    }
    // `character` es obligatorio para tener un avatar completo -- si es
    // la primera vez (no estaba `owned`), lo exige.
    const user0 = await User.findById(uid).select("avatar3d.owned");
    if (!user0) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!user0.avatar3d?.owned && !$set["avatar3d.parts.character"]) {
      return res.status(400).json({ error: "MISSING_PART", slot: "character" });
    }
    if (!$set["avatar3d.createdAt"] && !user0.avatar3d?.owned) {
      $set["avatar3d.createdAt"] = new Date();
    }

    const updated = await User.findByIdAndUpdate(uid, { $set }, { new: true }).select("avatar3d");
    return res.json({ ok: true, avatar3d: updated.avatar3d });
  } catch (err) {
    console.log("updateAvatar3D error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// POST /me/avatar3d/snapshot   body: { imageBase64: "data:image/png;base64,...." }
// Guarda la captura del canvas de three.js (mandada por Avatar3DViewer al
// terminar de personalizar) como PNG en disco local -- sin S3/Cloudinary
// hoy en este backend (confirmado, ver plan), y a esta escala (~40
// usuarios) no se justifica agregar ese costo/complejidad todavía.
async function uploadAvatar3DSnapshot(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { imageBase64 } = req.body || {};
    if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ error: "BAD_IMAGE" });
    }
    const raw = imageBase64.slice("data:image/png;base64,".length);
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 0 || buf.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: "IMAGE_TOO_LARGE" });
    }

    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const fileName = `${uid}.png`;
    fs.writeFileSync(path.join(SNAPSHOT_DIR, fileName), buf);

    // cache-bust con la hora -- el mismo userId reusa el mismo archivo cada
    // vez que regenera su avatar, así que sin esto <Image> se quedaría con
    // la versión vieja cacheada en el cliente.
    const snapshotUrl = `${API_PUBLIC_URL}/uploads/avatars/${fileName}?t=${Date.now()}`;
    const updated = await User.findByIdAndUpdate(
      uid,
      { $set: { "avatar3d.snapshotUrl": snapshotUrl } },
      { new: true }
    ).select("avatar3d");

    return res.json({ ok: true, snapshotUrl, avatar3d: updated.avatar3d });
  } catch (err) {
    console.log("uploadAvatar3DSnapshot error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function savePushToken(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { expoPushToken } = req.body || {};

    console.log("📲 savePushToken called");
console.log("👤 uid:", uid);
console.log("📩 expoPushToken recibido:", expoPushToken);


    if (!expoPushToken) {
      return res.status(400).json({ error: "MISSING_TOKEN" });
    }

    const user = await User.findByIdAndUpdate(
      uid,
      { $set: { expoPushToken } },
      { new: true }
    );


console.log("✅ expoPushToken guardado en BD");
    return res.json({
      ok: true,
      expoPushToken: user.expoPushToken,
    });
  } catch (err) {
    console.log("savePushToken FULL:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}


async function testPush(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    if (!user.expoPushToken) {
      return res.status(400).json({ error: "NO_PUSH_TOKEN" });
    }

    const result = await sendExpoPushNotification(
      user.expoPushToken,
      "London Cafe 🔔",
      "Esta es una prueba de notificación push",
      { type: "test-push" }
    );

    return res.json({ ok: true, result });
  } catch (err) {
    console.log("testPush FULL:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err?.message });
  }
}


async function sendLowEnergyPush(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    // aplica desgaste real antes de revisar energía
    const now = new Date();
    applyEnergyDecay(user, now);

    const energy = Number(user?.buddy?.energy || 0);

    if (!user.expoPushToken) {
      return res.status(400).json({ error: "NO_PUSH_TOKEN" });
    }

    if (!user.buddy) {
      return res.status(400).json({ error: "NO_BUDDY" });
    }

    // si quieres que SOLO mande cuando esté baja:
    if (energy >= 50) {
      return res.status(400).json({
        ok: false,
        error: "ENERGY_NOT_LOW",
        energy,
        message: "La energía aún no está por debajo de 50.",
      });
    }

    const result = await sendExpoPushNotification(
      user.expoPushToken,
      "Tu buddy necesita energía ☕",
      `La energía de tu buddy está en ${energy}%. Entra a darle café o pan.`,
      {
        type: "low-energy",
        energy,
      }
    );

    // opcional: guardar por si applyEnergyDecay cambió energía
    user.markModified("buddy");
    await user.save();

    return res.json({
      ok: true,
      energy,
      result,
    });
  } catch (err) {
    console.log("sendLowEnergyPush FULL:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err?.message,
    });
  }
}

async function sendStreakReminderPush(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    if (!user.expoPushToken) {
      return res.status(400).json({ error: "NO_PUSH_TOKEN" });
    }

    const todayKey = dayKeyLocal(new Date());
    const claimedToday = user?.buddy?.lastClaimDay === todayKey;
    const streakCount = Number(user?.buddy?.streakCount || 0);

    if (claimedToday) {
      return res.status(400).json({
        ok: false,
        error: "ALREADY_CLAIMED_TODAY",
        message: "Hoy ya reclamó su recompensa diaria.",
      });
    }

    const result = await sendExpoPushNotification(
      user.expoPushToken,
      "No pierdas tu racha 🔥",
      streakCount > 0
        ? `Llevas ${streakCount} días de racha. Entra a reclamar tu recompensa de hoy.`
        : "Entra a reclamar tu recompensa diaria y comienza una nueva racha.",
      {
        type: "streak-reminder",
        streakCount,
      }
    );

    return res.json({
      ok: true,
      streakCount,
      result,
    });
  } catch (err) {
    console.log("sendStreakReminderPush FULL:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err?.message,
    });
  }
}
async function deleteMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    // Run all collection cleanup in parallel before deleting the user document.
    // Financial records (Receipt, Sale, GiftCard) are anonymised rather than deleted
    // so accounting history is preserved without retaining any PII.
    await Promise.all([
      // Hard deletes — records that have no value without the user
      EmailVerification.deleteMany({ userId: uid }),
      PointsHistory.deleteMany({ userId: uid }),
      Redemption.deleteMany({ userId: uid }),

      // Anonymise — financial/audit records where userId is just a foreign key
      Receipt.updateMany({ uid }, { $set: { uid: null } }),
      Sale.updateMany({ userId: uid }, { $set: { userId: null } }),
      PointClaim.updateMany({ redeemedBy: uid }, { $set: { redeemedBy: null } }),

      // Anonymise gift cards — the gift itself may still be relevant to the other party
      GiftCard.updateMany({ fromUser: uid }, { $set: { fromUser: null } }),
      GiftCard.updateMany({ toUser: uid }, { $set: { toUser: null } }),
      GiftCard.updateMany({ redeemedBy: uid }, { $set: { redeemedBy: null } }),
    ]);

    // Delete the user document last so a partial failure above can be retried
    // without losing the ability to identify the user.
    await User.findByIdAndDelete(uid);

    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteMe error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", message: err?.message });
  }
}

// ✅ PUT /me/presence  body: { shareEnabled?, atCafe? }
// El cliente calcula la distancia al café él mismo (ver LocationScreen.jsx)
// y solo manda un booleano -- este endpoint NUNCA recibe coordenadas GPS.
// Apagar shareEnabled oculta de inmediato (fuerza atCafe a false), para
// que "dejar de compartir" sea instantáneo y no dependa de que expire el
// último ping.
async function updatePresence(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { shareEnabled, atCafe } = req.body || {};
    const user = await User.findById(uid).select("presence");
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    if (!user.presence) user.presence = { shareEnabled: false, atCafe: false, atCafeUpdatedAt: null };

    if (typeof shareEnabled === "boolean") {
      user.presence.shareEnabled = shareEnabled;
      if (!shareEnabled) {
        user.presence.atCafe = false;
        user.presence.atCafeUpdatedAt = new Date();
      }
    }

    if (typeof atCafe === "boolean" && user.presence.shareEnabled) {
      user.presence.atCafe = atCafe;
      user.presence.atCafeUpdatedAt = new Date();
    }

    user.markModified("presence");
    await user.save();

    return res.json({ ok: true, presence: user.presence });
  } catch (err) {
    console.error("updatePresence error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = {
  updatePresence,
  getMe,
  updateMe,
  confirmEmailChange,
  resendEmailChangeCode,
  updateAvatar,
  updateAvatar3D,
  uploadAvatar3DSnapshot,
  claimReward,
  recoverStreak,
  savePushToken,
  testPush,
  sendLowEnergyPush,
  sendStreakReminderPush,
  deleteMe,
  isUserVIP, // reusado por pet.controller.js para gatear la adopción
};