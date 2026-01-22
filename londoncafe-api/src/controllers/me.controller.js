const User = require("../models/User");

/** helper: saca uid del token */
function getUid(req) {
  // tu middleware dice: req.user = payload // { uid: ... }
  return req.user?.uid || req.user?.sub || req.user?.userId || req.user?.id || null;
}

async function getMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const user = await User.findById(uid).select(
      "name username email isEmailVerified avatarConfig createdAt"
    );

    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    return res.json({ ok: true, user });
  } catch (err) {
    console.log("getMe error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function updateMe(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "BAD_TOKEN" });

    const { name, username, email } = req.body || {};
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
      // opcional: si cambias email, marca no verificado
      // patch.isEmailVerified = false;
    }

    const updated = await User.findByIdAndUpdate(uid, patch, { new: true })
      .select("name username email isEmailVerified avatarConfig createdAt");

    return res.json({ ok: true, user: updated });
  } catch (err) {
    // duplicate key (email/username)
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

    // ✅ whitelist (solo permitimos estas llaves)
    const allowed = ["skin", "hair", "top", "bottom", "shoes", "accessory"];
    const clean = {};
    for (const k of allowed) {
      if (k in avatarConfig) clean[k] = avatarConfig[k];
    }

    const updated = await User.findByIdAndUpdate(
      uid,
      { $set: { avatarConfig: clean } },
      { new: true }
    ).select("avatarConfig");

    return res.json({ ok: true, avatarConfig: updated.avatarConfig });
  } catch (err) {
    console.log("updateAvatar error:", err?.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = { getMe, updateMe, updateAvatar };
