function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function daysPassed(from, to) {
  if (!from) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ✅ Nuevo nombre y propiedades: recarga diaria al abrir app
function applyDailyRefillOnAppOpen(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  // usa lastRefillAt o lastAppOpenAt como última apertura
  const last = user.buddy.lastRefillAt || user.buddy.lastAppOpenAt || null;

  // primera vez: solo marca fecha
  if (!last) {
    user.buddy.lastRefillAt   = now;
    user.buddy.lastAppOpenAt = now;
    return;
  }

  // cuántos días han pasado desde el último refill/apertura
  const d = daysPassed(new Date(last), now);
  if (d > 0) {
    // acumula +1 café y +1 pan por día de diferencia
    user.buddy.coffee = (Number(user.buddy.coffee) || 0) + d;
    user.buddy.bread  = (Number(user.buddy.bread)  || 0) + d;

    // opcional: cap para no acumular infinito
    // user.buddy.coffee = Math.min(user.buddy.coffee, 10);
    // user.buddy.bread  = Math.min(user.buddy.bread, 10);

    user.buddy.lastRefillAt = now;
  }

  // actualiza última apertura de la app
  user.buddy.lastAppOpenAt = now;
}

function applyEnergyDecay(user, now = new Date()) {
  if (!user.buddy) user.buddy = {};

  const last = user.buddy.lastEnergyAt ? new Date(user.buddy.lastEnergyAt) : now;
  const hours = Math.floor((now - last) / (60 * 60 * 1000));
  if (hours <= 0) return;

  const DECAY_PER_HOUR = 2; // 2 puntos de energía por hora = -48 en 24h

  const current = Number(user.buddy.energy ?? 80);
  const next = clamp(current - hours * DECAY_PER_HOUR, 0, 100);

  user.buddy.energy = next;
  user.buddy.lastEnergyAt = now;
}

function moodFromEnergy(energy) {
  const e = Number(energy) || 0;
  if (e >= 70) return "happy";
  if (e >= 30) return "meh";
  if (e >= 1)  return "sad";
  return "dead";
}

// ✅ exporta la nueva función en lugar de applyLoginRefill
module.exports = {
  applyDailyRefillOnAppOpen,
  applyEnergyDecay,
  moodFromEnergy,
  clamp,
};
