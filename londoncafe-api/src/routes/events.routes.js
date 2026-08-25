// routes/events.routes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { postEvent } = require("../controllers/events.controller");

router.post("/", requireAuth, postEvent);

module.exports = router;
