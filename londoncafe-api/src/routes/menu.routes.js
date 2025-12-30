const { Router } = require("express");
const { getMenu } = require("../controllers/menu.controller");

const router = Router();

router.get("/", getMenu); // GET /api/menu

module.exports = router;
