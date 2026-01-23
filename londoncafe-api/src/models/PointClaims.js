const mongoose = require("mongoose");

const pointClaimSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    points: { type: Number, required: true }, // puntos que vale ese ticket
    status: { type: String, enum: ["NEW", "REDEEMED", "CANCELED"], default: "NEW" },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    redeemedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }, // opcional
    meta: { type: Object, default: {} }, // total, ticket, sucursal, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model("PointClaim", pointClaimSchema);
