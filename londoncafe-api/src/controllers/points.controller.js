// controllers/points.controller.js
const User = require("../models/User");
const Receipt = require("../models/Receipt"); // anti-duplicados (receiptId UNIQUE)

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

    const user = await User.findById(uid).select("points lifetimePoints");
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    return res.json({
      ok: true,
      points: Number(user.points) || 0,
      lifetimePoints: Number(user.lifetimePoints) || 0,
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

    const user = await User.findById(uid).select("_id name username email points lifetimePoints");
    if (!user) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      user,
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

    // sumar puntos al usuario + historial
    const updatedUser = await User.findByIdAndUpdate(
      uid,
      {
        $inc: { points: add, lifetimePoints: add },
        $push: {
          pointsHistory: {
            type: "EARN",
            points: add,
            source: "POS",
            ref: cleanReceipt,
            note: "Compra en caja",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("points lifetimePoints");

    if (!updatedUser) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      added: add,
      points: Number(updatedUser?.points) || 0,
      lifetimePoints: Number(updatedUser?.lifetimePoints) || 0,
      receiptId: cleanReceipt,
    });
  } catch (err) {
    console.log("posCheckout error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = { getMyPoints, getMyQr, posScanQr, posCheckout };