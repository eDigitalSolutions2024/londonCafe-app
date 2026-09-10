const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getPet,
  adoptPet,
  customizePet,
  feedPet,
  playPet,
  cleanPet,
  sleepPet,
} = require("../controllers/pet.controller");

const router = Router();

// GET /pet
router.get("/", requireAuth, getPet);
// POST /pet/adopt   body: { species, name }
router.post("/adopt", requireAuth, adoptPet);
// POST /pet/customize   body: { species?, name? }
router.post("/customize", requireAuth, customizePet);
// POST /pet/feed    body: { type: "coffee" | "bread" }
router.post("/feed", requireAuth, feedPet);
// POST /pet/play    body: { score }  (0..1)
router.post("/play", requireAuth, playPet);
// POST /pet/clean
router.post("/clean", requireAuth, cleanPet);
// POST /pet/sleep
router.post("/sleep", requireAuth, sleepPet);

module.exports = router;
