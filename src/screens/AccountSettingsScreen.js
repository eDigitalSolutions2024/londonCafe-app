import React, { useContext, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from "react-native";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview from "../components/AvatarPreview";

export default function AccountSettingsScreen({ navigation }) {
  const { signOut, user } = useContext(AuthContext);

  // UI local (luego lo conectamos a backend)
  const [fullName, setFullName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // ✅ Avatar actual (de momento local / o desde user.avatarConfig si ya lo tienes)
  const [avatarConfig] = useState(
    user?.avatarConfig || {
      skin: "skin_01",
      hair: "hair_01",
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    }
  );

  const onSave = () => {
    console.log("Guardar cambios:", { fullName, username, email, currentPassword, newPassword, avatarConfig });
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Configuración</Text>
          <Text style={styles.sub}>Cuenta, seguridad y preferencias</Text>
        </View>

        <Pressable onPress={signOut} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
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

        {/* ✅ Preview del avatar actual */}
        <View style={styles.avatarPreviewRow}>
          <View style={styles.avatarCircle}>
            <AvatarPreview config={avatarConfig} size={56} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.avatarTitle}>Tu avatar</Text>
            <Text style={styles.avatarHint}>Toca para cambiar cabello, ropa y más.</Text>
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate("AvatarCustomize")}
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

      <Pressable onPress={onSave} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Guardar cambios</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sub: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
  },

  logoutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
  },
  logoutText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 10,
  },

  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
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

  // ✅ Avatar preview
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
  avatarTitle: {
    color: "#111",
    fontWeight: "900",
    fontSize: 13,
  },
  avatarHint: {
    marginTop: 2,
    color: "#666",
    fontSize: 11,
  },

  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 13,
  },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
});
