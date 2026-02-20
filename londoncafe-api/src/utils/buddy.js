// src/utils/buddy.js

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function daysPassed(from, to) {
  if (!from) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** ========= Refill Café/Pan (cada 24h desde lastRefillAt) ========= */
function applyDailyRefillOnAppOpen(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  const last = user.buddy.lastRefillAt || user.buddy.lastAppOpenAt || null;

  if (!last) {
    user.buddy.lastRefillAt = now;
    user.buddy.lastAppOpenAt = now;
    return;
  }

  const d = daysPassed(new Date(last), now);
  if (d > 0) {
    user.buddy.coffee = (Number(user.buddy.coffee) || 0) + d;
    user.buddy.bread = (Number(user.buddy.bread) || 0) + d;
    user.buddy.lastRefillAt = now;
  }

  user.buddy.lastAppOpenAt = now;
}

/** ========= Energía (decaimiento por hora) ========= */
function applyEnergyDecay(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  const last = user.buddy.lastEnergyAt ? new Date(user.buddy.lastEnergyAt) : now;
  const hours = Math.floor((now - last) / (60 * 60 * 1000));
  if (hours <= 0) return;

  const DECAY_PER_HOUR = 2; // -48 en 24h
  const current = Number(user.buddy.energy ?? 80);
  const next = clamp(current - hours * DECAY_PER_HOUR, 0, 100);

  user.buddy.energy = next;
  user.buddy.lastEnergyAt = now;
}

function moodFromEnergy(energy) {
  const e = Number(energy) || 0;
  if (e >= 70) return "happy";
  if (e >= 30) return "meh";
  if (e >= 1) return "sad";
  return "dead";
}

/** ========= Timer para “faltan Xh Ym” del refill ========= */
function msToParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { h, m, sec };
}

function getRefillTimer(user, now = new Date()) {
  const last = user?.buddy?.lastRefillAt || null;
  if (!last) {
    return { hasLast: false, ready: true, elapsed: null, remaining: null, next: null };
  }

  const lastDate = new Date(last);
  const elapsedMs = now - lastDate;
  const remainingMs = 24 * 60 * 60 * 1000 - elapsedMs;

  return {
    hasLast: true,
    last: lastDate.toISOString(),
    now: now.toISOString(),
    next: new Date(lastDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    ready: remainingMs <= 0,
    elapsed: msToParts(elapsedMs),
    remaining: remainingMs > 0 ? msToParts(remainingMs) : { h: 0, m: 0, sec: 0 },
  };
}

/** ========= Recompensa diaria + racha (tipo Duolingo) ========= */

/*function dayKeyLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}*/

// ✅ TEST: 1 "día" = 1 minuto
const TEST_DAY_MS = 60 * 1000; // puedes poner 10*1000 para cada 10s

// ✅ Modo test: 1 "día" = 1 minuto
function dayKeyLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // ✅ día local
}

function gapBetweenKeys(a, b) {
  // a,b: "YYYY-MM-DD"
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);

  // medianoche local
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();

  return Math.floor((db - da) / (24 * 60 * 60 * 1000));
}


/*function daysBetweenDayKeys(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);

  // ✅ fechas locales a medianoche
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();

  return Math.floor((db - da) / (24 * 60 * 60 * 1000));
}*/

function daysBetweenDayKeys(a, b) {
  // a y b son strings numéricos
  return Number(b) - Number(a);
}


function ensureDailyReward(user) {
  if (!user.buddy) user.buddy = {};

  if (typeof user.buddy.streakCount !== "number") user.buddy.streakCount = 0;
  if (typeof user.buddy.bestStreak !== "number") user.buddy.bestStreak = 0;

  if (typeof user.buddy.lastClaimDay !== "string") user.buddy.lastClaimDay = "";
  if (typeof user.buddy.lastStreakDay !== "string") user.buddy.lastStreakDay = "";

  if (typeof user.buddy.coins !== "number") user.buddy.coins = 0;

  // ✅ cupones
  if (!Array.isArray(user.buddy.coupons)) user.buddy.coupons = [];
}

function genId(prefix = "coupon") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * ✅ Recompensa según día de semana (1..7)
 * Ajusta números a tu gusto
 */
/**
 * ✅ Recompensas SEMANALES (1..7) — se repiten
 * (excepto día 28 que es BONUS 100)
 */
function calcDailyRewardByWeekDay(weekDay) {
  switch (weekDay) {
    case 1: return { coins: 2, coffee: 0, bread: 0, coupon: null };                 // Día 1
    case 2: return { coins: 0, coffee: 1, bread: 0, coupon: null };                 // Día 2 (Buddy Cafe)
    case 3: return { coins: 3, coffee: 0, bread: 0, coupon: null };                 // Día 3
    case 4: return { coins: 5, coffee: 0, bread: 0, coupon: null };                 // Día 4
    case 5: return { coins: 0, coffee: 1, bread: 1, coupon: null };                 // Día 5 (Cafe + Pan)
    case 6: return { coins: 7, coffee: 0, bread: 0, coupon: null };                 // Día 6
    case 7: return { coins: 8, coffee: 0, bread: 0, coupon: null };                 // Día 7
    default: return { coins: 2, coffee: 0, bread: 0, coupon: null };
  }
}


