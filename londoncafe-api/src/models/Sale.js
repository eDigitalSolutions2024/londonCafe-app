const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {
    saleId: { type: String, required: true, unique: true, index: true }, // evita duplicados
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    total: { type: Number, required: true },
    currency: { type: String, default: "MXN" },
    itemsCount: { type: Number, default: 0 },

    paidAt: { type: Date, required: true },
    branch: { type: String, default: "LondonCafe-JRZ" },
    source: { type: String, default: "POS" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", SaleSchema);
