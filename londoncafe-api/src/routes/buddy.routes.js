const { Router } = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { feedBuddy } = require("../controllers/buddy.controller");

const router = Router();

// POST /buddy/feed
router.post("/feed", requireAuth, feedBuddy);

module.exports = router;
