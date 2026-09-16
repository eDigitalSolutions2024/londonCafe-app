// src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const payments = require("../controllers/payments.controller");
const { requireAuth } = require("../middleware/auth.middleware"); // ✅ aquí

router.post("/sheet", payments.createPaymentSheet);

// ✅ Tienda -- Pase VIP (ver payments.controller.js). Estas SÍ requieren
// sesión -- necesitan saber quién está comprando para calcular el precio
// (promo del 2do mes) y para activar el pase a la cuenta correcta.
router.get("/vip-pass/status", requireAuth, payments.getVipPassStatus);
router.post("/vip-pass/sheet", requireAuth, payments.createVipPassSheet);
router.post("/vip-pass/confirm", requireAuth, payments.confirmVipPass);

module.exports = router;