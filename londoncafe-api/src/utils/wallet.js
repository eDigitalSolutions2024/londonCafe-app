// src/utils/wallet.js
//
// Cliente de Wallet V2 (apps/api del POS) para londoncafe-api. Wallet V2 es la
// ÚNICA fuente de BuddyCoins: este backend ya no lee ni escribe user.points /
// lifetimePoints / pointsHistory. Todo pasa por estos helpers, server-a-servidor
// con la misma llave que ya usa el resto de la integración con el POS.
//
// Las funciones que ESCRIBEN (creditBonus, spendCoins, redeemOrder) son
// idempotentes en el POS por la clave que se les pasa: reintentar la misma
// operación nunca duplica el movimiento.

const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";
const TIMEOUT_MS = 8000;

async function posFetch(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${POS_URL}${path}`, {
      method,
      headers: {
        "x-api-key": process.env.POS_API_KEY || "",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** Saldo y total ganado. Sin wallet todavía = 0 (no es un error). Lanza si el POS no responde. */
async function getWallet(userId) {
  const r = await posFetch(`/wallet/${userId}`);
  if (r.status === 404) return { balance: 0, totalEarned: 0 };
  if (!r.ok) throw new Error(`WALLET_UPSTREAM_${r.status}`);
  return {
    balance: Number(r.data?.wallet?.balance) || 0,
    totalEarned: Number(r.data?.wallet?.totalEarned) || 0,
  };
}

/**
 * Devuelve el objeto de usuario con points/lifetimePoints reemplazados por el
 * saldo real de Wallet V2 (mismos nombres, para que las apps ya instaladas
 * sigan funcionando sin cambios). Si el POS no responde, points queda en null
 * en vez de inventar un saldo con el campo legado.
 */
async function withWalletPoints(user) {
  const plain = user && typeof user.toObject === "function" ? user.toObject() : { ...user };
  try {
    const w = await getWallet(String(plain._id));
    return { ...plain, points: w.balance, lifetimePoints: w.totalEarned };
  } catch (err) {
    console.log("withWalletPoints error:", err?.message);
    return { ...plain, points: null, lifetimePoints: null };
  }
}

/** Tope de canje para una compra de `subtotalInPesos` (lo decide el POS: saldo y % máximo de la RewardRule). */
async function getRedeemLimit(userId, subtotalInPesos) {
  const r = await posFetch(`/wallet/${userId}/redeem-limit?subtotal=${encodeURIComponent(subtotalInPesos)}`);
  if (!r.ok) throw new Error(`WALLET_UPSTREAM_${r.status}`);
  return {
    balance: Number(r.data?.balance) || 0,
    maxCoins: Number(r.data?.maxCoins) || 0,
    centavosPerCoin: Number(r.data?.centavosPerCoin) || 50,
    maxRedeemPercent: Number(r.data?.maxRedeemPercent) || 0,
  };
}

/** Canje en una compra de la App. Idempotente por orderId. Devuelve { appliedCoins, discountInPesos }. */
async function redeemOrder(userId, { orderId, requestedCoins, subtotalInPesos }) {
  const r = await posFetch(`/wallet/${userId}/redeem-order`, {
    method: "POST",
    body: { orderId, requestedCoins, subtotalInPesos },
  });
  if (!r.ok) throw new Error(`WALLET_REDEEM_${r.data?.error || r.status}`);
  return {
    appliedCoins: Number(r.data?.appliedCoins) || 0,
    discountInPesos: Number(r.data?.discountInPesos) || 0,
  };
}

/** Abono de una compra de la App sobre lo realmente pagado. Idempotente por orderId (id de la orden del POS). */
async function earnOrder(userId, { orderId, paidInPesos }) {
  const r = await posFetch(`/wallet/${userId}/earn-order`, {
    method: "POST",
    body: { orderId, paidInPesos },
  });
  if (!r.ok) throw new Error(`WALLET_EARN_${r.data?.error || r.status}`);
  return { earnedCoins: Number(r.data?.earnedCoins) || 0 };
}

/** Gasto que no es una orden (recuperar racha, recompensas). Idempotente por idempotencyKey. */
async function spendCoins(userId, { coins, idempotencyKey, reason }) {
  const r = await posFetch(`/wallet/${userId}/spend`, {
    method: "POST",
    body: { coins, idempotencyKey, reason },
  });
  if (r.status === 409) {
    return { ok: false, insufficient: true, balance: Number(r.data?.balance) || 0 };
  }
  if (!r.ok) throw new Error(`WALLET_SPEND_${r.data?.error || r.status}`);
  return { ok: true, balanceAfter: Number(r.data?.transaction?.balanceAfter) };
}

/** Bono (racha, tarjeta de regalo...). Idempotente por `key`. Lanza si no se pudo acreditar. */
async function creditBonus(userId, { coins, key, reason }) {
  const r = await posFetch(`/wallet/${userId}/bonus`, {
    method: "POST",
    body: { coins, dayKey: key, reason },
  });
  if (!r.ok) throw new Error(`WALLET_BONUS_${r.data?.error || r.status}`);
  return { balanceAfter: Number(r.data?.transaction?.balanceAfter) };
}

module.exports = { getWallet, withWalletPoints, getRedeemLimit, redeemOrder, earnOrder, spendCoins, creditBonus };
