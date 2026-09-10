const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getPet, adoptPet, feedPet } = require("../controllers/pet.controller");

const router = Router();

// GET /pet
router.get("/", requireAuth, getPet);
// POST /pet/adopt
router.post("/adopt", requireAuth, adoptPet);
// POST /pet/feed
router.post("/feed", requireAuth, feedPet);

module.exports = router;
