// src/utils/push.js
const fetch = require("node-fetch");

async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) throw new Error("Missing expoPushToken");

  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const result = await response.json();
  return result;
}

module.exports = { sendExpoPushNotification };