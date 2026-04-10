// src/controllers/me.controller.js
const User = require("../models/User");

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

const RECOVERY_COST = 25;

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

    user.markModified("buddy");
    await user.save();

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
      points: user.points,
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

    const current = Number(user.points || 0);
    if (current < RECOVERY_COST) {
      return res.status(400).json({
        ok: false,
        error: "INSUFFICIENT_COINS",
        needed: RECOVERY_COST,
        current,
      });
    }

    // ✅ cobrar
    user.points = current - RECOVERY_COST;

    // ✅ historial (opcional)
    if (Array.isArray(user.pointsHistory)) {
      user.pointsHistory.unshift({
        type: "REDEEM",
        points: -RECOVERY_COST,
        source: "STREAK_RECOVER",
        ref: user.buddy?.streakBrokenDay || null,
        note: "Recover streak",
        createdAt: new Date(),
      });
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
      points: user.points,
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

    // ✅ calcula cuánto falta / si ya está listo
    const refillTimer = getRefillTimer(user, now);

    await user.save();

    const sanitizedUser = await User.findById(uid).select(
      "name gender username email isEmailVerified avatarConfig createdAt buddy points lifetimePoints"
    );

    const canRecover = calcCanRecover(user);

    // ✅ manda el timer junto al user
    return res.json({
      ok: true,
      user: sanitizedUser,
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

async function updateMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { name, username, email, gender } = req.body || {};
    const patch = {};

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

    if (typeof email === "string" && email.trim()) {
      patch.email = email.trim().toLowerCase();
    }

    // ✅ NUEVO: actualizar género
    if (typeof gender === "string") {
      const g = gender.trim().toLowerCase();
      if (!ALLOWED_GENDERS.has(g)) {
        return res.status(400).json({ error: "BAD_GENDER" });
      }
      patch.gender = g;
    }

    const updated = await User.findByIdAndUpdate(uid, patch, { new: true }).select(
      "name gender username email isEmailVerified avatarConfig createdAt"
    );

    return res.json({ ok: true, user: updated });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "DUPLICATE" });
    console.log("updateMe error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
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

    const updated = await User.findByIdAndUpdate(uid, { $set }, { new: true }).select("avatarConfig");

    return res.json({ ok: true, avatarConfig: updated.avatarConfig });
  } catch (err) {
    console.log("updateAvatar error:", err?.message);
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
module.exports = { getMe, updateMe, updateAvatar, claimReward, recoverStreak, savePushToken,testPush, sendLowEnergyPush,sendStreakReminderPush,};