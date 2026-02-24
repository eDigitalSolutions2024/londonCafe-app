/*// src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const payments = require("../controllers/payments.controller");
const auth = require("../middleware/auth.middleware");

// Crear PaymentIntent / PaymentSheet (requiere login)
router.post("/sheet", auth, payments.createPaymentSheet);

module.exports = router;*/