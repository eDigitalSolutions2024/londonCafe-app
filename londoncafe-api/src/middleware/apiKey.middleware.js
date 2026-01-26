function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  const expected = process.env.POS_API_KEY;

  if (!expected) return res.status(500).json({ error: "POS_API_KEY_NOT_SET" });
  if (!key || String(key) !== String(expected)) {
    return res.status(401).json({ error: "INVALID_API_KEY" });
  }
  next();
}

module.exports = { requireApiKey };
