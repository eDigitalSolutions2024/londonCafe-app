// routes/points.routes.js
const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");

const { getMyPoints, getMyQr, posCheckout } = require("../controllers/points.controller");

// APP
router.get("/me", requireAuth, getMyPoints);

// APP: generar token QR temporal para mostrar en pantalla
router.get("/qr", requireAuth, getMyQr);

// POS: caja escanea QR + manda receiptId/total para sumar puntos
// (Luego le ponemos middleware de POS KEY)
router.post("/pos/checkout", posCheckout);

module.exports = router;
