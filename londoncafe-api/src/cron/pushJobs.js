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

    if (energy < 50 && !user?.buddy?.lowEnergyNotified) {
      await sendExpoPushNotification(
        user.expoPushToken,
        "Tu buddy necesita energía ☕",
        `Tu energía está en ${energy}%. Entra a darle café o pan.`,
        { type: "low-energy" }
      );

      user.buddy.lowEnergyNotified = true;
      await user.save();
    }

    if (energy >= 55) {
      user.buddy.lowEnergyNotified = false;
      await user.save();
    }
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