import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { colors } from "../theme/colors";
import Screen from "../components/Screen";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

const CLAIM_PATH = "/points/claim";

export default function ScanScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [permission, requestPermission] = useCameraPermissions();

  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  // lock para evitar doble escaneo
  const lockRef = useRef(false);

  // cuando entras a la pantalla, re-habilita escaneo
  useFocusEffect(
    useCallback(() => {
      setScanning(true);
      lockRef.current = false;
      setLoading(false);
    }, [])
  );

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      // no auto-pidas aquí si no quieres; puedes dejar que el usuario toque botón
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data, type }) => {
    if (!token) {
      Alert.alert("Sesión", "Inicia sesión de nuevo.");
      return;
    }

    if (!scanning || lockRef.current || loading) return;

    lockRef.current = true;
    setScanning(false);

    try {
      setLoading(true);

      const clean = String(data || "").trim();
      console.log("✅ QR type:", type);
      console.log("✅ QR data:", clean);

      // ✅ Backend espera { code }, no { qr }
      const r = await apiFetch(CLAIM_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: clean }),
      });

      if (r?.ok === false) {
        Alert.alert("No se pudo", r?.msg || "QR inválido.");
        lockRef.current = false;
        setScanning(true);
        return;
      }

      // ✅ Backend responde { added }, no addedPoints
      const added = Number(r?.added) || null;

      Alert.alert(
        "Listo ✅",
        added ? `Se agregaron ${added} puntos.` : "Puntos agregados.",
        [{ text: "OK", onPress: () => navigation.navigate("Home") }]
      );
    } catch (e) {
      console.log("❌ claim status:", e?.status);
      console.log("❌ claim data:", e?.data || e?.message);

      if (e?.status === 401) return Alert.alert("Sesión", "Tu sesión expiró. Inicia de nuevo.");
      if (e?.status === 409) return Alert.alert("Ya usado", "Este QR ya fue reclamado.");
      if (e?.status === 404) return Alert.alert("QR inválido", "Código no encontrado.");
      if (e?.status === 410) return Alert.alert("Caducado", "Este QR ya caducó.");
      if (e?.status === 400) return Alert.alert("QR inválido", "Falta código o es inválido.");

      Alert.alert("Error", "No se pudo procesar el QR.");

      lockRef.current = false;
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const onRescan = () => {
    lockRef.current = false;
    setScanning(true);
  };

  if (!permission) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Cargando permisos de cámara...</Text>
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={[styles.wrap, { justifyContent: "center" }]}>
          <Text style={styles.h1}>Escanear</Text>
          <Text style={[styles.sub, { marginBottom: 18 }]}>
            Necesitamos permiso de cámara para escanear QR.
          </Text>

          <TouchableOpacity onPress={requestPermission} style={styles.primaryBtn} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Dar permiso</Text>
          </TouchableOpacity>
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
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
          />

          <View style={styles.frame} />

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
  muted: { color: colors.textMuted },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