function grantReward(user, reward, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  // ✅ BuddyCoins reales = user.points (lo que usa tu UI)
  if (reward.coins) {
    const add = Number(reward.coins) || 0;
    user.points = (Number(user.points) || 0) + add;
    user.lifetimePoints = (Number(user.lifetimePoints) || 0) + add; // opcional pero recomendado
  }

  // ✅ extras para alimentar
  if (reward.coffee) user.buddy.coffee = (Number(user.buddy.coffee) || 0) + Number(reward.coffee);
  if (reward.bread)  user.buddy.bread  = (Number(user.buddy.bread)  || 0) + Number(reward.bread);

  // ✅ cupón
  if (reward.coupon) {
    const expiresAt = new Date(now.getTime() + reward.coupon.expiresInDays * 24 * 60 * 60 * 1000);
    user.buddy.coupons.push({
      id: genId("coupon"),
      type: reward.coupon.type,
      title: reward.coupon.title,
      description: reward.coupon.description,
      createdAt: now,
      expiresAt,
      redeemedAt: null,
    });
  }
}

/**
 * Claim explícito (botón “Recompensa diaria”)
 */
/**
 * claimDailyReward(user, now)
 * - 1 vez por "día" (según dayKeyLocal)
 * - si reclamó el "día" anterior => streak++
 * - si se saltó días => streak = 1
 *
 * ✅ IMPORTANTE:
 * Esta función depende de:
 * - ensureDailyReward(user)
 * - dayKeyLocal(now)  -> devuelve el "key" del día (string)
 * - gapBetweenKeys(a,b) -> devuelve cuántos días pasaron entre keys (number)
 * - calcDailyRewardByWeekDay(weekDay)
 * - grantReward(user, reward, now)
 */
function claimDailyReward(user, now = new Date()) {
  ensureDailyReward(user);

  const today = dayKeyLocal(now);

  // ✅ (1) Bloqueo: solo 1 claim por día
  if (user.buddy.lastClaimDay === today) {
    return {
      ok: false,
      reason: "ALREADY_CLAIMED",
      today,
      streak: user.buddy.streakCount,
    };
  }

  // ✅ (2) Calcula "gap" contra el último día que contó para la racha
  const last = user.buddy.lastStreakDay || user.buddy.lastClaimDay || "";

  if (!last) {
    // primera vez
    user.buddy.streakCount = 1;
  } else {
    const gap = gapBetweenKeys(last, today); // 0,1,2...

    if (!Number.isFinite(gap)) {
      // reloj raro / datos corruptos
      user.buddy.streakCount = 1;
    } else if (gap === 1) {
      // ✅ consecutivo (día siguiente)
      user.buddy.streakCount += 1;
    } else {
      // gap === 0 (mismo día) o gap > 1 (se saltó días)
      user.buddy.streakCount = 1;
    }

    /**
     * 🔁 PARA "NORMAL DE RACHA DIARIA" (PRODUCCIÓN):
     * - dayKeyLocal debe ser YYYY-MM-DD (sin horas/minutos)
     * - gapBetweenKeys debe calcular diferencia real en días (con fechas)
     *
     * ✅ EJEMPLO (producción):
     * dayKeyLocal(): "2026-02-13"
     * gapBetweenKeys(): 1 si fue ayer, 2+ si se saltó, 0 si mismo día
     *
     * 🚫 NO uses dayKeyLocal por minuto en producción.
     */
  }

  // ✅ (3) Actualiza best + marca días
  user.buddy.bestStreak = Math.max(user.buddy.bestStreak, user.buddy.streakCount);
  user.buddy.lastStreakDay = today;
  user.buddy.lastClaimDay = today;

  // ✅ (4) Día dentro del ciclo 1..28
const cycleDay = ((user.buddy.streakCount - 1) % 28) + 1;

// ✅ (5) Semana 1..7 (repetible)
const weekDay = ((cycleDay - 1) % 7) + 1;

// ✅ (6) Calcula recompensa (día 28 siempre BONUS)
const reward =
  cycleDay === 28
    ? { coins: 100, coffee: 0, bread: 0, coupon: null }   // ✅ BONUS SIEMPRE
    : calcDailyRewardByWeekDay(weekDay);

grantReward(user, reward, now);

  return {
  ok: true,
  today,
  streak: user.buddy.streakCount,
  bestStreak: user.buddy.bestStreak,
  cycleDay,   // ✅ NUEVO
  weekDay,
  reward,
  buddy: user.buddy,
  points: user.points,
  lifetimePoints: user.lifetimePoints,
};
}

function normalizeStreakAutoReset(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  const today = dayKeyLocal(now);
  const last = user.buddy.lastStreakDay || user.buddy.lastClaimDay || "";
  if (!last) return;

  const gap = gapBetweenKeys(last, today);

  // ✅ si pasaron más de 1 "día" (en test: > 1 minuto), resetea a 0
  if (Number.isFinite(gap) && gap > 1) {
    user.buddy.streakCount = 0;
    user.buddy.lastStreakDay = "";
    // lastClaimDay lo puedes dejar como está o vaciarlo también:
    // user.buddy.lastClaimDay = "";
  }
}


module.exports = {
  applyDailyRefillOnAppOpen,
  applyEnergyDecay,
  moodFromEnergy,
  clamp,

  getRefillTimer,
  msToParts,

  dayKeyLocal,
  claimDailyReward,
   normalizeStreakAutoReset,
};
