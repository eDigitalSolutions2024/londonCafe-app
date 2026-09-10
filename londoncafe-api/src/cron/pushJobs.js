const cron = require("node-cron");
const User = require("../models/User");
const { sendExpoPushNotification } = require("../utils/push");
const { applyEnergyDecay, dayKeyLocal } = require("../utils/buddy");
const { applyPetDecay } = require("../controllers/pet.controller");

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

// 🐾 CADA 30 MINUTOS → revisar la mascota (hambre / desastre / energía / ánimo)
cron.schedule("*/30 * * * *", async () => {
  console.log("⏰ Revisando mascotas...");

  const users = await User.find({
    expoPushToken: { $exists: true, $ne: "" },
    "pet.owned": true,
  });

  const now = new Date();

  for (const user of users) {
    if (user.notificationPrefs?.pet === false) continue;

    try {
      applyPetDecay(user, now);

      const p = user.pet;
      if (!p.notifyFlags) {
        p.notifyFlags = { mess: false, hunger: false, energy: false, happiness: false };
      }
      const f = p.notifyFlags;
      const name = p.name || "Tu mascota";

      // Prioridad: desastre > hambre > energía > ánimo. Máximo 1 aviso por corrida.
      if (p.mess && !f.mess) {
        await sendExpoPushNotification(
          user.expoPushToken,
          `${name} hizo un desastre 🧼`,
          `Entra a limpiar a ${name} antes de que se ponga triste.`,
          { type: "pet-mess" }
        );
        f.mess = true;
      } else if (Number(p.hunger) <= 20 && !f.hunger) {
        await sendExpoPushNotification(
          user.expoPushToken,
          `${name} tiene hambre 🍽️`,
          `Dale un café o un pan de tu despensa.`,
          { type: "pet-hunger" }
        );
        f.hunger = true;
      } else if (Number(p.energy) <= 20 && !f.energy) {
        await sendExpoPushNotification(
          user.expoPushToken,
          `${name} está agotado 😴`,
          `Déjalo dormir para que recupere energía.`,
          { type: "pet-energy" }
        );
        f.energy = true;
      } else if (Number(p.happiness) <= 25 && !f.happiness) {
        await sendExpoPushNotification(
          user.expoPushToken,
          `${name} te extraña 🥺`,
          `Ven a jugar un rato con ${name}.`,
          { type: "pet-happiness" }
        );
        f.happiness = true;
      }

      // ✅ reset automático con margen (para volver a poder avisar)
      if (!p.mess) f.mess = false;
      if (Number(p.hunger) > 35) f.hunger = false;
      if (Number(p.energy) > 35) f.energy = false;
      if (Number(p.happiness) > 40) f.happiness = false;

      user.markModified("pet");
      await user.save();
    } catch (err) {
      console.log(`⚠️ pet push (${user._id}):`, err?.message);
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