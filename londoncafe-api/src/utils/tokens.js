const jwt = require("jsonwebtoken");

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { signAccessToken };
