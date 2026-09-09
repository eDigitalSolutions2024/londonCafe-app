const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getMe,
  updateMe,
  confirmEmailChange,
  resendEmailChangeCode,
  updateAvatar,
  claimReward,
  recoverStreak,
  savePushToken,
  testPush,
  sendLowEnergyPush,
  sendStreakReminderPush,
  deleteMe,
} = require("../controllers/me.controller");

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.post("/me/confirm-email", requireAuth, confirmEmailChange);
router.post("/me/resend-email-code", requireAuth, resendEmailChangeCode);
router.delete("/me", requireAuth, deleteMe);
router.put("/me/avatar", requireAuth, updateAvatar);
router.post("/me/daily-reward", requireAuth, claimReward);
router.post("/me/streak/recover", requireAuth, recoverStreak);
router.post("/me/push-token", requireAuth, savePushToken);
router.post("/me/test-push", requireAuth, testPush);
router.post("/me/push/low-energy", requireAuth, sendLowEnergyPush);
router.post("/me/push/streak-reminder", requireAuth, sendStreakReminderPush);

module.exports = router;
