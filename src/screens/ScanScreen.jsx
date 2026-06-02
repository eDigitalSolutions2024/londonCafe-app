import React, { useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import GuestPrompt from "../components/GuestPrompt";

export default function ScanScreen() {
  const { user, token } = useContext(AuthContext);
  const [qrToken, setQrToken] = useState("");

  useEffect(() => {
    if (!token) { setQrToken(""); return; }
    const userId = user?._id || user?.id || null;
    if (!userId) { setQrToken(""); return; }
    setQrToken(`lc_user:${userId}`);
  }, [user, token]);

  if (!token) {
    return (
      <Screen>
        <GuestPrompt
          title="Mi QR"
          message="Inicia sesión para generar tu código QR de fidelidad."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.h1}>Mi QR</Text>
        <Text style={styles.sub}>Muestra este QR en caja para vincular tu compra</Text>

        <View style={styles.card}>
          {qrToken ? (
            <View style={styles.center}>
              <View style={styles.qrBox}>
                <QRCode value={qrToken} size={220} />
              </View>
              <Text style={styles.hint}>
                Este QR es único para tu cuenta y no expira.
              </Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.err}>Sin QR disponible</Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, backgroundColor: colors.background },
  h1: { color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 6 },
  sub: { color: colors.textMuted, marginBottom: 14 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    padding: 16,
  },

  center: { alignItems: "center", justifyContent: "center", gap: 10 },

  qrBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  hint: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },

  err: {
    color: colors.text,
    fontWeight: "900",
    textAlign: "center",
  },
});