import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { register } from "../api/auth";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    try {
      setLoading(true);
      const res = await register({ name, email, password });
      // manda a verify con el email
      navigation.navigate("VerifyEmail", { email: res.email || email });
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>Crear cuenta</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
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
          <Text style={styles.btnText}>{loading ? "Creando..." : "Registrarme"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>Ya tengo cuenta → Iniciar sesión</Text>
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
