import React, { useState, useContext, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Image } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import Avatar3DViewer from "../components/Avatar3DViewer";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import { CHARACTER_OPTIONS, SKIN_TONE_OPTIONS, SKIN_TONE_SUPPORTED_CHARACTERS } from "../assets/avatar3dParts";

const PET_SPECIES = [
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "dog", emoji: "🐶", label: "Perro" },
  { id: "hamster", emoji: "🐹", label: "Hámster" },
];

// Selector de tono de piel -- recolorea SOLO la piel del personaje ya
// elegido (ver applySkinTint() en Avatar3DViewer.jsx), sin tocar su pelo/
// ropa/outfit. Antes esto cambiaba de personaje por completo (confundía
// tono de piel con "otro personaje distinto" -- ej. elegir "Moreno" te
// mandaba a un policía con gorra en vez de solo oscurecer la piel).
//
// Solo se muestra con los personajes A (Chico/Chica) -- ver
// SKIN_TONE_SUPPORTED_CHARACTERS en avatar3dParts.js: en los demás
// personajes el color de piel comparte franja de la paleta con su pelo/
// ropa y el recoloreo se ve mal (confirmado en pruebas). Mejor ocultar el
// picker en esos que dejarlo prometiendo algo que no hace bien.
function SkinToneRow({ value, onChange, character }) {
  if (!SKIN_TONE_SUPPORTED_CHARACTERS.has(character)) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tono de piel</Text>
        <Text style={styles.skinUnsupportedHint}>
          Por ahora disponible solo con Chico A / Chica A -- para los demás personajes llega pronto.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tono de piel</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        <View style={styles.skinRow}>
          {SKIN_TONE_OPTIONS.map((tone) => {
            const active = value === tone.id;
            return (
              <Pressable
                key={tone.id}
                onPress={() => onChange(active ? null : tone.id)}
                style={[styles.skinBtn, active && styles.skinBtnActive]}
              >
                <View style={[styles.skinSwatch, { backgroundColor: tone.color }]} />
                <Text style={[styles.skinLabel, active && styles.skinLabelActive]}>{tone.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// Elige el personaje base (modelo .glb completo, ver avatar3dParts.js) --
// reemplaza al viejo picker de 9 partes sueltas (pelo/cejas/nariz/etc)
// ahora que el cuerpo es un modelo real en vez de geometría armada a mano.
//
// v2: en vez de una sola fila con los 12 mezclados, se separan en 2 filas
// (Chicos / Chicas) que se desplazan JUNTAS (un solo ScrollView con ambas
// filas adentro) -- así la variante A de cada género queda alineada en
// columna con la B, C, etc., en vez de tener que buscarla suelta en la fila.
function CharacterRow({ options, value, onChange }) {
  const chicos = options.filter((o) => o.id.startsWith("kenney_male_"));
  const chicas = options.filter((o) => o.id.startsWith("kenney_female_"));

  const renderRow = (opts) => (
    <View style={styles.charRow}>
      {opts.map((opt) => {
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
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Personaje</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        <View>
          {renderRow(chicos)}
          <View style={{ height: 8 }} />
          {renderRow(chicas)}
        </View>
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
// En este modo el picker de personaje solo ofrece Chico A / Chica A (no
// los 12) -- primera impresión más simple, y de paso evita el tono de
// piel roto: solo esos dos personajes lo soportan bien (ver
// SKIN_TONE_SUPPORTED_CHARACTERS en avatar3dParts.js). El resto de
// personajes se desbloquea después desde "Personalizar avatar".
const STARTER_CHARACTER_IDS = new Set(["kenney_male_a", "kenney_female_a"]);

export default function AvatarCustomizeScreen({ navigation, forced = false, onDone }) {
  const { token, setUser, user } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);

  const existing = user?.avatar3d;
  // accessory: forzado a null (no se lee `existing`) -- el picker de
  // lentes/gorra está apagado por lo pronto (ver Avatar3DViewer.jsx), así
  // que guardar desde acá limpia cualquier accesorio que hubiera quedado
  // de antes en vez de mantenerlo guardado sin forma de quitarlo.
  const [parts, setParts] = useState({
    character: existing?.parts?.character || CHARACTER_OPTIONS[0].id,
    accessory: null,
    skinTone: existing?.parts?.skinTone || null,
  });

  const viewerRef = useRef(null);

  const setPart = (slot, val) => setParts((p) => ({ ...p, [slot]: val }));

  // Mascota (sin cambios -- especie/nombre; cuidarla vive en PetScreen).
  // Ya no tiene su propio botón "Guardar mascota" -- se guarda junto con
  // el avatar en un solo botón (onSave), ver ahí.
  const [petOwned, setPetOwned] = useState(false);
  const [petSpecies, setPetSpecies] = useState("cat");
  const [petName, setPetName] = useState("");
  const [petOrigName, setPetOrigName] = useState("");
  const [petOrigSpecies, setPetOrigSpecies] = useState("cat");

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

  // Un solo botón guarda TODO: el avatar 3D y, si hay cambios pendientes,
  // también el nombre/especie de la mascota -- antes eran dos botones
  // separados (uno para cada cosa), confuso porque "Guardar avatar" no
  // guardaba la mascota y viceversa.
  const onSave = async () => {
    if (!token) {
      Alert.alert("Sesión", "No hay token. Vuelve a iniciar sesión.");
      return;
    }
    if (petDirty && !petName.trim()) {
      Alert.alert("Falta el nombre", "Ponle un nombre a tu mascota.");
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

      if (petDirty) {
        const clean = petName.trim();
        const pr = await apiFetch("/pet/customize", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ species: petSpecies, name: clean }),
        });
        const p = pr?.pet;
        setPetOrigSpecies(p?.species || petSpecies);
        setPetOrigName(p?.name || clean);
      }

      if (forced) {
        onDone?.(avatar3d);
      } else {
        Alert.alert("Listo", "Todo quedó guardado ✅");
        if (navigation?.canGoBack?.()) navigation.goBack();
      }
    } catch (e) {
      console.log("❌ save avatar3d/pet:", e?.data || e?.message);
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
          <SkinToneRow value={parts.skinTone} onChange={(v) => setPart("skinTone", v)} character={parts.character} />
          <CharacterRow
            options={forced ? CHARACTER_OPTIONS.filter((o) => STARTER_CHARACTER_IDS.has(o.id)) : CHARACTER_OPTIONS}
            value={parts.character}
            onChange={(v) => setPart("character", v)}
          />
          {forced ? (
            <Text style={styles.starterHint}>
              Más personajes se desbloquean después desde "Personalizar avatar" 🎉
            </Text>
          ) : null}

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
            <Text style={styles.saveText}>{saving ? "Guardando..." : "Guardar"}</Text>
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

  skinRow: { flexDirection: "row", alignItems: "center" },
  skinBtn: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  skinBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  skinSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.12)" },
  skinLabel: { marginTop: 4, color: "#111", fontSize: 10.5, fontWeight: "900" },
  skinLabelActive: { color: "#fff" },
  skinUnsupportedHint: { color: colors.textMuted, fontSize: 11.5, fontWeight: "700", lineHeight: 16 },
  starterHint: { marginTop: -6, color: colors.textMuted, fontSize: 11.5, fontWeight: "700", lineHeight: 16 },

  charRow: { flexDirection: "row" },
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
  petLinkBtn: { paddingVertical: 12, paddingHorizontal: 14 },
  petLinkText: { color: colors.primary, fontWeight: "900", fontSize: 13 },
});
