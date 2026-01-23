import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";;
import { useFocusEffect } from "@react-navigation/native";

import { colors } from "../theme/colors";
import Screen from "../components/Screen";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

const CLAIM_PATH = "/points/claim"; // ✅ AJUSTA: "/qr/claim" etc.

export default function ScanScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  // lock para evitar doble escaneo
  const lockRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // cuando entras a la pantalla, re-habilita escaneo
  useFocusEffect(
    useCallback(() => {
      setScanning(true);
      lockRef.current = false;
    }, [])
  );

  const handleBarCodeScanned = async ({ data, type }) => {
    if (!token) {
      Alert.alert("Sesión", "Inicia sesión de nuevo.");
      return;
    }

    if (!scanning || lockRef.current) return;

    lockRef.current = true;
    setScanning(false);

    try {
      setLoading(true);

      console.log("✅ QR type:", type);
      console.log("✅ QR data:", data);

      // ✅ Si tu backend espera { code: data } cámbialo aquí
      const r = await apiFetch(CLAIM_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qr: data }),
      });

      /**
       * Backend recomendado devuelva algo así:
       * { ok:true, addedPoints: 25, points: 120, lifetimePoints: 580 }
       * o { ok:true, msg:"..." }
       */
      if (r?.ok === false) {
        Alert.alert("No se pudo", r?.msg || "QR inválido.");
      } else {
        const added = Number(r?.addedPoints) || null;

        Alert.alert(
          "Listo ✅",
          added ? `Se agregaron ${added} puntos.` : "Puntos agregados.",
          [
            {
              text: "OK",
              onPress: () => {
                // ✅ Regresa al Home para que refresque /points/me
                navigation.navigate("Home");
              },
            },
          ]
        );
      }
    } catch (e) {
      console.log("❌ claim:", e?.data || e?.message);

      // ejemplos típicos
      if (e?.status === 401) return Alert.alert("Sesión", "Tu sesión expiró. Inicia de nuevo.");
      if (e?.status === 409) return Alert.alert("Ya usado", "Este QR ya fue reclamado.");
      if (e?.status === 400) return Alert.alert("QR inválido", "El QR no es válido o expiró.");

      Alert.alert("Error", "No se pudo procesar el QR.");
    } finally {
      setLoading(false);
      // permite reintentar desde botón
    }
  };

  const onRescan = () => {
    lockRef.current = false;
    setScanning(true);
  };

  if (hasPermission === null) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Solicitando permisos de cámara...</Text>
        </View>
      </Screen>
    );
  }

  if (hasPermission === false) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Sin acceso a cámara</Text>
          <Text style={styles.muted}>Activa permisos de cámara para escanear QR.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.h1}>Escanear</Text>
        <Text style={styles.sub}>Escanea el QR de tu compra para sumar puntos</Text>

        <View style={styles.cameraBox}>
          <BarCodeScanner
            onBarCodeScanned={scanning ? handleBarCodeScanned : undefined}
            style={StyleSheet.absoluteFillObject}
          />

          {/* overlay del recuadro (simple) */}
          <View style={styles.frame} />

          {/* loading */}
          {loading ? (
            <View style={styles.loadingPill}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Procesando...</Text>
            </View>
          ) : (
            <View style={styles.bottomArea}>
              <Text style={styles.help}>Coloca el QR dentro del recuadro</Text>
              <TouchableOpacity onPress={onRescan} style={styles.btn} activeOpacity={0.9}>
                <Text style={styles.btnText}>Escanear de nuevo</Text>
              </TouchableOpacity>
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
  sub: { color: colors.textMuted, marginBottom: 12 },

  cameraBox: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
  },

  frame: {
    position: "absolute",
    left: 40,
    right: 40,
    top: "28%",
    height: 220,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },

  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
    gap: 10,
  },

  help: { color: "rgba(255,255,255,0.95)", fontWeight: "800" },

  btn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  btnText: { color: "#111", fontWeight: "900" },

  loadingPill: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  loadingText: { color: "#fff", fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.textMuted },
});
