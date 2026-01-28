import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { register } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

// ✅ mismo logo que Login (ajusta si lo cambiaste)
import LondonCafeLogo from "../assets/markers/londoncafe.png";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState(""); // "male" | "female" | "other"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { token } = useContext(AuthContext) || {};

  async function onSubmit() {
    try {
      // validaciones rápidas
      if (!name.trim()) return Alert.alert("Falta nombre", "Escribe tu nombre.");
      if (!email.trim()) return Alert.alert("Falta email", "Escribe tu email.");
      if (!password.trim()) return Alert.alert("Falta contraseña", "Escribe tu contraseña.");
      if (!gender) return Alert.alert("Falta género", "Selecciona tu género.");

      setLoading(true);

      // ⬇️ mandamos gender (ajusta tu backend / API si hace falta)
      const res = await register({ name, email, password, gender });

      navigation.navigate("VerifyEmail", { email: res?.email || email });
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  const GenderPill = ({ value, label }) => {
    const active = gender === value;
    return (
      <TouchableOpacity
        onPress={() => setGender(value)}
        activeOpacity={0.9}
        style={[
          styles.pill,
          active && styles.pillActive,
        ]}
      >
        <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header / Logo (igual que Login) */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image source={LondonCafeLogo} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Regístrate para continuar</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registro</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            {/* ✅ Género */}
            <View style={styles.field}>
              <Text style={styles.label}>Género</Text>
              <View style={styles.pillsRow}>
                <GenderPill value="male" label="Hombre" />
                <GenderPill value="female" label="Mujer" />
                <GenderPill value="other" label="Otro" />
              </View>
              {!gender ? (
                <Text style={styles.helper}>Selecciona una opción</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>{loading ? "Creando..." : "Registrarme"}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.8}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>
                Ya tengo cuenta <Text style={styles.linkStrong}>Iniciar sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footerNote}>
            Al continuar aceptas las políticas de LondonCafe.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 30,
    backgroundColor: colors.background,
    justifyContent: "center",
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },

  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  logo: { width: 78, height: 78 },

  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },

  field: { marginBottom: 12 },

  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  input: {
    backgroundColor: "#fff",
    borderColor: colors.primarySoft,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: "700",
  },

  // ✅ Género pills
  pillsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13,
  },
  pillTextActive: {
    color: "#fff",
  },
  helper: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 6,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.primarySoft,
  },
  dividerText: {
    color: colors.textMuted,
    fontWeight: "900",
    fontSize: 12,
  },

  linkBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  linkText: {
    color: colors.textMuted,
    fontWeight: "800",
  },
  linkStrong: {
    color: colors.primary,
    fontWeight: "900",
  },

  footerNote: {
    marginTop: 14,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
});
