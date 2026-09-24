// londoncafe-api/src/models/GiftCard.js
const mongoose = require("mongoose");

const GiftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },

    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "MXN" },

    // Quien compra / regala
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // A quien se le envía (puede ser null hasta que exista el usuario)
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    toEmail: { type: String, default: null },

    message: { type: String, default: "" },

    status: {
      type: String,
      enum: ["ACTIVE", "REDEEMED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },

    redeemedAt: { type: Date, default: null },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    expiresAt: { type: Date, default: null },

    // Id del PaymentIntent de Stripe que pagó esta tarjeta -- clave para
    // que la creación sea idempotente (ver createGiftCardForPaymentIntent
    // en routes/giftcards.js): tanto /purchase/confirm como el webhook de
    // Stripe pueden intentar crear la misma tarjeta, y con esto el
    // segundo intento encuentra la ya creada en vez de duplicarla.
    paymentIntentId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GiftCard", GiftCardSchema);