const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { getMe, updateMe, updateAvatar, claimReward, recoverStreak, savePushToken, testPush,sendLowEnergyPush,sendStreakReminderPush,} = require("../controllers/me.controller");

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/avatar", requireAuth, updateAvatar);
// ✅ Daily reward (racha)
router.post("/me/daily-reward", requireAuth, claimReward);
router.post("/me/streak/recover", requireAuth, recoverStreak);
router.post("/me/push-token", requireAuth, savePushToken);
router.post("/me/test-push", requireAuth, testPush);
router.post("/me/push/low-energy", requireAuth, sendLowEnergyPush);
router.post("/me/push/streak-reminder", requireAuth, sendStreakReminderPush);
module.exports = router;
