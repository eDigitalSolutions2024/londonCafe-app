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

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

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

    // ✅ nuevo
    avatarConfig: { type: avatarSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
