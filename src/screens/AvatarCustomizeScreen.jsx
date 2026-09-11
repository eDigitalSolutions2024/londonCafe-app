import React, { useState, useContext, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import Avatar3DViewer from "../components/Avatar3DViewer";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import {
  HAIR_OPTIONS,
  HEAD_OPTIONS,
  BODY_OPTIONS,
  OUTFIT_OPTIONS,
  ACCESSORY_OPTIONS,
  SKIN_COLORS,
  HAIR_COLORS,
  nearestSkinColor,
} from "../assets/avatar3dParts";

const PET_SPECIES = [
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "dog", emoji: "🐶", label: "Perro" },
  { id: "hamster", emoji: "🐹", label: "Hámster" },
];

// Muestrea el tono de piel promedio del centro de una foto -- corre 100%
// en el cliente (WebView + canvas, la imagen nunca sale del teléfono ni se
// sube al backend). Se monta solo mientras hay una foto pendiente de
// analizar y se desmonta al terminar.
function PhotoSkinSampler({ base64, onSample }) {
  const html = `<!DOCTYPE html><html><body style="margin:0">
<canvas id="c" width="40" height="40"></canvas>
<script>
  var img = new Image();
  img.onload = function () {
    var c = document.getElementById("c");
    var ctx = c.getContext("2d");
    var side = Math.min(img.width, img.height) * 0.5;
    var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, 40, 40);
    var data = ctx.getImageData(0, 0, 40, 40).data;
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; n++; }
    var result = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
  };
  img.onerror = function () { window.ReactNativeWebView.postMessage(JSON.stringify({ error: true })); };
  img.src = "data:image/jpeg;base64,${base64}";
</script>
</body></html>`;

  return (
    <View style={{ width: 1, height: 1, opacity: 0, position: "absolute" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            onSample(d.error ? null : d);
          } catch {
            onSample(null);
          }
        }}
      />
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

function ColorRow({ title, colors: opts, value, onChange }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.colorRow}>
        {opts.map((hex) => {
          const active = value === hex;
          return (
            <Pressable
              key={hex}
              onPress={() => onChange(hex)}
              style={[styles.swatch, { backgroundColor: hex }, active && styles.swatchActive]}
            />
          );
        })}
      </View>
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
    hair: existing?.parts?.hair || HAIR_OPTIONS[0].id,
    head: existing?.parts?.head || HEAD_OPTIONS[0].id,
    body: existing?.parts?.body || BODY_OPTIONS[0].id,
    outfit: existing?.parts?.outfit || OUTFIT_OPTIONS[0].id,
    accessory: existing?.parts?.accessory ?? null,
  });
  const [avColors, setAvColors] = useState({
    skin: existing?.colors?.skin || SKIN_COLORS[1],
    hair: existing?.colors?.hair || HAIR_COLORS[0],
  });

  const [pendingPhoto, setPendingPhoto] = useState(null); // {base64}
  const viewerRef = useRef(null);

  const setPart = (slot, val) => setParts((p) => ({ ...p, [slot]: val }));
  const setColor = (key, val) => setAvColors((c) => ({ ...c, [key]: val }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para sugerir un tono de piel.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.base64) setPendingPhoto({ base64: asset.base64, uri: asset.uri });
  };

  const onSkinSampled = (rgb) => {
    setPendingPhoto(null);
    if (!rgb) {
      Alert.alert("No se pudo leer la foto", "Elige tu tono de piel manualmente abajo.");
      return;
    }
    setColor("skin", nearestSkinColor(rgb));
  };

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
        body: JSON.stringify({ parts, colors: avColors }),
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
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <View style={styles.card}>
          <View style={styles.previewWrap}>
            <Avatar3DViewer ref={viewerRef} parts={parts} colors={avColors} interactive size={240} />
          </View>

          <Pressable onPress={pickPhoto} style={styles.photoBtn}>
            <Text style={styles.photoBtnText}>📷 Sugerir tono de piel con una foto</Text>
          </Pressable>
          {pendingPhoto && (
            <PhotoSkinSampler base64={pendingPhoto.base64} onSample={onSkinSampled} />
          )}

          <ColorRow title="Tono de piel" colors={SKIN_COLORS} value={avColors.skin} onChange={(v) => setColor("skin", v)} />
          <PartRow title="Pelo" options={HAIR_OPTIONS} value={parts.hair} onChange={(v) => setPart("hair", v)} />
          <ColorRow title="Color de pelo" colors={HAIR_COLORS} value={avColors.hair} onChange={(v) => setColor("hair", v)} />
          <PartRow title="Cara" options={HEAD_OPTIONS} value={parts.head} onChange={(v) => setPart("head", v)} />
          <PartRow title="Cuerpo" options={BODY_OPTIONS} value={parts.body} onChange={(v) => setPart("body", v)} />
          <PartRow title="Atuendo" options={OUTFIT_OPTIONS} value={parts.outfit} onChange={(v) => setPart("outfit", v)} />
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

  previewWrap: { alignItems: "center", marginBottom: 10 },

  photoBtn: {
    alignSelf: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginBottom: 6,
  },
  photoBtnText: { color: colors.primary, fontWeight: "900", fontSize: 12 },

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

  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.primary },

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
