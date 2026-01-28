import React, { useContext, useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

// ✅ backend real: GET /api/points/qr
const QR_PATH = "/points/qr";

export default function ScanScreen() {
  const { token } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [expiresIn, setExpiresIn] = useState(0); // seconds
  const [errorMsg, setErrorMsg] = useState("");

  const timerRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startCountdown = (seconds) => {
    stopTimer();
    setExpiresIn(seconds);

    timerRef.current = setInterval(() => {
      setExpiresIn((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

 const fetchMyQr = useCallback(async () => {
  if (!token) {
    setErrorMsg("Sesión inválida. Inicia sesión de nuevo.");
    return;
  }

  try {
    setLoading(true);
    setErrorMsg("");

    const r = await apiFetch(QR_PATH, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const qrValue = String(r?.qrValue || "");
    const ttl = Number(r?.expiresIn) || 90;

    if (!r?.ok || !qrValue) throw new Error("NO_QR_VALUE");

    setQrToken(qrValue);
    startCountdown(ttl);
  } catch (e) {
    console.log("❌ points/qr:", e?.status, e?.data || e?.message);
    setQrToken("");
    setExpiresIn(0);

    if (e?.status === 401) setErrorMsg("Tu sesión expiró. Inicia sesión de nuevo.");
    else setErrorMsg("No se pudo generar tu QR. Intenta de nuevo.");
  } finally {
    setLoading(false);
  }
}, [token]);


  // ✅ al abrir la pantalla, genera QR
  useFocusEffect(
    useCallback(() => {
      fetchMyQr();
      return () => stopTimer();
    }, [fetchMyQr])
  );

  // ✅ refresco automático cuando quedan pocos segundos (opcional)
  useEffect(() => {
    if (!expiresIn) return;
    if (expiresIn === 10) fetchMyQr();
  }, [expiresIn, fetchMyQr]);

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.h1}>Mi QR</Text>
        <Text style={styles.sub}>Muestra este QR en caja para vincular tu compra</Text>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Generando QR...</Text>
            </View>
          ) : qrToken ? (
            <View style={styles.center}>
              <View style={styles.qrBox}>
                <QRCode value={qrToken} size={220} />
              </View>

              <Text style={styles.timer}>
                Expira en <Text style={styles.timerStrong}>{expiresIn}s</Text>
              </Text>

              <Text style={styles.hint}>*Por seguridad, este QR cambia seguido.</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.err}>{errorMsg || "Sin QR disponible"}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={fetchMyQr}
            style={[styles.btn, loading && { opacity: 0.6 }]}
            activeOpacity={0.9}
            disabled={loading}
          >
            <Text style={styles.btnText}>{qrToken ? "Actualizar QR" : "Generar QR"}</Text>
          </TouchableOpacity>
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

  timer: { marginTop: 4, color: colors.textMuted, fontWeight: "800" },
  timerStrong: { color: colors.text },

  hint: { marginTop: 2, color: colors.textMuted, fontSize: 12 },

  err: { color: colors.text, fontWeight: "900" },
  muted: { color: colors.textMuted },

  btn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },
});
