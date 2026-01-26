// models/Receipt.js
const mongoose = require("mongoose");

const ReceiptSchema = new mongoose.Schema({
  receiptId: { type: String, required: true, unique: true, index: true },
  uid: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
  total: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Receipt", ReceiptSchema);
