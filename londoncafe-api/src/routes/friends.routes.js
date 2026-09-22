// src/routes/friends.routes.js
const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const friends = require("../controllers/friends.controller");

const router = Router();

// GET /friends/search?q=... -- busca por username
router.get("/search", requireAuth, friends.searchUsers);
// GET /friends -- amigos + racha compartida + solicitudes pendientes
router.get("/", requireAuth, friends.listFriends);
// POST /friends/request   body: { toUserId }
router.post("/request", requireAuth, friends.sendRequest);
// POST /friends/:id/accept
router.post("/:id/accept", requireAuth, friends.acceptRequest);
// POST /friends/:id/decline -- también cancela una solicitud propia o borra una amistad
router.post("/:id/decline", requireAuth, friends.declineOrRemove);
// GET /friends/:id/messages -- chat de esa amistad, marca como leído al abrir
router.get("/:id/messages", requireAuth, friends.listMessages);
// POST /friends/:id/messages   body: { text }
router.post("/:id/messages", requireAuth, friends.sendMessage);

module.exports = router;
