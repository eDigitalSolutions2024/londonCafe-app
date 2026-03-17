const express = require("express");
const { createOrderFromApp } = require("../controllers/order.controller");

const router = express.Router();

router.post("/from-app", createOrderFromApp);

module.exports = router;