const mongoose = require("mongoose");

// Chat 1:1 entre amigos aceptados. No existe un modelo de "Conversation"
// aparte -- la amistad (Friendship._id) ES la conversación, porque solo
// hay chat 1:1 (no grupos). `to` se guarda explícito (no solo se infiere
// de friendshipId) para poder mandar el push directo sin tener que
// volver a resolver quién es el otro lado en cada mensaje.
const messageSchema = new mongoose.Schema(
  {
    friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Friendship", required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ friendshipId: 1, createdAt: 1 });
messageSchema.index({ to: 1, readAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
