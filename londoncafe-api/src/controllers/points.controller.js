// controllers/points.controller.js
const User = require("../models/User");
const PointClaim = require("../models/PointClaims");

/** helper: saca uid del token */
function getUid(req) {
  return req.user?.uid || req.user?.sub || req.user?.userId || req.user?.id || null;
}

/** GET /points/me */
async function getMyPoints(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid).select("points lifetimePoints");
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    return res.json({
      ok: true,
      points: user.points || 0,
      lifetimePoints: user.lifetimePoints || 0,
    });
  } catch (err) {
    console.log("getMyPoints error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

/** POST /points/claim  body: { code: "XXXX" } */
async function claimPoints(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { code } = req.body || {};
    const cleanCode = String(code || "").trim();

    if (!cleanCode) return res.status(400).json({ error: "MISSING_CODE" });

    // 1) buscar el claim
    const claim = await PointClaim.findOne({ code: cleanCode });
    if (!claim) return res.status(404).json({ error: "CODE_NOT_FOUND" });

    // 2) validar expiración
    if (claim.expiresAt && claim.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ error: "CODE_EXPIRED" });
    }

    // 3) validar no usado
    if (claim.usedBy) {
      return res.status(409).json({ error: "CODE_ALREADY_USED" });
    }

    // 4) bloquear el claim y aplicarlo (evita double-claim por race condition)
    //    hacemos update atómico: solo se marca si usedBy sigue en null
    const locked = await PointClaim.findOneAndUpdate(
      { _id: claim._id, usedBy: null },
      { $set: { usedBy: uid, usedAt: new Date() } },
      { new: true }
    );

    if (!locked) {
      return res.status(409).json({ error: "CODE_ALREADY_USED" });
    }

    const add = Number(locked.points) || 0;
    if (add <= 0) return res.status(400).json({ error: "BAD_POINTS" });

    // 5) sumar puntos al usuario + historial
    const updatedUser = await User.findByIdAndUpdate(
      uid,
      {
        $inc: { points: add, lifetimePoints: add },
        $push: {
          pointsHistory: {
            type: "EARN",
            points: add,
            source: "QR",
            ref: locked.code,
            note: "Compra / QR",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("points lifetimePoints");

    return res.json({
      ok: true,
      added: add,
      points: updatedUser?.points || 0,
      lifetimePoints: updatedUser?.lifetimePoints || 0,
      code: locked.code,
    });
  } catch (err) {
    console.log("claimPoints error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// POST /api/points/admin/create  body: { points: 10, expiresInHours?: 72 }
async function adminCreateClaim(req, res) {
  try {
    // 🔒 por ahora simple. Luego lo amarramos a un admin role.
    const { points, expiresInHours = 72 } = req.body || {};
    const pts = Number(points) || 0;
    if (pts <= 0) return res.status(400).json({ error: "BAD_POINTS" });

    let code = randomCode(8);

    // por si choca, reintenta
    for (let i = 0; i < 5; i++) {
      const exists = await PointClaim.findOne({ code });
      if (!exists) break;
      code = randomCode(8);
    }

    const expiresAt = expiresInHours ? new Date(Date.now() + Number(expiresInHours) * 3600 * 1000) : null;

    const created = await PointClaim.create({
      code,
      points: pts,
      expiresAt,
    });

    return res.json({ ok: true, code: created.code, points: created.points, expiresAt: created.expiresAt });
  } catch (err) {
    console.log("adminCreateClaim error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = { getMyPoints, claimPoints, adminCreateClaim };


