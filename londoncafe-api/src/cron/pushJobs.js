const cron = require("node-cron");
const User = require("../models/User");
const { sendExpoPushNotification } = require("../utils/push");
const { applyEnergyDecay, dayKeyLocal } = require("../utils/buddy");

// 🟡 CADA 10 MINUTOS → revisar energía
cron.schedule("*/10 * * * *", async () => {
  console.log("⏰ Revisando energía de usuarios...");

  const users = await User.find({ expoPushToken: { $exists: true, $ne: "" } });

  for (const user of users) {
    applyEnergyDecay(user, new Date());

    const energy = Number(user?.buddy?.energy || 0);

  if (!user.buddy.energyAlerts) {
  user.buddy.energyAlerts = {
    fifty: false,
    twentyFive: false,
    ten: false,
  };
}

const alerts = user.buddy.energyAlerts;


// 🔔 SOLO UNA notificación por rango

if (energy <= 10 && !alerts.ten) {

  alerts.ten = true;

  await sendExpoPushNotification(
    user.expoPushToken,
    "¡Tu buddy está agotado! 💀",
    `La energía está críticamente baja (${Math.round(energy)}%).`,
    { type: "low-energy-10" }
  );

} else if (energy <= 25 && !alerts.twentyFive) {

  alerts.twentyFive = true;

  await sendExpoPushNotification(
    user.expoPushToken,
    "Tu buddy está cansado 😢",
    `La energía bajó a ${Math.round(energy)}%.`,
    { type: "low-energy-25" }
  );

} else if (energy <= 50 && !alerts.fifty) {

  alerts.fifty = true;

  await sendExpoPushNotification(
    user.expoPushToken,
    "Tu buddy necesita energía ☕",
    `Tu energía está en ${Math.round(energy)}%. Entra a darle café o pan.`,
    { type: "low-energy-50" }
  );
}


// ✅ reset automático
if (energy > 55) alerts.fifty = false;
if (energy > 30) alerts.twentyFive = false;
if (energy > 15) alerts.ten = false;

user.buddy.energyAlerts = alerts;
user.markModified("buddy.energyAlerts");

await user.save();

    
  }
});

// 🔵 TODOS LOS DÍAS 7PM → streak reminder
cron.schedule("0 19 * * *", async () => {
  console.log("⏰ Enviando recordatorios de racha...");

  const users = await User.find({ expoPushToken: { $exists: true, $ne: "" } });

  const todayKey = dayKeyLocal(new Date());

  for (const user of users) {
    const claimedToday = user?.buddy?.lastClaimDay === todayKey;

    if (!claimedToday) {
      const streakCount = Number(user?.buddy?.streakCount || 0);

      await sendExpoPushNotification(
        user.expoPushToken,
        "No pierdas tu racha 🔥",
        streakCount > 0
          ? `Llevas ${streakCount} días. Reclama tu recompensa.`
          : "Empieza tu racha hoy 🔥",
        { type: "streak-reminder" }
      );
    }
  }
});