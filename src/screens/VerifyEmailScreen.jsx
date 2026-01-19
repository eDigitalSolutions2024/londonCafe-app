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
      Alert.alert("Enviado", "Se generó un nuevo código (modo dev: revisa consola del backend).");
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e.message);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>Email: {email}</Text>

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
  wrap: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: colors.textMuted },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.primarySoft,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 6,
    alignItems: "center",
  },
  btnText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  link: { color: colors.textMuted, marginTop: 8 },
});
