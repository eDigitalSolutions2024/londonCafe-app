module.exports = function posAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || token !== process.env.POS_API_KEY) {
    return res.status(401).json({ ok: false, message: "Unauthorized POS" });
  }
  next();
};
