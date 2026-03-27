const express = require("express");
const {
  createOrderFromApp,
  getMyOrders,
} = require("../controllers/order.controller");

const router = express.Router();

router.get("/test", (_req, res) => {
  res.json({ ok: true, route: "orders route alive" });
});

router.get("/my/:userId", getMyOrders);
router.post("/from-app", createOrderFromApp);

module.exports = router;