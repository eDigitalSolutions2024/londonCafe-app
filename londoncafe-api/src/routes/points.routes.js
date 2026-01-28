// routes/points.routes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requireApiKey } = require("../middleware/apiKey.middleware");

const { getMyPoints, getMyQr, posScanQr, posCheckout } = require("../controllers/points.controller");

// APP
router.get("/me", requireAuth, getMyPoints);
router.get("/qr", requireAuth, getMyQr);

// POS
router.post("/pos/scan-qr", requireApiKey, posScanQr);
router.post("/pos/checkout", requireApiKey, posCheckout);

module.exports = router;
