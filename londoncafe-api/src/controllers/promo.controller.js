const Promotion = require("../models/Promotion");

function mapOut(p) {
  return {
    id: typeof p.legacyId === "number" ? p.legacyId : String(p._id),
    _id: String(p._id),

    title: p.title,
    description: p.description,
    tag: p.tag,
    imageUrl: p.imageUrl,

    active: p.active,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    priority: p.priority,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// APP (público): solo promos activas y vigentes
async function getPromotions(req, res) {
  try {
    const now = new Date();
    const query = {
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    };

    const promos = await Promotion.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    return res.json(promos.map(mapOut));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// POS (admin): ver todo
async function getPromotionsAdmin(req, res) {
  try {
    const promos = await Promotion.find({})
      .sort({ active: -1, priority: -1, createdAt: -1 })
      .lean();
    return res.json(promos.map(mapOut));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// POS (admin): crear
async function createPromotion(req, res) {
  try {
    const {
      title,
      description,
      tag,
      imageUrl,
      active,
      startsAt,
      endsAt,
      priority,
      legacyId,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "TITLE_REQUIRED" });
    }

    const doc = await Promotion.create({
      legacyId: typeof legacyId === "number" ? legacyId : undefined,
      title: String(title).trim(),
      description: String(description || "").trim(),
      tag: String(tag || "").trim(),
      imageUrl: String(imageUrl || "").trim(),
      active: active !== false,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      priority: Number(priority || 0),
    });

    return res.json(mapOut(doc));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// POS (admin): editar
async function updatePromotion(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};

    const upd = {
      ...(patch.title !== undefined ? { title: String(patch.title).trim() } : {}),
      ...(patch.description !== undefined ? { description: String(patch.description || "").trim() } : {}),
      ...(patch.tag !== undefined ? { tag: String(patch.tag || "").trim() } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: String(patch.imageUrl || "").trim() } : {}),
      ...(patch.active !== undefined ? { active: !!patch.active } : {}),
      ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt ? new Date(patch.startsAt) : null } : {}),
      ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt ? new Date(patch.endsAt) : null } : {}),
      ...(patch.priority !== undefined ? { priority: Number(patch.priority || 0) } : {}),
    };

    if (upd.title !== undefined && !upd.title) {
      return res.status(400).json({ error: "TITLE_REQUIRED" });
    }

    const doc = await Promotion.findByIdAndUpdate(id, upd, { new: true });
    if (!doc) return res.status(404).json({ error: "PROMO_NOT_FOUND" });

    return res.json(mapOut(doc));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

// POS (admin): borrar
async function deletePromotion(req, res) {
  try {
    const { id } = req.params;
    const doc = await Promotion.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "PROMO_NOT_FOUND" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = {
  getPromotions,
  getPromotionsAdmin,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
