import React, { useContext, useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview from "../components/AvatarPreview";
import { apiFetch } from "../api/client";
import { deleteAccount } from "../api/auth";
import Screen from "../components/Screen";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import GuestPrompt from "../components/GuestPrompt";

export default function AccountSettingsScreen({ navigation }) {
  const { token, signOut } = useContext(AuthContext);
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // perfil
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // ✅ Confirmación de cambio de correo -- el backend ya no aplica el
  // correo directo, manda un código a la dirección nueva primero.
  const [pendingEmail, setPendingEmail] = useState(null);
  const [emailCode, setEmailCode] = useState("");
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  // avatar
  const [avatarConfig, setAvatarConfig] = useState({
    skin: "skin_01",
    hair: "hair_01",
    top: "top_01",
    bottom: "bottom_01",
    shoes: "shoes_01",
    accessory: null,
  });

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadMe = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      setLoading(true);
      const r = await apiFetch("/me", { headers: authHeaders });
      const u = r?.user;

      setFullName(u?.name || "");
      setUsername(u?.username || "");
      setEmail(u?.email || "");
      setPendingEmail(u?.pendingEmail || null);
      setAvatarConfig(
        u?.avatarConfig || {
          skin: "skin_01",
          hair: "hair_01",
          top: "top_01",
          bottom: "bottom_01",
          shoes: "shoes_01",
          accessory: null,
        }
      );
    } catch (e) {
      console.log("❌ loadMe:", e?.data || e?.message);
      Alert.alert("Error", "No se pudo cargar tu perfil.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const onSave = async () => {
    try {
      setSaving(true);

      // 1) Perfil
      const r = await apiFetch("/me", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ name: fullName, username, email }),
      });

      // 2) Avatar
      await apiFetch("/me/avatar", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ avatarConfig }),
      });

      if (r?.emailChangePending) {
        setPendingEmail(r?.user?.pendingEmail || email);
        Alert.alert(
          "Confirma tu correo nuevo",
          `Te enviamos un código a ${r?.user?.pendingEmail || email}. Ingrésalo abajo para terminar el cambio -- mientras tanto sigues usando tu correo anterior.`
        );
      } else {
        Alert.alert("Listo", "Cambios guardados ✅");
      }
      await loadMe();
    } catch (e) {
      console.log("❌ save:", e?.data || e?.message);

      if (e?.status === 401) return Alert.alert("Sesión", "Tu sesión expiró. Inicia de nuevo.");
      if (e?.status === 409) return Alert.alert("Duplicado", "Ese usuario o correo ya existe.");
      if (e?.status === 400 && e?.data?.error === "BAD_USERNAME") {
        return Alert.alert("Usuario inválido", "Usa 3-20 caracteres: letras, números o _");
      }

      Alert.alert("Error", "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const onConfirmEmailCode = async () => {
    if (!emailCode.trim() || emailCode.trim().length !== 6) {
      Alert.alert("Código inválido", "Escribe el código de 6 dígitos que te enviamos.");
      return;
    }
    try {
      setConfirmingEmail(true);
      const r = await apiFetch("/me/confirm-email", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: emailCode.trim() }),
      });
      setPendingEmail(null);
      setEmailCode("");
      setEmail(r?.email || email);
      Alert.alert("Listo ✅", "Tu correo se actualizó.");
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "OTP_EXPIRED") Alert.alert("Código expirado", "Pide uno nuevo.");
      else if (errCode === "INVALID_CODE") Alert.alert("Código incorrecto", "Revisa el código e inténtalo de nuevo.");
      else if (errCode === "TOO_MANY_ATTEMPTS") Alert.alert("Demasiados intentos", "Pide un código nuevo.");
      else Alert.alert("Error", errCode || e?.message);
    } finally {
      setConfirmingEmail(false);
    }
  };

  const onResendEmailCode = async () => {
    try {
      await apiFetch("/me/resend-email-code", { method: "POST", headers: authHeaders });
      Alert.alert("Enviado", "Te mandamos un nuevo código. Revisa spam si no lo ves.");
    } catch (e) {
      const errCode = e?.data?.error;
      if (errCode === "RESEND_COOLDOWN") Alert.alert("Espera un momento", "Ya te enviamos un código hace poco.");
      else Alert.alert("Error", errCode || e?.message);
    }
  };

  // No hay endpoint para "cancelar" -- el código simplemente expira solo
  // en 10 min si no se confirma. Esto solo oculta el aviso en pantalla.
  const onDismissEmailChange = () => {
    setEmailCode("");
    loadMe();
  };

  // Step 2 of 2: performs the actual deletion after the user confirms.
  // Split from onDeleteAccount so the error path never signs the user out
  // without having actually deleted their data on the server.
  const confirmDelete = async () => {
    setDeleting(true);

    try {
      // 1. Hit DELETE /api/me — backend deletes user + related collections
      await deleteAccount(token);
    } catch (e) {
      // Server failed: keep the session alive so the user can retry
      setDeleting(false);
      const msg =
        e?.data?.error === "USER_NOT_FOUND"
          ? "Esta cuenta ya no existe en el servidor."
          : "No se pudo eliminar la cuenta. Intenta de nuevo o contacta a soporte.";
      Alert.alert("Error al eliminar", msg);
      return;
    }

    // 2. Server confirmed deletion — invalidate the local session.
    //    setDeleting(false) is intentionally omitted here: the component
    //    re-renders as GuestPrompt after signOut() clears the token, so
    //    updating that state would write to an effectively dead render.
    await signOut();
    navigation.popToTop();
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción es permanente y no se puede deshacer. Todos tus datos, puntos y recompensas serán eliminados.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, eliminar", style: "destructive", onPress: confirmDelete },
      ]
    );
  };

  if (!token) {
    return (
      <Screen style={styles.screen} safeStyle={styles.screen} edges={["top", "left", "right"]}>
        <GuestPrompt
          title="Configuración"
          message="Inicia sesión para gestionar tu cuenta y avatar."
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} safeStyle={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={[
    styles.content,
    { paddingBottom: tabBarHeight + 28 },
  ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Configuración</Text>
            <Text style={styles.sub}>Cuenta, seguridad y preferencias</Text>
          </View>

          <Pressable onPress={() => navigation.goBack()} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>regresar</Text>
          </Pressable>
        </View>

        {/* Card: Perfil */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Perfil</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Usuario</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="@usuario"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          {/* ✅ Cambio de correo pendiente de confirmar -- el correo de
              arriba sigue siendo el real hasta que se confirme este código. */}
          {pendingEmail ? (
            <View style={styles.emailConfirmBox}>
              <Text style={styles.emailConfirmTitle}>Confirma tu correo nuevo</Text>
              <Text style={styles.emailConfirmText}>
                Enviamos un código a {pendingEmail}. Tu correo sigue siendo {email} hasta que lo confirmes.
              </Text>

              <TextInput
                value={emailCode}
                onChangeText={setEmailCode}
                placeholder="Código de 6 dígitos"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, { marginTop: 8 }]}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={onConfirmEmailCode}
                  disabled={confirmingEmail}
                  style={[styles.emailConfirmBtn, confirmingEmail && { opacity: 0.7 }]}
                >
                  <Text style={styles.emailConfirmBtnText}>
                    {confirmingEmail ? "Confirmando..." : "Confirmar"}
                  </Text>
                </Pressable>

                <Pressable onPress={onResendEmailCode} style={styles.emailConfirmLinkBtn}>
                  <Text style={styles.emailConfirmLinkText}>Reenviar</Text>
                </Pressable>

                <Pressable onPress={onDismissEmailChange} style={styles.emailConfirmLinkBtn}>
                  <Text style={styles.emailConfirmLinkText}>Ahora no</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Preview del avatar */}
          <Pressable
            onPress={() => navigation.navigate("AvatarCustomize", { avatarConfig })}
            style={styles.avatarPreviewRow}
          >
            <View style={styles.avatarCircle}>
              <AvatarPreview config={avatarConfig} size={56} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.avatarTitle}>Tu avatar</Text>
              <Text style={styles.avatarHint}>Toca para cambiar cabello, ropa y más.</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("AvatarCustomize", { avatarConfig })}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Personalizar avatar</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onSave}
          style={[styles.primaryBtn, (saving || loading) && { opacity: 0.7 }]}
          disabled={saving || loading}
        >
          <Text style={styles.primaryBtnText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
        </Pressable>

        <Pressable
          onPress={onDeleteAccount}
          style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
          disabled={deleting}
        >
          <Text style={styles.deleteBtnText}>
            {deleting ? "Eliminando..." : "Eliminar cuenta"}
          </Text>
        </Pressable>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ✅ Screen ya maneja paddingHorizontal, aquí solo aseguras el fondo
  screen: { backgroundColor: "#0b0709" },

  wrap: { flex: 1, backgroundColor: "transparent" },

  // ✅ IMPORTANTE: ya NO pongas paddingHorizontal aquí (lo pone Screen)
  content: { paddingBottom: 28 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 12 },

  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  logoutText: { color: colors.accent, fontWeight: "800", fontSize: 12 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginBottom: 12,
  },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 14, marginBottom: 10 },

  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 8 },

  // ✅ Vive dentro de la tarjeta blanca "Perfil" (igual que el input de
  // correo arriba), no sobre el fondo oscuro de la pantalla.
  emailConfirmBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(232,207,174,0.16)",
    borderWidth: 1,
    borderColor: "rgba(232,207,174,0.5)",
  },
  emailConfirmTitle: { color: colors.primary, fontWeight: "900", fontSize: 13, marginBottom: 4 },
  emailConfirmText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  emailConfirmBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  emailConfirmBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  emailConfirmLinkBtn: { paddingVertical: 10, paddingHorizontal: 6 },
  emailConfirmLinkText: { color: colors.primary, fontWeight: "800", fontSize: 12, textDecorationLine: "underline" },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    color: "#111",
    fontSize: 14,
  },

  avatarPreviewRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  avatarTitle: { color: "#111", fontWeight: "900", fontSize: 13 },
  avatarHint: { marginTop: 2, color: "#666", fontSize: 11 },

  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "900", fontSize: 13 },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  deleteBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#EF4444",
    backgroundColor: "#FFF",
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#EF4444",
    fontWeight: "900",
    fontSize: 14,
  },
});
