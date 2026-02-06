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
    points: { type: Number, required: true },          // + o -
    source: { type: String, default: "QR" },           // QR / manual / promo / etc
    ref: { type: String, default: null },              // claimCode / ticketId
    note: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ✅ Buddy (energía + inventario + control de recarga por login)
const buddySchema = new mongoose.Schema(
  {
    energy: { type: Number, default: 80, min: 0, max: 100 },

    // inventario acumulable
    coffee: { type: Number, default: 0, min: 0 },
    bread: { type: Number, default: 0, min: 0 },

    // timestamps para lógica "solo cuando entra"
    lastEnergyAt: { type: Date, default: Date.now }, // última vez que calculaste decaimiento
    lastRefillAt: { type: Date, default: null },     // última vez que diste +1/+1
    lastLoginAt: { type: Date, default: null },      // tracking
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

     // ✅ NUEVO: Género
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
      required: true,
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

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },

    // ✅ Avatar
    avatarConfig: { type: avatarSchema, default: () => ({}) },

    // ✅ Puntos
    points: { type: Number, default: 0 },          // disponibles para canje
    lifetimePoints: { type: Number, default: 0 },  // acumulados históricos
    pointsHistory: { type: [pointsHistorySchema], default: [] },

    // ✅ Buddy
    buddy: { type: buddySchema, default: () => ({}) },
  },
  { timestamps: true }
);



module.exports = mongoose.model("User", userSchema);
