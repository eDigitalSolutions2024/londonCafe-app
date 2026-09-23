const cron = require("node-cron");
const User = require("../models/User");
const AppMeta = require("../models/AppMeta");
const { sendExpoPushNotification } = require("../utils/push");
const { applyEnergyDecay, dayKeyLocal } = require("../utils/buddy");
const { applyPetDecay } = require("../controllers/pet.controller");
const { getLiveStoreVersions, compareVersions } = require("../utils/storeVersion");

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

// 😴 CADA MINUTO → avisar cuando la mascota termina de dormir (el freeze de
// "Dormir" dura solo unos minutos, así que necesita un cron más seguido que
// el de cada 30 min de arriba -- si no, el aviso podría tardar hasta media
// hora en llegar en vez de casi al toque).
cron.schedule("* * * * *", async () => {
  const now = new Date();

  const users = await User.find({
    "pet.owned": true,
    "pet.sleepUntil": { $ne: null, $lte: now },
    "pet.sleepNotified": false,
  });

  for (const user of users) {
    const p = user.pet;
    try {
      if (user.expoPushToken && user.notificationPrefs?.pet !== false) {
        await sendExpoPushNotification(
          user.expoPushToken,
          `${p.name || "Tu mascota"} ya despertó 😊`,
          "Durmió bien y ya tiene toda su energía -- ven a jugar con ella.",
          { type: "pet-woke-up" }
        );
      }
      p.sleepNotified = true;
      user.markModified("pet");
      await user.save();
    } catch (err) {
      console.log(`⚠️ sleep-wake push (${user._id}):`, err?.message);
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

// 🟠 TODOS LOS DÍAS 11AM → recuperar usuarios inactivos.
// Tres avisos, cada uno UNA sola vez por episodio de inactividad (no uno
// por cada corrida del cron mientras sigue sin volver -- ver reengageFlags
// en User.js, que se resetean en getMe en cuanto la persona vuelve a
// abrir la app de verdad):
//   - 1 día sin abrir la app: empuje suave (racha / Buddy Coins).
//   - 7 días sin abrir la app: un solo intento de "recuperación", con
//     otro tono -- ya se perdió la racha, así que no tiene caso mencionarla.
//   - 30 días sin abrir la app: ya no tiene caso hablar de racha ni de
//     Buddy Coins (para entonces cualquiera de los dos avisos de arriba
//     ya se mandó y no funcionó) -- en vez de insistir con lo mismo,
//     invita a redescubrir la app (hay cosas nuevas: cupones, Survival en
//     los minijuegos, etc.).
cron.schedule("0 11 * * *", async () => {
  console.log("⏰ Revisando usuarios inactivos...");

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const inactive1d = await User.find({
      expoPushToken: { $exists: true, $ne: "" },
      lastActiveAt: { $ne: null, $lte: oneDayAgo },
      "reengageFlags.day1": { $ne: true },
    });

    for (const user of inactive1d) {
      if (user.notificationPrefs?.reengage === false) continue;
      try {
        const coins = Math.max(0, Math.floor(Number(user.points) || 0));
        await sendExpoPushNotification(
          user.expoPushToken,
          "Te extrañamos en London Café ☕",
          coins > 0
            ? `Recupera tu racha 🔥 y aprovecha tus ${coins} Buddy Coins antes de que se enfríen.`
            : "Recupera tu racha 🔥 -- vuelve hoy y no la pierdas.",
          { type: "reengage-1d" }
        );
        user.reengageFlags.day1 = true;
        user.markModified("reengageFlags");
        await user.save();
      } catch (err) {
        console.log(`⚠️ reengage 1d push (${user._id}):`, err?.message);
      }
    }

    const inactive7d = await User.find({
      expoPushToken: { $exists: true, $ne: "" },
      lastActiveAt: { $ne: null, $lte: sevenDaysAgo },
      "reengageFlags.day7": { $ne: true },
    });

    for (const user of inactive7d) {
      if (user.notificationPrefs?.reengage === false) continue;
      try {
        await sendExpoPushNotification(
          user.expoPushToken,
          "¿Todo bien? 🥺",
          "Ya casi una semana sin verte por London Café -- tus Buddy Coins siguen ahí, esperándote.",
          { type: "reengage-7d" }
        );
        user.reengageFlags.day7 = true;
        user.markModified("reengageFlags");
        await user.save();
      } catch (err) {
        console.log(`⚠️ reengage 7d push (${user._id}):`, err?.message);
      }
    }

    const inactive30d = await User.find({
      expoPushToken: { $exists: true, $ne: "" },
      lastActiveAt: { $ne: null, $lte: thirtyDaysAgo },
      "reengageFlags.day30": { $ne: true },
    });

    for (const user of inactive30d) {
      if (user.notificationPrefs?.reengage === false) continue;
      try {
        await sendExpoPushNotification(
          user.expoPushToken,
          "¡Hace un mes que no te vemos! 👋",
          "Hemos agregado cosas nuevas -- date una vuelta a London Café y pruébalas.",
          { type: "reengage-30d" }
        );
        user.reengageFlags.day30 = true;
        user.markModified("reengageFlags");
        await user.save();
      } catch (err) {
        console.log(`⚠️ reengage 30d push (${user._id}):`, err?.message);
      }
    }
  } catch (err) {
    console.log("⚠️ reengage cron:", err?.message);
  }
});

// 🟣 CADA 2 HORAS → avisar de una nueva versión ya publicada en las
// tiendas ("cuando exista", no cuando nosotros la subamos -- Apple puede
// tardar horas/días en aprobarla, ver storeVersion.js). Compara contra
// AppMeta.lastAnnouncedVersion para mandar el push UNA sola vez por
// versión nueva, sin importar cuántas veces corra este cron mientras esa
// sigue siendo la última. El banner in-app (ver /api/app/version-check +
// HomeScreen.jsx) no depende de esto -- ese siempre refleja la versión
// real de la tienda, este cron solo decide cuándo mandar el push.
cron.schedule("0 */2 * * *", async () => {
  console.log("⏰ Revisando si hay versión nueva en las tiendas...");
  try {
    const { ios, android } = await getLiveStoreVersions();
    if (!ios && !android) return;

    let meta = await AppMeta.findById("singleton");
    const hasBaseline = meta && (meta.lastAnnouncedVersion?.ios || meta.lastAnnouncedVersion?.android);
    if (!hasBaseline) {
      // Primera vez que corre este cron (o AppMeta no existía todavía) --
      // solo establece el punto de partida, sin mandar push. Si no,
      // "ios/android sin versión previa registrada" se leería como
      // "siempre hay una nueva versión" y mandaría un blast falso apenas
      // se despliega esta feature.
      await AppMeta.findByIdAndUpdate(
        "singleton",
        { lastAnnouncedVersion: { ios, android } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return;
    }

    const newerIOS = ios && compareVersions(ios, meta.lastAnnouncedVersion?.ios) > 0;
    const newerAndroid = android && compareVersions(android, meta.lastAnnouncedVersion?.android) > 0;
    if (!newerIOS && !newerAndroid) return;

    console.log(`⏰ Nueva versión detectada -- ios:${ios} android:${android}, avisando por push...`);

    const users = await User.find({ expoPushToken: { $exists: true, $ne: "" } });
    for (const user of users) {
      if (user.notificationPrefs?.appUpdate === false) continue;
      try {
        await sendExpoPushNotification(
          user.expoPushToken,
          "¡Hay una nueva versión de London Café! ☕✨",
          "Actualiza para disfrutar las mejoras más recientes.",
          { type: "app-update" }
        );
      } catch (err) {
        console.log(`⚠️ app-update push (${user._id}):`, err?.message);
      }
    }

    meta.lastAnnouncedVersion = { ios: ios || meta.lastAnnouncedVersion?.ios || null, android: android || meta.lastAnnouncedVersion?.android || null };
    await meta.save();
  } catch (err) {
    console.log("⚠️ app-update cron:", err?.message);
  }
});