import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Circle } from "react-native-svg";

import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { register } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

// ✅ mismo logo que Login (ajusta si lo cambiaste)
import LondonCafeLogo from "../assets/markers/londoncafe.png";

// Mismo lenguaje oscuro/glass que LoginScreen.jsx -- duplicado a propósito
// (ver comentario ahí) en vez de compartido, son pantallas distintas.
function Glow({ size = 220 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View pointerEvents="none" style={[registerFxStyles.glow, { width: size, height: size, opacity, transform: [{ scale }] }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="registerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.55" />
            <Stop offset="55%" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="90%" stopColor={colors.accent} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.42} fill="url(#registerGlow)" />
      </Svg>
    </Animated.View>
  );
}

const registerFxStyles = StyleSheet.create({
  glow: { position: "absolute", alignItems: "center", justifyContent: "center" },
});

function GlassInput({ label, focused, onFocus, onBlur, ...rest }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [focused, glow]);

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.16)", colors.accent],
  });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputWrap, { borderColor }]}>
        <TextInput
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
          onFocus={onFocus}
          onBlur={onBlur}
          {...rest}
        />
      </Animated.View>
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState(""); // "male" | "female" | "other"
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // números o + al inicio
  const [birthDate, setBirthDate] = useState(""); // DD/MM/AAAA
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { token } = useContext(AuthContext) || {};

  // ================== Helpers ==================
  function formatBirthDate(input) {
    const digits = input.replace(/\D/g, "").slice(0, 8);
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    let out = d;
    if (m) out += `/${m}`;
    if (y) out += `/${y}`;
    return out;
  }

  function isValidBirthDate(ddmmyyyy) {
    const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;

    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);

    if (mm < 1 || mm > 12) return false;
    if (dd < 1 || dd > 31) return false;

    const dt = new Date(yyyy, mm - 1, dd);
    if (
      dt.getFullYear() !== yyyy ||
      dt.getMonth() !== mm - 1 ||
      dt.getDate() !== dd
    )
      return false;

    // no futuro
    const today = new Date();
    if (dt > today) return false;

    // mínimo 13 años
    const min = new Date();
    min.setFullYear(min.getFullYear() - 13);
    if (dt > min) return false;

    return true;
  }

  function birthDateToISO(ddmmyyyy) {
    const [dd, mm, yyyy] = ddmmyyyy.split("/");
    return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
  }

  function normalizePhone(input) {
    let v = input.trim();
    if (v.startsWith("+")) v = "+" + v.slice(1).replace(/\D/g, "");
    else v = v.replace(/\D/g, "");
    return v.slice(0, 16);
  }

  // ================== Submit ==================
  async function onSubmit() {
    try {
      if (!name.trim()) return Alert.alert("Falta nombre", "Escribe tu nombre.");
      if (!email.trim()) return Alert.alert("Falta email", "Escribe tu email.");
      if (!password.trim()) {
        return Alert.alert("Falta contraseña", "Escribe tu contraseña.");
      }

      setLoading(true);

      const payload = { name: name.trim(), email: email.trim(), password };

      if (gender) payload.gender = gender;

      if (phone.trim()) {
        const phoneNorm = normalizePhone(phone);
        if (phoneNorm.replace("+", "").length >= 10) {
          payload.phone = phoneNorm;
        }
      }

      if (birthDate.trim() && isValidBirthDate(birthDate)) {
        payload.birthDate = birthDateToISO(birthDate);
      }

      const res = await register(payload);

      Alert.alert(
        "Cuenta creada ✅",
        "Te enviamos un código de verificación a tu correo. Si no lo ves en unos minutos, revisa tu carpeta de spam o correo no deseado -- ahí es donde suele llegar."
      );

      navigation.navigate("VerifyEmail", { email: res?.email || email });
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  // ================== UI Helpers ==================
  const GenderPill = ({ value, label }) => {
    const active = gender === value;
    return (
      <TouchableOpacity
        onPress={() => setGender(value)}
        activeOpacity={0.9}
        style={[styles.pill, active && styles.pillActive]}
      >
        <Text style={[styles.pillText, active && styles.pillTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeStyle={styles.safeDark}>
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
            <View style={styles.glowStage}>
              <Glow />
              <View style={styles.logoRing}>
                <Svg width={104} height={104} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <SvgLinearGradient id="registerRing" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
                      <Stop offset="100%" stopColor="#fff" stopOpacity="0.35" />
                    </SvgLinearGradient>
                  </Defs>
                  <Circle cx="52" cy="52" r="51" stroke="url(#registerRing)" strokeWidth="1.5" fill="none" />
                </Svg>
                <View style={styles.logoWrap}>
                  <Image
                    source={LondonCafeLogo}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Regístrate para continuar</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registro</Text>

            <GlassInput
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              returnKeyType="next"
              focused={focusedField === "name"}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />

            {/* ✅ Género */}
            <View style={styles.field}>
              <Text style={styles.label}>Género (opcional)</Text>
              <View style={styles.pillsRow}>
                <GenderPill value="male" label="Hombre" />
                <GenderPill value="female" label="Mujer" />
                <GenderPill value="other" label="Otro" />
              </View>
            </View>

            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoComplete="email"
              textContentType="emailAddress"
              focused={focusedField === "email"}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />

            <GlassInput
              label="Teléfono (opcional)"
              value={phone}
              onChangeText={(v) => setPhone(normalizePhone(v))}
              placeholder="6561234567 o +1..."
              keyboardType="phone-pad"
              returnKeyType="next"
              autoComplete="tel"
              textContentType="telephoneNumber"
              focused={focusedField === "phone"}
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
            />

            <GlassInput
              label="Fecha de nacimiento (opcional)"
              value={birthDate}
              onChangeText={(v) => setBirthDate(formatBirthDate(v))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              returnKeyType="next"
              focused={focusedField === "birthDate"}
              onFocus={() => setFocusedField("birthDate")}
              onBlur={() => setFocusedField(null)}
            />

            <GlassInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              autoComplete="password"
              textContentType="newPassword"
              focused={focusedField === "password"}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>
                {loading ? "Creando..." : "Registrarme"}
              </Text>
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
                Ya tengo cuenta{" "}
                <Text style={styles.linkStrong}>Iniciar sesión</Text>
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
  safeDark: { backgroundColor: "#0b0709" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 30,
    backgroundColor: "#0b0709",
    justifyContent: "center",
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },

  glowStage: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoRing: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  logo: { width: 70, height: 70 },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },

  field: { marginBottom: 12 },

  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  inputWrap: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderRadius: 14,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
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
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  pillTextActive: {
    color: "#2A0E18",
  },
  helper: {
    marginTop: 6,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },

  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 6,
    alignItems: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: "#2A0E18",
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
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "900",
    fontSize: 12,
  },

  linkBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  linkText: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "800",
  },
  linkStrong: {
    color: colors.accent,
    fontWeight: "900",
  },

  footerNote: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
  },
});
