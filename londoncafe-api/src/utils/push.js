// src/utils/push.js

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

  console.log("📩 Expo push response:", JSON.stringify(result, null, 2));

  if (!response.ok) {
    throw new Error(result?.errors?.[0]?.message || "EXPO_PUSH_FAILED");
  }

  return result;
}

module.exports = { sendExpoPushNotification };