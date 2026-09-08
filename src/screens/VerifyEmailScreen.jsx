import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { verifyEmail, resendVerification } from "../api/auth";

export default function VerifyEmailScreen({ route, navigation }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const email = route?.params?.email || "";

  async function onVerify() {
    try {
      setLoading(true);
      await verifyEmail({ email, code });
      Alert.alert("Listo ✅", "Correo verificado. Ahora inicia sesión.");
      navigation.navigate("Login", { email });
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      await resendVerification({ email });
      Alert.alert(
        "Enviado",
        "Te hemos enviado un nuevo código de verificación. Si no lo ves en tu bandeja de entrada, revisa spam o correo no deseado."
      );
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e.message);
    }
  }

  return (
    <Screen safeStyle={styles.safeDark}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>Email: {email}</Text>
        <Text style={styles.hint}>
          ¿No te llega el código? Revisa tu carpeta de spam o correo no deseado -- muchas veces cae ahí.
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Código de 6 dígitos"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={styles.input}
          maxLength={6}
        />

        <TouchableOpacity style={styles.btn} onPress={onVerify} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Verificando..." : "Verificar"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onResend}>
          <Text style={styles.link}>Reenviar código</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeDark: { backgroundColor: "#0b0709" },
  wrap: { padding: 20, gap: 12, flex: 1, backgroundColor: "#0b0709" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.6)" },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: -4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 6,
    alignItems: "center",
  },
  btnText: { color: "#2A0E18", fontSize: 16, fontWeight: "700" },
  link: { color: "rgba(255,255,255,0.55)", marginTop: 8 },
});
