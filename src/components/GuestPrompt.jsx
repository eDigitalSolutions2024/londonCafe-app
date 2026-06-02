import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import LondonCafeLogo from "../assets/markers/londoncafe1.jpg";

const BENEFITS = [
  { icon: "☕", text: "Acumula puntos por cada compra" },
  { icon: "🎁", text: "Canjea recompensas exclusivas" },
  { icon: "🔥", text: "Mantén tu racha diaria" },
  { icon: "📍", text: "Encuentra nuestras sucursales fácilmente" },
];

export default function GuestPrompt({
  title = "Bienvenido a London Cafe",
  message = "Inicia sesión para acumular puntos, mantener tu racha diaria y canjear recompensas.",
  showContinueAsGuest = true,
}) {
  const navigation = useNavigation();

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.logoWrap}>
        <Image source={LondonCafeLogo} style={styles.logo} resizeMode="cover" />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate("AuthModal")}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión"
      >
        <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate("AuthModal", { screen: "Register" })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Crear cuenta gratuita"
      >
        <Text style={styles.secondaryBtnText}>Crear cuenta gratuita</Text>
      </TouchableOpacity>

      {showContinueAsGuest && (
        <TouchableOpacity
          onPress={() => navigation.navigate("Ordena")}
          activeOpacity={0.8}
          style={styles.guestBtn}
          accessibilityRole="button"
          accessibilityLabel="Continuar como invitado"
        >
          <Text style={styles.guestBtnText}>Continuar como invitado</Text>
        </TouchableOpacity>
      )}

      <View style={styles.benefitsWrap}>
        {BENEFITS.map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>{b.icon}</Text>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function GuestLockCard({ navigation }) {
  const nav = useNavigation();
  const go = navigation || nav;

  return (
    <View style={lockStyles.card}>
      <Text style={lockStyles.icon}>🔒</Text>
      <Text style={lockStyles.text}>
        Crea una cuenta gratuita para desbloquear esta función.
      </Text>
      <View style={lockStyles.row}>
        <TouchableOpacity
          style={lockStyles.primaryBtn}
          onPress={() => go.navigate("AuthModal")}
          activeOpacity={0.9}
          accessibilityRole="button"
        >
          <Text style={lockStyles.primaryText}>Iniciar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={lockStyles.secondaryBtn}
          onPress={() => go.navigate("AuthModal", { screen: "Register" })}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={lockStyles.secondaryText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: colors.background,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
    maxWidth: 300,
  },
  primaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  guestBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 28,
  },
  guestBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  benefitsWrap: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    padding: 16,
    gap: 14,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 18,
  },
});

const lockStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
    marginTop: 12,
  },
  icon: {
    fontSize: 28,
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
});
