const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { getMe, updateMe, updateAvatar } = require("../controllers/me.controller");

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/avatar", requireAuth, updateAvatar);

module.exports = router;
