const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { getMe, updateMe, updateAvatar, claimReward, recoverStreak, savePushToken} = require("../controllers/me.controller");

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/avatar", requireAuth, updateAvatar);
// ✅ Daily reward (racha)
router.post("/me/daily-reward", requireAuth, claimReward);
router.post("/me/streak/recover", requireAuth, recoverStreak);
router.post("/me/push-token", requireAuth, savePushToken);
module.exports = router;
