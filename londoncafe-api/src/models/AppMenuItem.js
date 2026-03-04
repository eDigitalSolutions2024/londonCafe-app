const mongoose = require("mongoose");

const AppMenuItemSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    price: Number,
    category: String,
    imageUrl: String,
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    collection: "appmenuitems", // 👈 IMPORTANTÍSIMO: nombre real de la colección
    timestamps: true,
  }
);

module.exports = mongoose.model("AppMenuItem", AppMenuItemSchema);