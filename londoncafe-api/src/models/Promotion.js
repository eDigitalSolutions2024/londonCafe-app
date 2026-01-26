const mongoose = require("mongoose");

const PromotionSchema = new mongoose.Schema(
  {
    legacyId: { type: Number, index: true }, // opcional, por compatibilidad con data.js

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    tag: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },

    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Promotion", PromotionSchema);
