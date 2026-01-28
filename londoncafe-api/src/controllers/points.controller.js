// controllers/points.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Receipt = require("../models/Receipt"); // ✅ anti-duplicados (receiptId UNIQUE)

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

/** helper: secret único para QR (NO mezclar con JWT_SECRET si quieres consistencia) */
function getQrSecret() {
  return process.env.QR_JWT_SECRET || "";
}

/** helper: si te llega un deep link tipo londoncafe://qr?token=... extrae el token */
function extractToken(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";

  // quita espacios y newlines
  s = s.replace(/\s+/g, "");

  // intenta URL decode (por si viene %3D etc)
  try {
    s = decodeURIComponent(s);
  } catch {}

  // si viene como deep link con token=
  const m = s.match(/token=([^&]+)/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  // si viene como "qr_token)" o similares, intenta recortar desde eyJ
  const start = s.indexOf("eyJ");
  if (start >= 0) s = s.slice(start);

  // corta por separadores típicos
  s = s.split("&")[0];

  return s;
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
 * 🔥 MEJORA: regresamos qrValue listo para QR: londoncafe://qr?token=<ENCODED>
 */
async function getMyQr(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const secret = getQrSecret();
    if (!secret) return res.status(500).json({ ok: false, error: "MISSING_QR_SECRET" });

    const ttlSeconds = 90; // 60-120s recomendado

    const qrToken = jwt.sign(
      {
        typ: "BUDDY_QR",
        uid,
        nonce: Math.random().toString(36).slice(2),
      },
      secret,
      { expiresIn: ttlSeconds }
    );

    // 🔎 Diagnóstico: un JWT base64url normalmente NO trae "/" ni "+"
    console.log("[APP getMyQr] token hasSlash:", qrToken.includes("/"), "hasPlus:", qrToken.includes("+"));

    // ✅ Esto es lo que debes pintar como QR en la app
    const qrValue = `londoncafe://qr?token=${encodeURIComponent(qrToken)}`;

    return res.json({ ok: true, qrToken, qrValue, expiresIn: ttlSeconds });
  } catch (err) {
    console.log("getMyQr error:", err?.message);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

/**
 * ✅ POST /api/points/pos/scan-qr  (POS)
 * body: { qrToken }  (puede ser token directo o el deep link completo)
 * - valida qrToken
 * - regresa info del usuario (sin sumar puntos)
 */
async function posScanQr(req, res) {
  try {
    const rawIn = req.body?.qrToken;
    const cleanToken = extractToken(rawIn);
    if (!cleanToken) return res.status(400).json({ ok: false, error: "MISSING_QR_TOKEN" });

    const secret = getQrSecret();
    if (!secret) return res.status(500).json({ ok: false, error: "MISSING_QR_SECRET" });

    let payload;
    try {
      payload = jwt.verify(cleanToken, secret); // verifica firma + exp
    } catch (e) {
      return res.status(401).json({ ok: false, error: "QR_INVALID_OR_EXPIRED" });
    }

    if (payload?.typ !== "BUDDY_QR") {
      return res.status(400).json({ ok: false, error: "BAD_QR_TYPE" });
    }

    const uid = String(payload?.uid || "").trim();
    if (!uid) return res.status(400).json({ ok: false, error: "QR_NO_UID" });

    const user = await User.findById(uid).select("_id name username email points lifetimePoints");
    if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    return res.json({ ok: true, user, exp: payload.exp });
  } catch (err) {
    console.log("posScanQr error:", err?.message);
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
    const { receiptId, total } = req.body || {};
    const cleanReceipt = String(receiptId || "").trim();

    const cleanToken = extractToken(req.body?.qrToken);
    if (!cleanToken) return res.status(400).json({ ok: false, error: "MISSING_QR_TOKEN" });
    if (!cleanReceipt) return res.status(400).json({ ok: false, error: "MISSING_RECEIPT_ID" });

    const secret = getQrSecret();
    if (!secret) return res.status(500).json({ ok: false, error: "MISSING_QR_SECRET" });

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
