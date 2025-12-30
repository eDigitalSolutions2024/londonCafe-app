const { Router } = require("express");
const { getBranches } = require("../controllers/branch.controller");

const router = Router();

router.get("/", getBranches); // GET /api/branches

module.exports = router;
