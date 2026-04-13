import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      console.log("❌ Push: no es dispositivo físico");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    console.log("🔔 existingStatus:", existingStatus);

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("🔔 requestedStatus:", status);
    }

    if (finalStatus !== "granted") {
      console.log("❌ Push: permisos no concedidos");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    console.log("🆔 projectId:", projectId);

    if (!projectId) {
      console.log("❌ Push: no se encontró projectId");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("✅ Expo push token generado:", tokenData?.data);

    return tokenData.data;
  } catch (e) {
    console.log("❌ registerForPushNotificationsAsync error:", e?.message || e);
    return null;
  }
}

export async function sendLocalNotification({ title, body, data = {} }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null,
  });
}

export async function scheduleDailyStreakReminder() {
  await Notifications.cancelScheduledNotificationAsync("daily-streak-reminder").catch(() => {});

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "No pierdas tu racha 🔥",
      body: "Entra hoy y reclama tu recompensa diaria.",
      data: { type: "streak-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 0,
    },
  });

  return id;
}