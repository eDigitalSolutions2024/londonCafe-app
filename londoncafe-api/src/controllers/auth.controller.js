const bcrypt = require("bcryptjs");
const User = require("../models/User");
const EmailVerification = require("../models/EmailVerification");
const { generateOtp6, hashOtp } = require("../utils/otp");
const { sendVerificationEmail } = require("../utils/email");
const { signAccessToken } = require("../utils/tokens");

const OTP_EXPIRE_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").toLowerCase());
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: "MISSING_FIELDS" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "INVALID_EMAIL" });
    if (String(password).length < 8) return res.status(400).json({ error: "WEAK_PASSWORD" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "EMAIL_ALREADY_EXISTS" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      isEmailVerified: false,
    });

    // OTP
    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

    await EmailVerification.create({
      userId: user._id,
      codeHash,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    });

    //await sendVerificationEmail({ to: user.email, code });

    const showOtp = process.env.DEV_SHOW_OTP === "true";

    if (process.env.NODE_ENV === "development" && showOtp) {
    console.log(`🟣 [DEV OTP] Email: ${user.email} | Code: ${code}`);
    } else {
    await sendVerificationEmail({ to: user.email, code });
    }


    return res.json({ ok: true, next: "VERIFY_EMAIL", email: user.email, cooldown: RESEND_COOLDOWN_SEC });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });

    const record = await EmailVerification.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ error: "NO_VERIFICATION_PENDING" });

    const now = new Date();
    if (now > record.expiresAt) return res.status(400).json({ error: "OTP_EXPIRED" });
    if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

    const incomingHash = hashOtp(String(code));
    if (incomingHash !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "INVALID_CODE", attemptsLeft: MAX_ATTEMPTS - record.attempts });
    }

    user.isEmailVerified = true;
    await user.save();
    await EmailVerification.deleteMany({ userId: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });

    const last = await EmailVerification.findOne({ userId: user._id }).sort({ createdAt: -1 });
    const now = new Date();

    if (last && now < last.resendAvailableAt) {
      const secondsLeft = Math.ceil((last.resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({ error: "RESEND_COOLDOWN", secondsLeft });
    }

    const code = generateOtp6();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MIN * 60 * 1000);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

    await EmailVerification.create({
      userId: user._id,
      codeHash,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    });

    //await sendVerificationEmail({ to: user.email, code });
    const showOtp = process.env.DEV_SHOW_OTP === "true";

    if (process.env.NODE_ENV === "development" && showOtp) {
    console.log(`🟣 [DEV OTP - RESEND] Email: ${user.email} | Code: ${code}`);
    } else {
    await sendVerificationEmail({ to: user.email, code });
    }


    return res.json({ ok: true, cooldown: RESEND_COOLDOWN_SEC });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "MISSING_FIELDS" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    if (!user.isEmailVerified) return res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = signAccessToken({ uid: user._id });

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

async function me(req, res) {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user.uid).select("_id name email isEmailVerified");
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, isEmailVerified: user.isEmailVerified },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

module.exports = { register, verifyEmail, resendVerification, login, me };


