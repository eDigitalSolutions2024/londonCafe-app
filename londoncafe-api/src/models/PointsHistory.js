const mongoose = require("mongoose");

const PointsHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    saleId: { type: String, required: true },
    points: { type: Number, required: true },
    type: { type: String, enum: ["earn", "redeem"], default: "earn" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PointsHistory", PointsHistorySchema);
