const express = require("express");
const { createOrderFromApp } = require("../controllers/order.controller");

const router = express.Router();

router.post("/online", createOrderFromApp);

module.exports = router;