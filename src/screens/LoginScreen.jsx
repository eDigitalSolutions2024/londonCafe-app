import React, { useContext, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { login as loginApi } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

export default function LoginScreen({ route, navigation }) {
  const presetEmail = route?.params?.email || "";
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn } = useContext(AuthContext);

  async function onSubmit() {
    try {
      setLoading(true);
      const res = await loginApi({ email, password });
      await signIn(res.token, res.user);
      // ya te manda a tabs por el App.js
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "EMAIL_NOT_VERIFIED") {
        Alert.alert("Falta verificar", "Primero verifica tu correo.");
        navigation.navigate("VerifyEmail", { email });
      } else {
        Alert.alert("Error", errCode || e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Iniciar sesión</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Entrando..." : "Entrar"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>No tengo cuenta → Registrarme</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
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
