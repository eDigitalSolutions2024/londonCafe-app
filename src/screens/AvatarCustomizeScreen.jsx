import React, { useState, useContext, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import AvatarPreview from "../components/AvatarPreview";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

const OPTIONS = {
  // ✅ por ahora: SOLO color de pelo + ropa
   hair: ["hair_01", "hair_02", "hair_03", "hair_04", "hair_05"],
  top: ["top_01", "top_02", "top_03"],
};

const labelMap = {
  hairColor: "Color de cabello",
  top: "Ropa",
};

function prettyLabel(v) {
  return String(v).replace(/_/g, " ");
}

export default function AvatarCustomizeScreen({ navigation }) {
  const { token, setUser, user } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);

  // ✅ defaults completos (aunque no se muestren en UI)
  const defaults = useMemo(
    () => ({
      skin: "skin_01",
      eyes: "eyes_01",
      hair: null, // por si luego agregas forma de pelo
      hairColor: "hairColor_01", // ✅ tu caso actual
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    }),
    []
  );

  // ✅ merge: si user.avatarConfig viene viejo, no se rompe
  const initialConfig = useMemo(() => {
    const fromUser = user?.avatarConfig || {};
    return { ...defaults, ...fromUser };
  }, [user, defaults]);

  const [avatarConfig, setAvatarConfig] = useState(initialConfig);

  const setPart = (key, value) => {
    setAvatarConfig((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    try {
      if (!token) {
        Alert.alert("Sesión", "No hay token. Vuelve a iniciar sesión.");
        return;
      }

      setSaving(true);

      const r = await apiFetch("/me/avatar", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarConfig }),
      });

      if (setUser) {
        setUser((prev) => ({
          ...(prev || {}),
          avatarConfig: r?.avatarConfig || avatarConfig,
        }));
      }

      Alert.alert("Listo", "Avatar actualizado ✅");
      navigation.goBack();
    } catch (e) {
      console.log("❌ save avatar:", e?.data || e?.message);
      Alert.alert("Error", e?.data?.error || e?.message || "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Personalizar personaje</Text>
            <Text style={styles.sub}>Toca una opción para ver cambios en tiempo real</Text>
          </View>

          <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Preview */}
          <View style={styles.previewWrap}>
            <View style={styles.previewCircle}>
              <AvatarPreview config={avatarConfig} size={150} />
            </View>
          </View>

          {/* Opciones */}
          {Object.entries(OPTIONS).map(([key, values]) => (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{labelMap[key]}</Text>

              <View style={styles.optionsRow}>
                {values.map((v) => {
                  const active = avatarConfig[key] === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setPart(key, v)}
                      style={[styles.optionBtn, active && styles.optionBtnActive]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {prettyLabel(v)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Guardar */}
          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.75 }]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
          </Pressable>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 28 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 4, color: colors.textMuted, fontSize: 12 },

  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
  },
  closeText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },

  previewWrap: { alignItems: "center", marginBottom: 8 },
  previewCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  section: { marginTop: 14 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginBottom: 10,
  },

  optionsRow: { flexDirection: "row", flexWrap: "wrap" },

  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    marginRight: 10,
    marginBottom: 10,
  },
  optionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  optionText: { color: "#111", fontSize: 12, fontWeight: "900" },
  optionTextActive: { color: "#fff" },

  saveBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
