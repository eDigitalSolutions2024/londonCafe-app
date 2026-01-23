// routes/points.routes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { getMyPoints, claimPoints, adminCreateClaim } = require("../controllers/points.controller");

router.get("/me", requireAuth, getMyPoints);
router.post("/claim", requireAuth, claimPoints);

// ✅ POST /api/points/admin/create
router.post("/admin/create", requireAuth, adminCreateClaim);

module.exports = router;
