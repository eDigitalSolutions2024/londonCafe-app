import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import QRCode from "react-native-qrcode-svg";

export default function RedeemQRScreen({ navigation, route }) {
  const { token, rewardType, expiresAt } = route?.params || {};

  const title = useMemo(() => {
    if (rewardType === "coffee_free") return "Canje: Café gratis";
    if (rewardType === "bread_free") return "Canje: Pan gratis";
    return "Canje";
  }, [rewardType]);

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

        {expiresAt ? (
          <Text style={styles.expires}>Expira: {String(expiresAt)}</Text>
        ) : null}
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
});
