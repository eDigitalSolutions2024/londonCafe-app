function requireInternalKey(req, res, next) {
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.INTERNAL_PUSH_KEY) {
    return res.status(401).json({ error: "BAD_INTERNAL_KEY" });
  }
  next();
}

module.exports = { requireInternalKey };