const express = require("express");
const {
  createOrderFromApp,
  getMyOrders,
} = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/test", (_req, res) => {
  res.json({ ok: true, route: "orders route alive" });
});

// ⚠️ Antes SIN requireAuth -- cualquiera podía llamar /from-app con
// cualquier userId en el body y hacerse acreditar Buddy Coins de gusto
// (createOrderFromApp usaba req.body.userId como respaldo, y el total
// que se usaba para calcular los coins también venía del body, sin
// verificar contra Stripe). /my/:userId tampoco verificaba que el
// :userId de la URL fuera quien está pidiendo -- cualquiera podía leer
// el historial de pedidos de cualquier otra cuenta. Ver order.controller.js
// para el resto de la corrección (usa req.user.uid, ya no el body/URL).
router.get("/my/:userId", requireAuth, getMyOrders);
router.post("/from-app", requireAuth, createOrderFromApp);

module.exports = router;