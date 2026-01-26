// controllers/points.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Receipt = require("../models/Receipt"); // ✅ modelo anti-duplicados (receiptId UNIQUE)

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

/** helper: requiere JWT_SECRET */
function getJwtSecret() {
  return process.env.JWT_SECRET;
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
 * ✅ GET /api/points/qr/me  (APP)
 * Genera un QR token temporal para que el POS lo escanee
 */
async function getMyQr(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const secret = getJwtSecret();
    if (!secret) return res.status(500).json({ ok: false, error: "MISSING_JWT_SECRET" });

    const ttlSeconds = 90; // 60-120s recomendado

    const qrToken = jwt.sign(
      {
        typ: "BUDDY_QR",
        uid,
        // nonce opcional para evitar reusos "visibles"
        nonce: Math.random().toString(36).slice(2),
      },
      secret,
      { expiresIn: ttlSeconds }
    );

    return res.json({ ok: true, qrToken, expiresIn: ttlSeconds });
  } catch (err) {
    console.log("getMyQr error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * ✅ POST /api/points/pos/checkout  (POS)
 * body: { qrToken, receiptId, total }
 * - valida qrToken
 * - evita duplicados por receiptId (UNIQUE)
 * - suma puntos al usuario
 */
async function posCheckout(req, res) {
  try {
    const { qrToken, receiptId, total } = req.body || {};
    const cleanToken = String(qrToken || "").trim();
    const cleanReceipt = String(receiptId || "").trim();

    if (!cleanToken) return res.status(400).json({ ok: false, error: "MISSING_QR_TOKEN" });
    if (!cleanReceipt) return res.status(400).json({ ok: false, error: "MISSING_RECEIPT_ID" });

    const secret = getJwtSecret();
    if (!secret) return res.status(500).json({ ok: false, error: "MISSING_JWT_SECRET" });

    // 1) validar token QR (expira solo)
    let payload;
    try {
      payload = jwt.verify(cleanToken, secret);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "QR_INVALID_OR_EXPIRED" });
    }

    if (payload?.typ !== "BUDDY_QR") {
      return res.status(400).json({ ok: false, error: "BAD_QR_TYPE" });
    }

    const uid = String(payload?.uid || "").trim();
    if (!uid) return res.status(400).json({ ok: false, error: "QR_NO_UID" });

    // 2) calcular puntos
    const add = calcPointsFromTotal(total);
    if (add <= 0) return res.status(400).json({ ok: false, error: "NO_POINTS_FOR_TOTAL" });

    // 3) anti-duplicado (receiptId único)
    //    crea primero el receipt; si ya existe -> 409
    try {
      await Receipt.create({
        receiptId: cleanReceipt,
        uid,
        total: Number(total) || 0,
        points: add,
        createdAt: new Date(),
      });
    } catch (e) {
      // si tienes unique index, Mongo tira error de duplicate key
      if (e?.code === 11000) {
        return res.status(409).json({ ok: false, error: "RECEIPT_ALREADY_PROCESSED" });
      }
      console.log("Receipt.create error:", e?.message);
      return res.status(500).json({ ok: false, error: "RECEIPT_SAVE_FAILED" });
    }

    // 4) sumar puntos al usuario + historial
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
      // ⚠️ Si por alguna razón no existe user, el receipt ya quedó creado.
      // (si quieres, luego lo hacemos transaccional con Mongo sessions)
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

module.exports = { getMyPoints, getMyQr, posCheckout };
