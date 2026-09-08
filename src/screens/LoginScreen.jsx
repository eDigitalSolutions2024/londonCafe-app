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
import { login as loginApi } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

// ✅ Logo LondonCafe (ajusta la ruta/extensión si es necesario)
import LondonCafeLogo from "../assets/markers/londoncafe1.jpg";

// Mismo lenguaje visual que la pantalla de bienvenida (invitado, ver
// HomeScreen.jsx) -- oscuro/glass, logo vivo en 3D, orbes a la deriva.
// Duplicado a propósito en vez de importado: son pantallas distintas que no
// deben acoplarse entre sí solo por compartir estilo.

function DriftingOrb({ size, top, left, right, color, duration, delay = 0 }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, 26] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", top, left, right, width: size, height: size, opacity, transform: [{ translateY }, { translateX }] }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`login-orb-${color}-${size}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <Stop offset="85%" stopColor={color} stopOpacity="0" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Radio menor al lienzo a propósito -- deja margen real transparente
            antes del borde, si no el filo del círculo se magnifica con el
            scale animado y se ve como un cuadro (bug real que reportó el
            usuario). */}
        <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={`url(#login-orb-${color}-${size})`} />
      </Svg>
    </Animated.View>
  );
}

function BackgroundOrbs() {
  return (
    <>
      <DriftingOrb size={300} top={-90} left={-90} color={colors.primary} duration={5000} />
      <DriftingOrb size={260} top={80} right={-100} color={colors.accent} duration={6200} delay={300} />
      <DriftingOrb size={240} top={480} left={-90} color="#8E2545" duration={5600} delay={700} />
      <DriftingOrb size={220} top={720} right={-80} color={colors.primary} duration={6800} delay={1000} />
    </>
  );
}

function Glow({ size = 240 }) {
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
    <Animated.View pointerEvents="none" style={[loginFxStyles.glow, { width: size, height: size, opacity, transform: [{ scale }] }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="loginGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.55" />
            <Stop offset="55%" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="90%" stopColor={colors.accent} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Ver nota en DriftingOrb -- mismo margen de seguridad. */}
        <Circle cx={size / 2} cy={size / 2} r={size * 0.42} fill="url(#loginGlow)" />
      </Svg>
    </Animated.View>
  );
}

function FloatingLogo3D({ children }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotateY = t.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });
  const rotateX = t.interpolate({ inputRange: [0, 1], outputRange: ["4deg", "-4deg"] });

  return (
    <Animated.View style={{ transform: [{ perspective: 800 }, { translateY }, { rotateY }, { rotateX }] }}>
      {children}
    </Animated.View>
  );
}

function PressableScale({ style, onPress, children, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => !disabled && Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={loginFxStyles.fill}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Input "glass": campo translúcido sobre fondo oscuro, con borde que se
// enciende en dorado al enfocar -- reemplaza el input blanco plano de antes.
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

const loginFxStyles = StyleSheet.create({
  glow: { position: "absolute", alignItems: "center", justifyContent: "center" },
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
});

export default function LoginScreen({ route, navigation }) {
  const presetEmail = route?.params?.email || "";
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { signIn } = useContext(AuthContext);

  async function onSubmit() {
    try {
      setLoading(true);
      const res = await loginApi({ email, password });
      await signIn(res.token, res.user);
      // dismiss the auth modal and return to whatever tab was active
      navigation.getParent()?.goBack();
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
    <Screen withPadding={false} safeStyle={styles.safe}>
      <BackgroundOrbs />
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
            <View style={styles.glowStage}>
              <Glow />
              <FloatingLogo3D>
                <View style={styles.logoRing}>
                  <Svg width={128} height={128} style={StyleSheet.absoluteFill}>
                    <Defs>
                      <SvgLinearGradient id="loginRing" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
                        <Stop offset="100%" stopColor="#fff" stopOpacity="0.35" />
                      </SvgLinearGradient>
                    </Defs>
                    <Circle cx="64" cy="64" r="63" stroke="url(#loginRing)" strokeWidth="1.5" fill="none" />
                  </Svg>
                  <View style={styles.logoWrap}>
                    <Image source={LondonCafeLogo} style={styles.logo} resizeMode="cover" />
                  </View>
                </View>
              </FloatingLogo3D>
            </View>

            <Text style={styles.eyebrow}>BIENVENIDO A</Text>
            <Text style={styles.title}>London Café</Text>
            <Text style={styles.subtitle}>Inicia sesión para acceder a tus recompensas</Text>
          </View>

          {/* Card "glass" */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              focused={focusedField === "email"}
              onFocus={() => setFocusedField("email")}
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
              focused={focusedField === "password"}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />

            <PressableScale
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Entrando..." : "Entrar"}</Text>
            </PressableScale>

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

          {/* Continuar sin cuenta */}
          <TouchableOpacity
            onPress={() => navigation.getParent()?.goBack()}
            activeOpacity={0.8}
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={[styles.footerNote, { textDecorationLine: "underline" }]}>
              Continuar sin cuenta
            </Text>
          </TouchableOpacity>

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
  safe: { backgroundColor: "#0b0709" },

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
    marginBottom: 22,
  },

  glowStage: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoRing: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  logo: { width: "100%", height: "100%" },

  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: 4,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },

  field: { marginBottom: 14 },

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

  btn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: 999,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    marginTop: 16,
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
