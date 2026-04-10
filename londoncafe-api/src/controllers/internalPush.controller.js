const User = require("../models/User");
const { sendExpoPushNotification } = require("../utils/push");

async function sendNewPromoPush(req, res) {
  try {
    const {
      promoId = "",
      title = "Nueva promoción en London Café 🎉",
      description = "",
      tag = "",
      imageUrl = "",
    } = req.body || {};

    const users = await User.find({
      expoPushToken: { $exists: true, $ne: "" },
    }).select("expoPushToken");

    const results = [];

    for (const user of users) {
      try {
        const result = await sendExpoPushNotification(
          user.expoPushToken,
          "Nueva promoción en London Café 🎉",
          title || "Hay una nueva promo disponible.",
          {
            type: "new-promo",
            promoId,
            title,
            description,
            tag,
            imageUrl,
          }
        );

        results.push({ ok: true, result });
      } catch (err) {
        results.push({ ok: false, error: err?.message });
      }
    }

    return res.json({
      ok: true,
      total: users.length,
      results,
    });
  } catch (err) {
    console.log("sendNewPromoPush FULL:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err?.message,
    });
  }
}

module.exports = { sendNewPromoPush };