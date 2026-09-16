const mongoose = require("mongoose");

// v1 del "gancho social" -- amistad simple entre dos cuentas + una racha
// COMPARTIDA que se calcula al vuelo (no se guarda aparte, ver
// friends.controller.js computeSharedStreak()): compara el streakCount y
// lastClaimDay de la racha diaria que YA existe en buddySchema (User.js)
// para cada usuario. Si ambos reclamaron hoy o ayer (con la misma
// tolerancia de 1 día que ya usa la racha solo), la racha compartida es
// el mínimo de las dos -- no hace falta guardar histórico de fechas por
// pareja, se reusa lo que ya se trackea por usuario.
//
// userA/userB SIEMPRE ordenados (string compare de sus _id) para que solo
// pueda existir UN documento por par de usuarios sin importar quién
// mandó la solicitud -- requestedBy guarda quién fue, para que solo el
// otro lado pueda aceptar/rechazar.
const friendshipSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
friendshipSchema.index({ userB: 1, status: 1 });
friendshipSchema.index({ userA: 1, status: 1 });

module.exports = mongoose.model("Friendship", friendshipSchema);
