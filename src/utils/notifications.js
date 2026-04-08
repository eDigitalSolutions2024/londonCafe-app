import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
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
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
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