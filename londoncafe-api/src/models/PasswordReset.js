const mongoose = require("mongoose");

// Mismo patrón que EmailVerification.js -- código OTP hasheado con TTL,
// no un link de reset. Evita necesitar deep-linking nativo (universal
// links/App links) para volver a la app desde el correo.
const passwordResetSchema = new mongoose.Schema(
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
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordReset", passwordResetSchema);
