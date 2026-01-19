const mongoose = require("mongoose");

const emailVerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendAvailableAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// elimina docs cuando expiresAt se cumpla (TTL)
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("EmailVerification", emailVerificationSchema);
