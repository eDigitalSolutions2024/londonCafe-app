const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getPet, adoptPet, feedPet, playPet } = require("../controllers/pet.controller");

const router = Router();

// GET /pet
router.get("/", requireAuth, getPet);
// POST /pet/adopt
router.post("/adopt", requireAuth, adoptPet);
// POST /pet/feed   body: { type: "coffee" | "bread" }
router.post("/feed", requireAuth, feedPet);
// POST /pet/play
router.post("/play", requireAuth, playPet);

module.exports = router;
