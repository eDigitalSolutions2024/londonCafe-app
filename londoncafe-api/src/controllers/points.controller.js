// controllers/points.controller.js
const User = require("../models/User");
const Receipt = require("../models/Receipt"); // anti-duplicados (receiptId UNIQUE)
const { getWallet, withWalletPoints, creditBonus } = require("../utils/wallet");

/** helper: saca uid del token (tu auth normal) */
function getUid(req) {
  return req.user?.uid || req.user?.sub || req.user?.userId || req.user?.id || null;
}

/** helper: puntos por compra (ajústalo) */
function calcPointsFromTotal(total) {
  // ejemplo: 1 punto por cada $10
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.floor(t / 10);
}

/** helper: extrae uid desde un QR fijo tipo lc_user:USER_ID */
function extractUidFromQr(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";

  s = s.replace(/\s+/g, "");

  if (!s.startsWith("lc_user:")) return "";

  return s.replace("lc_user:", "").trim();
}

/** GET /api/points/me */
async function getMyPoints(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    // Wallet V2 es la única fuente de saldo (ya no se lee user.points).
    const user = await User.findById(uid).select("_id");
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const w = await getWallet(uid);
    return res.json({
      ok: true,
      points: w.balance,
      lifetimePoints: w.totalEarned,
    });
  } catch (err) {
    console.log("getMyPoints error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * GET /api/points/qr/me  (APP)
 * Ya no genera JWT temporal.
 * Regresa un QR fijo por usuario.
 */
async function getMyQr(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const qrValue = `lc_user:${uid}`;

    return res.json({
      ok: true,
      qrValue,
      permanent: true,
    });
  } catch (err) {
    console.log("getMyQr error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * POST /api/points/pos/scan-qr  (POS)
 * body: { qrToken }
 * - recibe un QR fijo tipo lc_user:USER_ID
 * - regresa info del usuario (sin sumar puntos)
 */
async function posScanQr(req, res) {
  try {
    const uid = extractUidFromQr(req.body?.qrToken);
    if (!uid) {
      return res.status(400).json({ ok: false, error: "QR_INVALID" });
    }

    const user = await User.findById(uid).select("_id name username email");
    if (!user) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      user: await withWalletPoints(user),
    });
  } catch (err) {
    console.log("posScanQr error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * POST /api/points/pos/checkout  (POS)
 * body: { qrToken, receiptId, total }
 * - recibe un QR fijo tipo lc_user:USER_ID
 * - evita duplicados por receiptId (UNIQUE)
 * - suma puntos al usuario
 */
async function posCheckout(req, res) {
  try {
    const { receiptId, total } = req.body || {};
    const cleanReceipt = String(receiptId || "").trim();

    const uid = extractUidFromQr(req.body?.qrToken);
    if (!uid) return res.status(400).json({ ok: false, error: "QR_INVALID" });
    if (!cleanReceipt) return res.status(400).json({ ok: false, error: "MISSING_RECEIPT_ID" });

    // calcular puntos
    const add = calcPointsFromTotal(total);
    if (add <= 0) return res.status(400).json({ ok: false, error: "NO_POINTS_FOR_TOTAL" });

    // anti-duplicado
    try {
      await Receipt.create({
        receiptId: cleanReceipt,
        uid,
        total: Number(total) || 0,
        points: add,
        createdAt: new Date(),
      });
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({ ok: false, error: "RECEIPT_ALREADY_PROCESSED" });
      }
      console.log("Receipt.create error:", e?.message);
      return res.status(500).json({ ok: false, error: "RECEIPT_SAVE_FAILED" });
    }

    // Abono en Wallet V2 (única fuente de saldo). Idempotente por recibo: si
    // el POS reintenta, el POS de Wallet no duplica el movimiento.
    const user = await User.findById(uid).select("_id");
    if (!user) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    let credited;
    try {
      credited = await creditBonus(uid, {
        coins: add,
        key: `RECEIPT-${cleanReceipt}`,
        reason: "Compra en caja",
      });
    } catch (walletErr) {
      // Sin abono no debe quedar el recibo marcado como procesado: el POS
      // podrá reintentar (la clave RECEIPT-<id> evita duplicar el abono).
      await Receipt.deleteOne({ receiptId: cleanReceipt }).catch(() => {});
      console.log("posCheckout wallet error:", walletErr?.message);
      return res.status(502).json({ ok: false, error: "WALLET_UNAVAILABLE" });
    }

    const w = await getWallet(uid);
    return res.json({
      ok: true,
      added: add,
      points: w.balance,
      lifetimePoints: w.totalEarned,
      receiptId: cleanReceipt,
      balanceAfter: credited.balanceAfter,
    });
  } catch (err) {
    console.log("posCheckout error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// Mismo POS_URL/POS_API_KEY que ya usa order.controller.js para hablar con
// apps/api -- server-a-servidor, la app nunca ve esta llave (decisión #2,
// apps/api/src/modules/wallet/ARCHITECTURE.md §6).
const POS_URL = process.env.POS_URL || "https://api.londoncafejrz.com/api";

/**
 * GET /api/points/wallet  (APP)
 * Proxy de solo lectura hacia GET /api/wallet/:userId de apps/api (Wallet
 * V2, ADR-001). Sin wallet todavía (usuario no migrado y sin ningún Earn
 * todavía) no es un error: significa saldo $0 en Wallet V2.
 */
async function getMyWallet(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const posRes = await fetch(`${POS_URL}/wallet/${uid}`, {
      headers: { "x-api-key": process.env.POS_API_KEY || "" },
    });

    if (posRes.status === 404) {
      return res.json({ ok: true, migrated: false, wallet: null });
    }

    const data = await posRes.json().catch(() => ({}));
    if (!posRes.ok) {
      console.log("getMyWallet POS error:", posRes.status, data);
      return res.status(502).json({ ok: false, error: "WALLET_UPSTREAM_ERROR" });
    }

    return res.json({ ok: true, migrated: true, wallet: data.wallet });
  } catch (err) {
    console.log("getMyWallet error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * GET /api/points/wallet/transactions?limit=  (APP)
 * Proxy de solo lectura hacia GET /api/wallet/:userId/transactions de
 * apps/api. Historial real del Ledger de Wallet V2 -- más detallado que
 * pointsHistory (legado).
 */
async function getMyWalletTransactions(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const posRes = await fetch(`${POS_URL}/wallet/${uid}/transactions?limit=${limit}`, {
      headers: { "x-api-key": process.env.POS_API_KEY || "" },
    });

    const data = await posRes.json().catch(() => ({}));
    if (!posRes.ok) {
      console.log("getMyWalletTransactions POS error:", posRes.status, data);
      return res.status(502).json({ ok: false, error: "WALLET_UPSTREAM_ERROR" });
    }

    return res.json({ ok: true, transactions: data.transactions || [] });
  } catch (err) {
    console.log("getMyWalletTransactions error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * GET /api/points/reward-rule  (APP)
 * Fase 1 (ecosistema digital de ventas): proxy de solo lectura hacia
 * GET /api/wallet/reward-rule/active de apps/api -- earnRate/redeemRate
 * reales, para que la App muestre un preview de "vas a ganar X BuddyCoins"
 * en el carrito sin hardcodear la tasa (que se desincronizaría si cambia).
 */
async function getRewardRule(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const posRes = await fetch(`${POS_URL}/wallet/reward-rule/active`, {
      headers: { "x-api-key": process.env.POS_API_KEY || "" },
    });
    const data = await posRes.json().catch(() => ({}));
    if (!posRes.ok) {
      console.log("getRewardRule POS error:", posRes.status, data);
      return res.status(502).json({ ok: false, error: "WALLET_UPSTREAM_ERROR" });
    }

    return res.json({ ok: true, rewardRule: data.rewardRule });
  } catch (err) {
    console.log("getRewardRule error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { getMyPoints, getMyQr, posScanQr, posCheckout, getMyWallet, getMyWalletTransactions, getRewardRule };