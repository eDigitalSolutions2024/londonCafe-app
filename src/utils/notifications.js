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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function registerForPushNotificationsAsync() {
  try {
    console.log("📱 Device.isDevice:", Device.isDevice);
    console.log("📦 Constants.expoConfig?.extra:", Constants?.expoConfig?.extra);
    console.log("📦 Constants.easConfig:", Constants?.easConfig);

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

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`📡 Intento token push #${attempt}`);
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log("✅ Expo push token generado:", tokenData?.data);
        return tokenData?.data ?? null;
      } catch (err) {
        lastError = err;
        console.log(`❌ intento #${attempt}:`, err?.message || err);
        if (attempt < 3) {
          await wait(2500 * attempt);
        }
      }
    }

    console.log("❌ registerForPushNotificationsAsync error final:", lastError?.message || lastError);
    return null;
  } catch (e) {
    console.log("❌ registerForPushNotificationsAsync error:", e?.message || e);
    return null;
  }
}