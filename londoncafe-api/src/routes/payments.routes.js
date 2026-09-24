// src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const payments = require("../controllers/payments.controller");
const { requireAuth } = require("../middleware/auth.middleware"); // ✅ aquí

// ⚠️ Antes SIN requireAuth -- req.user siempre era undefined, así que
// metadata.userId del PaymentIntent quedaba vacío (y encima leía
// req.user?.id, un campo que ni el middleware llena -- el real es
// req.user.uid). Eso dejaba la puerta abierta a: (a) mandar el
// loyaltyUserId de OTRA cuenta en el body para usar sus cupones
// personales sin ser esa cuenta, y (b) un PaymentIntent sin dueño
// verificable, que createOrderFromApp (order.controller.js) tampoco
// revisaba -- la cadena completa de "quién pagó esto" no se verificaba
// en ningún punto. Ver ese archivo para el resto de la corrección.
router.post("/sheet", requireAuth, payments.createPaymentSheet);

// ✅ Tienda -- Pase VIP (ver payments.controller.js). Estas SÍ requieren
// sesión -- necesitan saber quién está comprando para calcular el precio
// (promo del 2do mes) y para activar el pase a la cuenta correcta.
router.get("/vip-pass/status", requireAuth, payments.getVipPassStatus);
router.post("/vip-pass/sheet", requireAuth, payments.createVipPassSheet);
router.post("/vip-pass/confirm", requireAuth, payments.confirmVipPass);

module.exports = router;