const router = require("express").Router();
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getMe,
  updateMe,
  confirmEmailChange,
  resendEmailChangeCode,
  updateAvatar,
  updateAvatar3D,
  uploadAvatar3DSnapshot,
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
router.put("/me/avatar3d", requireAuth, updateAvatar3D);
// límite propio: el body por defecto de express.json() es 100kb, muy poco
// para un PNG en base64 (la captura del canvas de three.js) -- 4mb es de
// sobra para una snapshot chica y sigue lejos del límite que ya se valida
// en el controller (3mb decodificado).
router.post(
  "/me/avatar3d/snapshot",
  requireAuth,
  express.json({ limit: "4mb" }),
  uploadAvatar3DSnapshot
);
router.post("/me/daily-reward", requireAuth, claimReward);
router.post("/me/streak/recover", requireAuth, recoverStreak);
router.post("/me/push-token", requireAuth, savePushToken);
router.post("/me/test-push", requireAuth, testPush);
router.post("/me/push/low-energy", requireAuth, sendLowEnergyPush);
router.post("/me/push/streak-reminder", requireAuth, sendStreakReminderPush);

module.exports = router;
