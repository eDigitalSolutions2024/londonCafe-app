const mongoose = require("mongoose");

const RedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    rewardType: {
      type: String,
      enum: ["coffee_free", "bread_free"],
      required: true,
    },

    costPoints: { type: Number, required: true },

    status: {
      type: String,
      enum: ["created", "consumed", "expired"],
      default: "created",
      index: true,
    },

    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    consumedBy: { type: String, default: null },
  },
  { timestamps: true }
);

RedemptionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Redemption", RedemptionSchema);
