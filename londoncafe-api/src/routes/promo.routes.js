const { Router } = require("express");
const {
  getPromotions,
  getPromotionsAdmin,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require("../controllers/promo.controller");

const { requireApiKey } = require("../middleware/apiKey.middleware");

const router = Router();

// Público (APP)
router.get("/", getPromotions); // GET /api/promos

// Admin (POS)
router.get("/admin", requireApiKey, getPromotionsAdmin);
router.post("/", requireApiKey, createPromotion);
router.put("/:id", requireApiKey, updatePromotion);
router.delete("/:id", requireApiKey, deletePromotion);

module.exports = router;
