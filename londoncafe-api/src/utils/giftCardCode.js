// londoncafe-api/src/utils/giftCardCode.js
const crypto = require("crypto");

// Ej: LCJ-AB12-CD34-EF56
function formatCode(raw) {
  const upper = raw.toUpperCase();
  return `LCJ-${upper.slice(0, 4)}-${upper.slice(4, 8)}-${upper.slice(8, 12)}`;
}

function generateGiftCardCode() {
  // 6 bytes => 12 hex chars
  const raw = crypto.randomBytes(6).toString("hex");
  return formatCode(raw);
}

module.exports = { generateGiftCardCode };