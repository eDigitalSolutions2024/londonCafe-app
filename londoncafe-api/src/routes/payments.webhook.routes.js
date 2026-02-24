// src/routes/payments.webhook.routes.js
const express = require("express");
const router = express.Router();

const payments = require("../controllers/payments.controller");

// Stripe manda application/json pero se debe leer RAW para firma
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  payments.handleStripeWebhook
);

module.exports = router;