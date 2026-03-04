const mongoose = require("mongoose");

const avatarSchema = new mongoose.Schema(
  {
    skin: { type: String, default: "skin_01" },
    hair: { type: String, default: "hair_01" },
    top: { type: String, default: "top_01" },
    bottom: { type: String, default: "bottom_01" },
    shoes: { type: String, default: "shoes_01" },
    accessory: { type: String, default: null },
  },
  { _id: false }
);

// ✅ Historial de puntos (opcional pero recomendado)
const pointsHistorySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["EARN", "REDEEM", "ADJUST"], default: "EARN" },
    points: { type: Number, required: true }, // + o -
    source: { type: String, default: "QR" }, // QR / manual / promo / etc
    ref: { type: String, default: null }, // claimCode / ticketId
    note: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ✅ Buddy (energía + inventario + control de recarga por login)
const buddySchema = new mongoose.Schema(
  {
    energy: { type: Number, default: 100, min: 0, max: 100 },

    coffee: { type: Number, default: 1, min: 0 },
    bread: { type: Number, default: 1, min: 0 },

    lastEnergyAt: { type: Date, default: Date.now },
    lastRefillAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    // ✅ Daily reward / rachas
    streakCount: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    lastClaimDay: { type: String, default: "" }, // "YYYY-MM-DD"
    lastStreakDay: { type: String, default: "" }, // "YYYY-MM-DD"

    // ✅ Recovery de racha (1 vez)
    streakPrevCount:   { type: Number, default: 0, min: 0 },
    streakBrokenDay:   { type: String, default: "" }, // "YYYY-MM-DD" (día donde se detectó ruptura)
    streakRecoveryUsed:{ type: Boolean, default: false },

    // ✅ cupones (si los vas a usar)
    coupons: {
      type: [
        {
          id: String,
          type: String,
          title: String,
          description: String,
          createdAt: Date,
          expiresAt: Date,
          redeemedAt: Date,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ✅ Género
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
      required: true,
    },

    // ✅ NUEVO: Teléfono (E.164 recomendado, ej: +16561234567)
    phone: {
      type: String,
      trim: true,
      default: null,
      // opcional: validación básica de E.164 (puedes aflojarla si quieres)
      match: /^\+?[0-9]{10,16}$/,
    },

    // ✅ NUEVO: Fecha de nacimiento
    birthDate: {
      type: Date,
      default: null,
    },

    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
      default: null,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },

    // ✅ Avatar
    avatarConfig: { type: avatarSchema, default: () => ({}) },

    // ✅ Puntos
    points: { type: Number, default: 0 }, // disponibles para canje
    lifetimePoints: { type: Number, default: 0 }, // acumulados históricos
    pointsHistory: { type: [pointsHistorySchema], default: [] },

    // ✅ Buddy
    buddy: { type: buddySchema, default: () => ({}) },
  },
  { timestamps: true }
);

// ✅ Índice unique para phone pero sin romper si está null
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);