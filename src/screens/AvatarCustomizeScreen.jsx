import React, { useState, useContext, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Image } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import Avatar3DViewer from "../components/Avatar3DViewer";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import { CHARACTER_OPTIONS, ACCESSORY_OPTIONS } from "../assets/avatar3dParts";

const PET_SPECIES = [
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "dog", emoji: "🐶", label: "Perro" },
  { id: "hamster", emoji: "🐹", label: "Hámster" },
];

// Elige el personaje base (modelo .glb completo, ver avatar3dParts.js) --
// reemplaza al viejo picker de 9 partes sueltas (pelo/cejas/nariz/etc)
// ahora que el cuerpo es un modelo real en vez de geometría armada a mano.
function CharacterRow({ options, value, onChange }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Personaje</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[styles.charBtn, active && styles.charBtnActive]}
            >
              <Image source={{ uri: opt.preview }} style={styles.charThumb} />
              <Text style={[styles.partLabel, active && styles.partLabelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PartRow({ title, options, value, onChange }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={String(opt.id)}
              onPress={() => onChange(opt.id)}
              style={[styles.partBtn, active && styles.partBtnActive]}
            >
              <Text style={styles.partEmoji}>{opt.emoji}</Text>
              <Text style={[styles.partLabel, active && styles.partLabelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// `forced`: usado por Avatar3DGateScreen (migración obligatoria post-login)
// -- oculta "Cerrar" y la sección de mascota (no aplica en ese momento) y
// llama `onDone` en vez de navigation.goBack() al terminar de guardar.
export default function AvatarCustomizeScreen({ navigation, forced = false, onDone }) {
  const { token, setUser, user } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);

  const existing = user?.avatar3d;
  const [parts, setParts] = useState({
    character: existing?.parts?.character || CHARACTER_OPTIONS[0].id,
    accessory: existing?.parts?.accessory ?? null,
  });

  const viewerRef = useRef(null);

  const setPart = (slot, val) => setParts((p) => ({ ...p, [slot]: val }));

  // Mascota (sin cambios -- especie/nombre; cuidarla vive en PetScreen)
  const [petOwned, setPetOwned] = useState(false);
  const [petSpecies, setPetSpecies] = useState("cat");
  const [petName, setPetName] = useState("");
  const [petOrigName, setPetOrigName] = useState("");
  const [petOrigSpecies, setPetOrigSpecies] = useState("cat");
  const [petSaving, setPetSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch("/pet", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        const p = r?.pet;
        if (p?.owned) {
          setPetOwned(true);
          setPetSpecies(p.species || "cat");
          setPetName(p.name || "");
          setPetOrigSpecies(p.species || "cat");
          setPetOrigName(p.name || "");
        } else {
          setPetOwned(false);
        }
      })
      .catch((e) => console.log("❌ AvatarCustomize pet:", e?.data || e?.message));
  }, [token]);

  const petDirty = petOwned && (petSpecies !== petOrigSpecies || petName.trim() !== petOrigName);

  const savePet = async () => {
    const clean = petName.trim();
    if (!clean) {
      Alert.alert("Falta el nombre", "Ponle un nombre a tu mascota.");
      return;
    }
    try {
      setPetSaving(true);
      const r = await apiFetch("/pet/customize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ species: petSpecies, name: clean }),
      });
      const p = r?.pet;
      setPetOrigSpecies(p?.species || petSpecies);
      setPetOrigName(p?.name || clean);
      Alert.alert("Listo", "Mascota actualizada 🐾");
    } catch (e) {
      const err = e?.data?.error || e?.message;
      Alert.alert("Error", err === "NO_CHANGES" ? "No cambiaste nada." : err || "No se pudo.");
    } finally {
      setPetSaving(false);
    }
  };

  const onSave = async () => {
    if (!token) {
      Alert.alert("Sesión", "No hay token. Vuelve a iniciar sesión.");
      return;
    }
    try {
      setSaving(true);

      const r = await apiFetch("/me/avatar3d", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parts }),
      });

      const dataUrl = await viewerRef.current?.capture();
      let avatar3d = r?.avatar3d;
      if (dataUrl) {
        const snapRes = await apiFetch("/me/avatar3d/snapshot", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        avatar3d = snapRes?.avatar3d || avatar3d;
      }

      if (setUser) {
        setUser((prev) => ({ ...(prev || {}), avatar3d }));
      }

      if (forced) {
        onDone?.(avatar3d);
      } else {
        Alert.alert("Listo", "Tu avatar 3D quedó guardado ✅");
        if (navigation?.canGoBack?.()) navigation.goBack();
      }
    } catch (e) {
      console.log("❌ save avatar3d:", e?.data || e?.message);
      Alert.alert("Error", e?.data?.error || e?.message || "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen safeStyle={styles.safeDark}>
      {/* Fuera del ScrollView a propósito: el avatar se queda fijo
          arriba mientras el resto (partes/colores) hace scroll abajo,
          en vez de perderse de vista al bajar a elegir algo. */}
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{forced ? "¡Crea tu avatar 3D! 🎉" : "Tu avatar 3D"}</Text>
            <Text style={styles.sub}>
              {forced
                ? "Arrástralo para girarlo, elige tus partes abajo y guarda para continuar"
                : "Arrastra para girarlo · elige tus partes abajo"}
            </Text>
          </View>
          {!forced && navigation?.canGoBack?.() && (
            <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.stickyCard}>
          <Avatar3DViewer ref={viewerRef} parts={parts} interactive size={240} />
        </View>
      </View>

      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <CharacterRow options={CHARACTER_OPTIONS} value={parts.character} onChange={(v) => setPart("character", v)} />
          <PartRow title="Accesorio" options={ACCESSORY_OPTIONS} value={parts.accessory} onChange={(v) => setPart("accessory", v)} />

          {/* Mascota VIP -- especie/nombre; cuidarla vive en PetScreen.
              No aplica todavía en el gate obligatorio post-login. */}
          {!forced && (
          <View style={styles.section}>
            <View style={styles.vipHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.accent }]}>🐾 Mascota VIP</Text>
              <Text style={styles.vipHint}>Exclusivo VIP</Text>
            </View>

            {petOwned ? (
              <>
                <View style={styles.optionsRow}>
                  {PET_SPECIES.map((s) => {
                    const active = petSpecies === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setPetSpecies(s.id)}
                        style={[styles.petSpeciesBtn, active && styles.petSpeciesBtnActive]}
                      >
                        <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                        <Text style={[styles.petSpeciesLabel, active && styles.petSpeciesLabelActive]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={petName}
                  onChangeText={setPetName}
                  placeholder="Nombre de la mascota"
                  placeholderTextColor={colors.textMuted}
                  maxLength={20}
                  autoCorrect={false}
                  autoComplete="off"
                  autoCapitalize="words"
                  importantForAutofill="no"
                  style={styles.petNameInput}
                />

                <View style={styles.petBtnRow}>
                  <Pressable
                    onPress={savePet}
                    disabled={!petDirty || petSaving}
                    style={[styles.petSaveBtn, (!petDirty || petSaving) && { opacity: 0.5 }]}
                  >
                    <Text style={styles.petSaveText}>{petSaving ? "Guardando..." : "Guardar mascota"}</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate("Pet")} style={styles.petLinkBtn}>
                    <Text style={styles.petLinkText}>Cuidarla 🐾</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => navigation.navigate("Pet")}
                style={[styles.partBtn, { alignSelf: "flex-start" }]}
              >
                <Text style={styles.partLabel} numberOfLines={1}>
                  🐾 Adopta tu mascota
                </Text>
              </Pressable>
            )}
          </View>
          )}

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.75 }]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? "Guardando..." : "Guardar avatar"}</Text>
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
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },

  fixedTop: { paddingHorizontal: 20, paddingTop: 20 },

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

  stickyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginBottom: 4,
  },

  section: { marginTop: 14 },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 0.3, marginBottom: 10 },

  vipHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  vipHint: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },

  optionsRow: { flexDirection: "row", flexWrap: "wrap" },

  partBtn: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    marginRight: 10,
  },
  partBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  partEmoji: { fontSize: 22 },
  partLabel: { marginTop: 4, color: "#111", fontSize: 11, fontWeight: "900" },
  partLabelActive: { color: "#fff" },

  charBtn: {
    alignItems: "center",
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    marginRight: 10,
  },
  charBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  charThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.primarySoft },

  saveBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  petSpeciesBtn: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    marginRight: 10,
    marginBottom: 10,
  },
  petSpeciesBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  petSpeciesLabel: { marginTop: 4, color: "#111", fontSize: 11, fontWeight: "900" },
  petSpeciesLabelActive: { color: "#fff" },
  petNameInput: {
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    marginTop: 2,
  },
  petBtnRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  petSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center" },
  petSaveText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  petLinkBtn: { paddingVertical: 12, paddingHorizontal: 14 },
  petLinkText: { color: colors.primary, fontWeight: "900", fontSize: 13 },
});
