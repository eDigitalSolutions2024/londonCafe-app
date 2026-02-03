import React, { useContext, useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview from "../components/AvatarPreview";
import { apiFetch } from "../api/client";
import Screen from "../components/Screen"; // ✅ NUEVO

export default function AccountSettingsScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // perfil
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // seguridad (pendiente backend)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
    try {
      setLoading(true);
      const r = await apiFetch("/me", { headers: authHeaders });
      const u = r?.user;

      setFullName(u?.name || "");
      setUsername(u?.username || "");
      setEmail(u?.email || "");
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
      await apiFetch("/me", {
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

      // 3) Password (todavía no hay endpoint)
      if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
        Alert.alert("Aviso", "Para cambiar contraseña, llena ambos campos.");
      } else if (currentPassword && newPassword) {
        Alert.alert("Pendiente", "Aún falta crear el endpoint para cambiar contraseña en el backend.");
      }

      Alert.alert("Listo", "Cambios guardados ✅");
      setCurrentPassword("");
      setNewPassword("");
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

  return (
    <Screen style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
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

        {/* Card: Seguridad */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seguridad</Text>

          <Text style={styles.label}>Contraseña actual</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={onSave}
          style={[styles.primaryBtn, (saving || loading) && { opacity: 0.7 }]}
          disabled={saving || loading}
        >
          <Text style={styles.primaryBtnText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
        </Pressable>

        {/* espacio al final para que no se encime con tab bar */}
        <View style={{ height: 18 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ✅ Screen ya maneja paddingHorizontal, aquí solo aseguras el fondo
  screen: { backgroundColor: colors.background },

  wrap: { flex: 1, backgroundColor: "transparent" },

  // ✅ IMPORTANTE: ya NO pongas paddingHorizontal aquí (lo pone Screen)
  content: { paddingBottom: 28 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 4, color: colors.textMuted, fontSize: 12 },

  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
  },
  logoutText: { color: colors.primary, fontWeight: "800", fontSize: 12 },

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
});
