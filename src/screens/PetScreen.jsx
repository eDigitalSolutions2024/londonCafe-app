import React, { useCallback, useContext, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview from "../components/AvatarPreview";

const SPECIES = [
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "dog", emoji: "🐶", label: "Perro" },
  { id: "hamster", emoji: "🐹", label: "Hámster" },
];

const VIP_THRESHOLD = 200;

const MOOD_FACE = {
  happy: "😊",
  meh: "😐",
  sad: "😢",
  hungry: "🍽️",
};

const MOOD_LABEL = {
  happy: "¡Feliz!",
  meh: "Tranquilo",
  sad: "Necesita cariño",
  hungry: "¡Tiene hambre!",
};

function speciesEmoji(species) {
  return SPECIES.find((s) => s.id === species)?.emoji || "🐾";
}

function Bar({ value, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function PetScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const avatarConfig = user?.avatarConfig || {};

  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [mood, setMood] = useState(null);
  const [isVIP, setIsVIP] = useState(false);
  const [points, setPoints] = useState(0);
  const [pantry, setPantry] = useState({ coffee: 0, bread: 0 });

  const [species, setSpecies] = useState("cat");
  const [name, setName] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [busy, setBusy] = useState(null); // "coffee" | "bread" | "play" | null

  const load = useCallback(async () => {
    try {
      const [petRes, walletRes] = await Promise.all([
        apiFetch("/pet"),
        apiFetch("/points/wallet").catch(() => null),
      ]);
      setPet(petRes?.pet || null);
      setMood(petRes?.mood || null);
      setIsVIP(!!petRes?.isVIP);
      if (petRes?.pantry) setPantry(petRes.pantry);
      if (walletRes) setPoints(Number(walletRes?.wallet?.balance) || 0);
    } catch (e) {
      console.log("❌ load pet:", e?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const applyResult = (r) => {
    setPet(r?.pet || null);
    setMood(r?.mood || null);
    if (r?.pantry) setPantry(r.pantry);
  };

  const onAdopt = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Falta el nombre", "Ponle un nombre a tu mascota.");
      return;
    }
    try {
      setAdopting(true);
      const r = await apiFetch("/pet/adopt", {
        method: "POST",
        body: JSON.stringify({ species, name: cleanName }),
      });
      applyResult(r);
    } catch (e) {
      const err = e?.data?.error || e?.message;
      if (err === "VIP_REQUIRED") {
        Alert.alert("Exclusivo VIP 🔒", `Necesitas ${VIP_THRESHOLD} Buddy Coins para adoptar una mascota.`);
      } else {
        Alert.alert("Error", err || "No se pudo adoptar la mascota.");
      }
    } finally {
      setAdopting(false);
    }
  };

  const onFeed = async (type) => {
    if (busy) return;
    try {
      setBusy(type);
      const r = await apiFetch("/pet/feed", { method: "POST", body: JSON.stringify({ type }) });
      applyResult(r);
    } catch (e) {
      const err = e?.data?.error || e?.message;
      if (err === "NO_COFFEE" || err === "NO_BREAD") {
        Alert.alert(
          "Despensa vacía",
          `No te queda ${err === "NO_COFFEE" ? "café" : "pan"}. Se recarga sola cada día, o gánala en la racha diaria.`
        );
      } else {
        Alert.alert("Error", err || "No se pudo alimentar.");
      }
    } finally {
      setBusy(null);
    }
  };

  const onPlay = async () => {
    if (busy) return;
    try {
      setBusy("play");
      const r = await apiFetch("/pet/play", { method: "POST" });
      applyResult(r);
    } catch (e) {
      if (e?.status === 429) {
        const mins = Math.ceil((e?.data?.secondsLeft || 0) / 60);
        Alert.alert("Ya jugaron un rato", `Deja que descanse. Vuelve en ${mins} min.`);
      } else {
        Alert.alert("Error", e?.data?.error || e?.message || "No se pudo jugar.");
      }
    } finally {
      setBusy(null);
    }
  };

  const renderOwned = () => (
    <View>
      {/* Escena: el avatar y la mascota, juntos */}
      <View style={styles.scene}>
        <View style={styles.sceneChar}>
          <AvatarPreview config={avatarConfig} size={104} />
          <Text style={styles.sceneCaption}>Tú</Text>
        </View>
        <View style={styles.sceneChar}>
          <Text style={styles.petEmoji}>{speciesEmoji(pet.species)}</Text>
          <Text style={styles.sceneCaption} numberOfLines={1}>{pet.name}</Text>
        </View>
      </View>

      <Text style={styles.moodText}>
        {MOOD_FACE[mood] || "🐾"} {MOOD_LABEL[mood] || ""}
      </Text>

      <View style={{ marginTop: 16 }}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Hambre</Text>
          <Text style={styles.statValue}>{Math.round(pet.hunger)}%</Text>
        </View>
        <Bar value={pet.hunger} color={colors.accent} />

        <View style={[styles.statRow, { marginTop: 12 }]}>
          <Text style={styles.statLabel}>Felicidad</Text>
          <Text style={styles.statValue}>{Math.round(pet.happiness)}%</Text>
        </View>
        <Bar value={pet.happiness} color={colors.primary} />
      </View>

      {/* Despensa compartida con el avatar */}
      <Text style={styles.pantryHint}>Despensa (la misma de tu avatar)</Text>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.foodBtn, (pantry.coffee <= 0 || busy) && styles.foodBtnDisabled]}
          onPress={() => onFeed("coffee")}
          disabled={pantry.coffee <= 0 || !!busy}
        >
          <Text style={styles.foodEmoji}>☕</Text>
          <Text style={styles.foodLabel}>{busy === "coffee" ? "..." : `Café · ${pantry.coffee}`}</Text>
        </Pressable>
        <Pressable
          style={[styles.foodBtn, (pantry.bread <= 0 || busy) && styles.foodBtnDisabled]}
          onPress={() => onFeed("bread")}
          disabled={pantry.bread <= 0 || !!busy}
        >
          <Text style={styles.foodEmoji}>🥐</Text>
          <Text style={styles.foodLabel}>{busy === "bread" ? "..." : `Pan · ${pantry.bread}`}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.playBtn, busy && { opacity: 0.7 }]}
        onPress={onPlay}
        disabled={!!busy}
      >
        <Text style={styles.playText}>{busy === "play" ? "..." : "🎾 Jugar"}</Text>
      </Pressable>

      <Text style={styles.tipText}>
        El café la anima mucho; el pan la alimenta. Jugar sube el ánimo sin gastar comida.
      </Text>
    </View>
  );

  return (
    <Screen safeStyle={styles.safeDark}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mi mascota VIP</Text>
            <Text style={styles.sub}>Cuídala como un Tamagotchi 🐾</Text>
          </View>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !isVIP ? (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <Text style={{ fontSize: 56, marginBottom: 8 }}>🔒</Text>
              <Text style={styles.lockedTitle}>Exclusivo para VIP</Text>
              <Text style={styles.lockedText}>
                Te faltan {Math.max(0, VIP_THRESHOLD - points)} Buddy Coins para adoptar tu mascota.
              </Text>
            </View>
          ) : !pet?.owned ? (
            <View>
              <Text style={styles.sectionTitle}>Elige a tu compañero</Text>
              <View style={styles.optionsRow}>
                {SPECIES.map((s) => {
                  const active = species === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSpecies(s.id)}
                      style={[styles.speciesBtn, active && styles.speciesBtnActive]}
                    >
                      <Text style={{ fontSize: 32 }}>{s.emoji}</Text>
                      <Text style={[styles.speciesLabel, active && styles.speciesLabelActive]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Ponle un nombre</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej. Latte"
                placeholderTextColor={colors.textMuted}
                maxLength={20}
                style={styles.nameInput}
              />

              <Pressable
                style={[styles.saveBtn, adopting && { opacity: 0.75 }]}
                onPress={onAdopt}
                disabled={adopting}
              >
                <Text style={styles.saveText}>{adopting ? "Adoptando..." : "Adoptar"}</Text>
              </Pressable>
            </View>
          ) : (
            renderOwned()
          )}
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

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.primarySoft },

  lockedTitle: { color: "#111", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  lockedText: { color: colors.textMuted, fontSize: 12.5, fontWeight: "700", textAlign: "center" },

  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 0.3, marginBottom: 10 },

  optionsRow: { flexDirection: "row", gap: 10 },
  speciesBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  speciesBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  speciesLabel: { marginTop: 6, color: "#111", fontSize: 12, fontWeight: "900" },
  speciesLabelActive: { color: "#fff" },

  nameInput: {
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },

  // Escena avatar + mascota
  scene: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    backgroundColor: "#faf3ea",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  sceneChar: { alignItems: "center", maxWidth: "46%" },
  sceneCaption: { marginTop: 4, color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  petEmoji: { fontSize: 88 },

  moodText: { marginTop: 12, textAlign: "center", color: "#111", fontSize: 15, fontWeight: "900" },

  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  statValue: { color: "#111", fontSize: 12, fontWeight: "900" },

  barTrack: { height: 10, borderRadius: 999, backgroundColor: colors.primarySoft, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },

  pantryHint: { marginTop: 18, marginBottom: 8, color: colors.textMuted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 10 },
  foodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  foodBtnDisabled: { opacity: 0.4 },
  foodEmoji: { fontSize: 26 },
  foodLabel: { marginTop: 4, color: "#111", fontSize: 12, fontWeight: "900" },

  playBtn: {
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    alignSelf: "center",
  },
  playText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  tipText: { marginTop: 12, color: colors.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 16 },

  saveBtn: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", alignSelf: "center" },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
