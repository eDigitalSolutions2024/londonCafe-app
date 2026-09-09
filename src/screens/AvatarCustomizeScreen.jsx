import React, { useState, useContext, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import AvatarPreview from "../components/AvatarPreview";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

// ✅ Opciones base (sin filtrar)
const OPTIONS = {
  hair: [
    "hair_01",
    "hair_02",
    "hair_03",
    "hair_04",
    "hair_05",
    "hair_07",
    "hair_f_01",
    "hair_f_02",
    "hair_f_03",
    "hair_f_04",
    "hair_f_05",
  ],
};

// Mismos 2 estilos marcados VIP en el backend (me.controller.js) -- si se
// agrega uno nuevo aquí, hay que agregarlo también allá o el guardado lo
// rechazará con VIP_REQUIRED.
const VIP_IDS = new Set(["hair_07", "hair_f_05"]);
const VIP_THRESHOLD = 200;

// Reemplaza "hair 01, hair 02..." por algo neutral que no revele el nombre
// interno del archivo -- mismo orden que ya mostraba la UI vieja.
const DISPLAY_NUMBER = {
  hair_01: "01",
  hair_02: "02",
  hair_03: "03",
  hair_04: "04",
  hair_05: "05",
  hair_f_01: "06",
  hair_07: "07",
  hair_f_02: "08",
  hair_f_03: "09",
  hair_f_04: "10",
  hair_f_05: "11",
};

function isFemaleId(id) {
  return String(id || "").includes("_f_");
}

function filterByGender(values, gender) {
  const g = gender || "other";
  if (g === "male") return values.filter((v) => !isFemaleId(v));
  if (g === "female") return values.filter((v) => isFemaleId(v));
  return values; // other => todo
}

function prettyLabel(v) {
  return `Avatar ${DISPLAY_NUMBER[v] || "??"}`;
}

export default function AvatarCustomizeScreen({ navigation }) {
  const { token, setUser, user } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [points, setPoints] = useState(0);

  const gender = user?.gender || "other";
  const isVIP = points >= VIP_THRESHOLD;

  // ✅ Mismo balance de Buddy Coins (Wallet V2) que ya usa RewardsScreen
  // para decidir VIP -- mismo umbral, misma fuente de verdad.
  useEffect(() => {
    if (!token) return;
    apiFetch("/points/wallet", { headers: { Authorization: `Bearer ${token}` } })
      .then((w) => setPoints(Number(w?.wallet?.balance) || 0))
      .catch((e) => console.log("❌ AvatarCustomize wallet:", e?.data || e?.message));
  }, [token]);

  // ✅ Opciones filtradas por género (other ve todo), separadas en Gratis / VIP
  const filteredOptions = useMemo(() => {
    return {
      hair: filterByGender(OPTIONS.hair, gender),
    };
  }, [gender]);

  const freeHair = useMemo(
    () => filteredOptions.hair.filter((v) => !VIP_IDS.has(v)),
    [filteredOptions]
  );
  const vipHair = useMemo(
    () => filteredOptions.hair.filter((v) => VIP_IDS.has(v)),
    [filteredOptions]
  );

  const defaults = useMemo(
    () => ({
      skin: "skin_01",
      eyes: "eyes_01",
      hair: null,
      hairColor: "hairColor_01",
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    }),
    []
  );

  const initialConfig = useMemo(() => {
    const fromUser = user?.avatarConfig || {};
    return { ...defaults, ...fromUser };
  }, [user, defaults]);

  const [avatarConfig, setAvatarConfig] = useState(initialConfig);

  // ✅ Fallback: si el hair guardado no corresponde al género, lo ajustamos
    useEffect(() => {
      const allowed = filteredOptions?.hair || [];
      if (!allowed.length) return;

      const current = avatarConfig?.hair || "hair_01";
      if (!allowed.includes(current)) {
        setAvatarConfig((prev) => ({ ...prev, hair: allowed[0] }));
      }
    }, [gender, filteredOptions]);

  const setPart = (key, value) => {
    if (key === "hair" && VIP_IDS.has(value) && !isVIP) {
      Alert.alert(
        "Estilo VIP 🔒",
        `Este estilo se desbloquea al llegar a ${VIP_THRESHOLD} Buddy Coins (llevas ${points}).`
      );
      return;
    }
    setAvatarConfig((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    try {
      if (!token) {
        Alert.alert("Sesión", "No hay token. Vuelve a iniciar sesión.");
        return;
      }

      if (VIP_IDS.has(avatarConfig.hair) && !isVIP) {
        Alert.alert("Estilo VIP 🔒", `Necesitas ${VIP_THRESHOLD} Buddy Coins para usar este estilo.`);
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
    <Screen safeStyle={styles.safeDark}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Personalizar personaje</Text>
            <Text style={styles.sub}>
              {isVIP ? "Eres miembro VIP ⚡" : `Te faltan ${Math.max(0, VIP_THRESHOLD - points)} Buddy Coins para VIP`}
            </Text>
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

          {/* Gratis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gratis</Text>
            <View style={styles.optionsRow}>
              {freeHair.map((v) => {
                const active = avatarConfig.hair === v;
                return (
                  <Pressable
                    key={`hair-${v}`}
                    onPress={() => setPart("hair", v)}
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

          {/* VIP exclusivo */}
          {vipHair.length > 0 && (
            <View style={styles.section}>
              <View style={styles.vipHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.accent }]}>★ VIP exclusivo</Text>
                {!isVIP && <Text style={styles.vipHint}>Desbloquea con {VIP_THRESHOLD} Buddy Coins</Text>}
              </View>
              <View style={styles.optionsRow}>
                {vipHair.map((v) => {
                  const active = avatarConfig.hair === v;
                  const locked = !isVIP;
                  return (
                    <Pressable
                      key={`hair-${v}`}
                      onPress={() => setPart("hair", v)}
                      style={[
                        styles.optionBtn,
                        styles.vipBtn,
                        active && styles.optionBtnActive,
                        locked && styles.vipBtnLocked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          styles.vipText,
                          active && styles.optionTextActive,
                          locked && styles.vipTextLocked,
                        ]}
                      >
                        {locked ? "🔒 " : "★ "}
                        {prettyLabel(v)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Guardar */}
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.75 }]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
          </Pressable>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeDark: { backgroundColor: "#0b0709" },
  wrap: { flex: 1, backgroundColor: "#0b0709" },
  content: { padding: 20, paddingBottom: 28 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 12 },

  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  closeText: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 12 },

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.primarySoft },

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
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 0.3, marginBottom: 10 },

  vipHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  vipHint: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },

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

  // ✅ VIP: fondo dorado suave con borde dorado -- se distingue de un
  // vistazo de los pills gratis (blancos). Cuando está bloqueado, se
  // atenúa y el candado en el texto ya comunica "no disponible".
  vipBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
  vipText: { color: "#2A0E18" },
  vipBtnLocked: { backgroundColor: "rgba(232,207,174,0.18)", borderColor: "rgba(232,207,174,0.35)" },
  vipTextLocked: { color: "rgba(255,255,255,0.55)" },

  saveBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
