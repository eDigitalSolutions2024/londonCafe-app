import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import QRCode from "react-native-qrcode-svg";

export default function RedeemQRScreen({ navigation, route }) {
  const { token, rewardType, expiresAt } = route?.params || {};

  // ✅ Panelcito debug para ver valores rápido
  const [debugInfo, setDebugInfo] = useState("");

  const title = useMemo(() => {
    if (rewardType === "coffee_free") return "Canje: Café gratis";
    if (rewardType === "bread_free") return "Canje: Pan gratis";
    return "Canje";
  }, [rewardType]);

  // ✅ Logs cuando entras a esta pantalla
  useEffect(() => {
    const tokenPreview = token ? `${String(token).slice(0, 20)}...` : "(sin token)";
    const info = `rewardType=${rewardType || "(null)"} | token=${tokenPreview} | expiresAt=${expiresAt || "(null)"}`;

    console.log("✅ [RedeemQR] route.params:", route?.params);
    console.log("✅ [RedeemQR] info:", info);

    if (!token) {
      console.log("❌ [RedeemQR] token NO disponible (no se puede generar QR)");
    }

    setDebugInfo(info);
  }, [route?.params, token, rewardType, expiresAt]);

  return (
    <Screen>
      <View style={styles.headerTop}>
        <Text style={styles.pageTitle}>{title}</Text>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.backText}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Muestra este QR en caja</Text>

        <View style={styles.qrBox}>
          {token ? (
            <QRCode value={String(token)} size={220} />
          ) : (
            <Text style={styles.helper}>Token no disponible</Text>
          )}
        </View>

        <Text style={styles.helper}>
          Este QR expira en pocos minutos por seguridad. Si expira, genera uno nuevo.
        </Text>

        {expiresAt ? <Text style={styles.expires}>Expira: {String(expiresAt)}</Text> : null}

        {/* ✅ Debug visible (solo para pruebas) */}
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>DEBUG</Text>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },
  backText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  qrBox: {
    alignSelf: "center",
    width: 260,
    height: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  expires: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  // ✅ Debug box
  debugBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMuted,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    color: "#111",
    fontWeight: "700",
  },
});
