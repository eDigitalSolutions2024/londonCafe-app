const { Router } = require("express");

const {
  register,
  verifyEmail,
  resendVerification,
  login,
  me,
} = require("../controllers/auth.controller");

const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();

// públicas
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);

// protegida
router.get("/me", requireAuth, me);

module.exports = router;
