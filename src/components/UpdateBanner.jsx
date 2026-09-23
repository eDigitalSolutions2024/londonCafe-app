import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";

const IOS_STORE_URL = "https://apps.apple.com/app/id6761497270";
const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.londoncafe.app";

// "1.2" vs "1.1.2" -- comparación numérica por partes, no de texto (como
// texto "1.10" < "1.2", pero 1.10 es la versión más nueva). Mismo
// criterio que compareVersions() en storeVersion.js (backend).
function compareVersions(a, b) {
  if (!a || !b) return 0;
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Banner descartable que avisa cuando ya hay una versión más nueva
 * publicada de verdad en la tienda (App Store / Play Store) que la que
 * trae instalada este dispositivo -- ver GET /api/app/version-check
 * (backend, storeVersion.js) y el push que manda el cron cuando detecta
 * el mismo cambio (pushJobs.js). Se descarta por versión (AsyncStorage):
 * si lo cierran, no vuelve a aparecer para ESA versión, pero si sale una
 * más nueva todavía, reaparece.
 */
export default function UpdateBanner() {
  const [storeVersion, setStoreVersion] = useState(null);
  const [dismissed, setDismissed] = useState(true); // arranca oculto hasta confirmar que no está descartado

  useEffect(() => {
    let alive = true;
    const currentVersion = Constants.expoConfig?.version;
    if (!currentVersion) return;

    apiFetch("/app/version-check")
      .then(async (r) => {
        if (!alive || !r?.ok) return;
        const live = Platform.OS === "ios" ? r.ios : r.android;
        if (!live || compareVersions(live, currentVersion) <= 0) return;

        const seenKey = `update_banner_dismissed_${live}`;
        const seen = await AsyncStorage.getItem(seenKey).catch(() => null);
        if (!alive) return;
        if (seen) return;

        setStoreVersion(live);
        setDismissed(false);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  if (dismissed || !storeVersion) return null;

  const onDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(`update_banner_dismissed_${storeVersion}`, "1").catch(() => {});
  };

  const onUpdate = () => {
    Linking.openURL(Platform.OS === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL).catch(() => {});
  };

  return (
    <Pressable style={styles.banner} onPress={onUpdate} android_ripple={{ color: "rgba(255,255,255,0.15)" }}>
      <Text style={styles.emoji}>☕✨</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Hay una nueva versión</Text>
        <Text style={styles.subtitle}>Toca para actualizar London Café</Text>
      </View>
      <Pressable hitSlop={10} onPress={onDismiss} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emoji: { fontSize: 20 },
  title: { color: "#fff", fontSize: 13, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", marginTop: 1 },
  closeBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
