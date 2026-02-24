// src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const payments = require("../controllers/payments.controller");
const { requireAuth } = require("../middleware/auth.middleware"); // ✅ aquí

router.post("/sheet", requireAuth, payments.createPaymentSheet);

module.exports = router;