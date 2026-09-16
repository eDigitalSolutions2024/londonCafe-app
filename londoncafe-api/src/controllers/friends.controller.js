// src/controllers/friends.controller.js
const User = require("../models/User");
const Friendship = require("../models/Friendship");
const { dayKeyLocal } = require("../utils/buddy");

// Copiado de utils/buddy.js (no exportada de ahí) -- misma implementación
// exacta, para no tocar ese archivo por esto.
function gapBetweenKeys(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.floor((db - da) / (24 * 60 * 60 * 1000));
}

// La racha COMPARTIDA no se guarda aparte -- se calcula comparando la
// racha diaria de cada quien (buddy.streakCount/lastClaimDay, la misma
// que ya alimenta "Día 19/28" en Home). Mismo umbral que
// normalizeStreakAutoReset (gap > 1 día = rota): si cualquiera de los
// dos ya perdió su racha personal, la compartida es 0. Si ambos siguen
// vivos, la compartida es el mínimo de las dos -- no puede ser más alta
// que la racha más corta de la pareja.
function computeSharedStreak(userA, userB) {
  const today = dayKeyLocal();
  const aLast = userA?.buddy?.lastClaimDay || "";
  const bLast = userB?.buddy?.lastClaimDay || "";
  if (!aLast || !bLast) return 0;
  if (gapBetweenKeys(aLast, today) > 1) return 0;
  if (gapBetweenKeys(bLast, today) > 1) return 0;
  return Math.min(Number(userA?.buddy?.streakCount) || 0, Number(userB?.buddy?.streakCount) || 0);
}

function sortIds(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a];
}

function publicProfile(u) {
  return {
    userId: String(u._id),
    name: u.username || u.name || "Alguien",
    snapshotUrl: u.avatar3d?.snapshotUrl || null,
  };
}

// GET /friends/search?q=username -- busca por username exacto/parcial
// (no por email, no por nombre completo -- evita que cualquiera encuentre
// a alguien solo sabiendo su nombre real).
async function searchUsers(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const q = String(req.query?.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json({ ok: true, results: [] });

    const users = await User.find({
      _id: { $ne: uid },
      username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, $options: "i" },
    })
      .select("username name avatar3d.snapshotUrl")
      .limit(10)
      .lean();

    // Marca cuáles ya son amigos o tienen solicitud pendiente, para que el
    // cliente no ofrezca "Agregar" dos veces.
    const ids = users.map((u) => u._id);
    const existing = await Friendship.find({
      $or: [
        { userA: uid, userB: { $in: ids } },
        { userB: uid, userA: { $in: ids } },
      ],
    }).lean();
    const statusByUser = new Map();
    for (const f of existing) {
      const otherId = String(f.userA) === String(uid) ? f.userB : f.userA;
      statusByUser.set(String(otherId), f.status);
    }

    const results = users.map((u) => ({
      ...publicProfile(u),
      friendStatus: statusByUser.get(String(u._id)) || null, // null | "pending" | "accepted"
    }));

    return res.json({ ok: true, results });
  } catch (err) {
    console.error("searchUsers ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /friends/request   body: { toUserId }
async function sendRequest(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const { toUserId } = req.body || {};
    if (!toUserId || String(toUserId) === String(uid)) {
      return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
    }

    const target = await User.findById(toUserId).select("_id");
    if (!target) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

    const [userA, userB] = sortIds(uid, toUserId);
    const existing = await Friendship.findOne({ userA, userB });
    if (existing) {
      return res.status(400).json({ ok: false, error: existing.status === "accepted" ? "ALREADY_FRIENDS" : "ALREADY_PENDING" });
    }

    const fr = await Friendship.create({ userA, userB, requestedBy: uid, status: "pending" });
    return res.json({ ok: true, friendshipId: String(fr._id) });
  } catch (err) {
    console.error("sendRequest ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /friends/:id/accept -- solo el lado que NO mandó la solicitud puede aceptar
async function acceptRequest(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const fr = await Friendship.findById(req.params.id);
    if (!fr) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const isParty = String(fr.userA) === String(uid) || String(fr.userB) === String(uid);
    if (!isParty) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    if (String(fr.requestedBy) === String(uid)) {
      return res.status(400).json({ ok: false, error: "CANNOT_ACCEPT_OWN_REQUEST" });
    }
    if (fr.status === "accepted") return res.json({ ok: true });

    fr.status = "accepted";
    fr.acceptedAt = new Date();
    await fr.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("acceptRequest ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// POST /friends/:id/decline -- también sirve para cancelar una solicitud
// que TÚ mandaste, o para eliminar una amistad ya aceptada -- cualquiera
// de las dos partes puede borrar el documento.
async function declineOrRemove(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const fr = await Friendship.findById(req.params.id);
    if (!fr) return res.json({ ok: true }); // ya no existe, nada que hacer
    const isParty = String(fr.userA) === String(uid) || String(fr.userB) === String(uid);
    if (!isParty) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    await Friendship.deleteOne({ _id: fr._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("declineOrRemove ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// GET /friends -- amigos aceptados + racha compartida con cada uno, y las
// solicitudes pendientes (separadas en "entrantes" vs "las que mandé").
async function listFriends(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    const me = await User.findById(uid).select("buddy").lean();

    const docs = await Friendship.find({ $or: [{ userA: uid }, { userB: uid }] }).lean();
    const otherIds = docs.map((f) => (String(f.userA) === String(uid) ? f.userB : f.userA));
    const others = await User.find({ _id: { $in: otherIds } })
      .select("username name avatar3d.snapshotUrl buddy")
      .lean();
    const othersById = new Map(others.map((u) => [String(u._id), u]));

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const f of docs) {
      const otherId = String(f.userA) === String(uid) ? f.userB : f.userA;
      const other = othersById.get(String(otherId));
      if (!other) continue; // cuenta borrada, etc.

      if (f.status === "accepted") {
        friends.push({
          friendshipId: String(f._id),
          ...publicProfile(other),
          sharedStreak: computeSharedStreak(me, other),
        });
      } else if (String(f.requestedBy) === String(uid)) {
        outgoing.push({ friendshipId: String(f._id), ...publicProfile(other) });
      } else {
        incoming.push({ friendshipId: String(f._id), ...publicProfile(other) });
      }
    }

    friends.sort((a, b) => b.sharedStreak - a.sharedStreak);

    return res.json({ ok: true, friends, incoming, outgoing });
  } catch (err) {
    console.error("listFriends ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

module.exports = {
  searchUsers,
  sendRequest,
  acceptRequest,
  declineOrRemove,
  listFriends,
};
