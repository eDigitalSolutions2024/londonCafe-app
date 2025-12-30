const { Router } = require("express");
const { getPromotions } = require("../controllers/promo.controller");

const router = Router();

router.get("/", getPromotions); // GET /api/promos

module.exports = router;
