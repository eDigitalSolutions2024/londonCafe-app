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
import { login as loginApi } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

// ✅ Logo LondonCafe (ajusta la ruta/extensión si es necesario)
import LondonCafeLogo from "../assets/markers/londoncafe.jpg";

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header / Logo */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image source={LondonCafeLogo} style={styles.logo} resizeMode="contain" />
            </View>

            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

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
              <Text style={styles.btnText}>{loading ? "Entrando..." : "Entrar"}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              activeOpacity={0.8}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>
                ¿No tienes cuenta? <Text style={styles.linkStrong}>Regístrate</Text>
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
    // sombra suave
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  logo: {
    width: 78,
    height: 78,
  },

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
    // sombra
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
