const router = require("express").Router();
const QRCode = require("qrcode");

// GET /api/dev/qr10.png  -> devuelve un PNG con el QR
router.get("/qr10.png", async (req, res) => {
  try {
    const data = "TEST_10_POINTS";
    const png = await QRCode.toBuffer(data, { type: "png", width: 600, margin: 1 });
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (e) {
    res.status(500).json({ ok: false, msg: "QR gen error" });
  }
});

module.exports = router;
