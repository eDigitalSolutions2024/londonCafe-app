import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { forgotPassword, resetPassword } from "../api/auth";

// Mismo patrón de 2 pasos que VerifyEmailScreen (OTP por correo) -- todo
// nativo dentro de la app, sin salir a ninguna página web ni depender de
// deep-linking. Paso 1 pide el correo y manda el código; paso 2 pide el
// código + contraseña nueva.
export default function ForgotPasswordScreen({ route, navigation }) {
  const [step, setStep] = useState("email"); // "email" | "reset"
  const [email, setEmail] = useState(route?.params?.email || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSendCode() {
    if (!email.trim()) {
      Alert.alert("Falta el correo", "Escribe tu correo para poder enviarte el código.");
      return;
    }
    try {
      setLoading(true);
      await forgotPassword({ email: email.trim() });
      setStep("reset");
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "USER_NOT_FOUND") {
        Alert.alert("No encontrado", "No hay ninguna cuenta con ese correo.");
      } else if (errCode === "RESEND_COOLDOWN") {
        Alert.alert("Espera un momento", "Ya te enviamos un código hace poco -- inténtalo de nuevo en unos segundos.");
        setStep("reset");
      } else {
        Alert.alert("Error", errCode || e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResendCode() {
    try {
      await forgotPassword({ email: email.trim() });
      Alert.alert(
        "Enviado",
        "Te hemos enviado un nuevo código. Si no lo ves en tu bandeja de entrada, revisa spam o correo no deseado."
      );
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "RESEND_COOLDOWN") {
        Alert.alert("Espera un momento", "Ya te enviamos un código hace poco -- inténtalo de nuevo en unos segundos.");
      } else {
        Alert.alert("Error", errCode || e.message);
      }
    }
  }

  async function onResetPassword() {
    if (!code.trim() || code.trim().length !== 6) {
      Alert.alert("Código inválido", "Escribe el código de 6 dígitos que te enviamos.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Contraseña muy corta", "Usa al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("No coinciden", "Las dos contraseñas deben ser iguales.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ email: email.trim(), code: code.trim(), newPassword });
      Alert.alert("Listo ✅", "Tu contraseña se actualizó. Ahora inicia sesión.");
      navigation.navigate("Login", { email: email.trim() });
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "OTP_EXPIRED") {
        Alert.alert("Código expirado", "Pide un código nuevo.");
      } else if (errCode === "INVALID_CODE") {
        Alert.alert("Código incorrecto", "Revisa el código e inténtalo de nuevo.");
      } else if (errCode === "TOO_MANY_ATTEMPTS") {
        Alert.alert("Demasiados intentos", "Pide un código nuevo para volver a intentar.");
      } else {
        Alert.alert("Error", errCode || e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen safeStyle={styles.safeDark}>
      <View style={styles.wrap}>
        {step === "email" ? (
          <>
            <Text style={styles.title}>Restablecer contraseña</Text>
            <Text style={styles.subtitle}>
              Escribe tu correo y te enviamos un código para crear una contraseña nueva.
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <TouchableOpacity style={styles.btn} onPress={onSendCode} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Enviando..." : "Enviar código"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Ingresa el código</Text>
            <Text style={styles.subtitle}>Enviamos un código a {email}</Text>
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

            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Contraseña nueva"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />

            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirma tu contraseña nueva"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />

            <TouchableOpacity style={styles.btn} onPress={onResetPassword} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Guardando..." : "Cambiar contraseña"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onResendCode}>
              <Text style={styles.link}>Reenviar código</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.navigate("Login", { email })}>
          <Text style={styles.link}>Volver a iniciar sesión</Text>
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
