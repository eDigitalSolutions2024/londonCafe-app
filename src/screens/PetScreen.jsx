import React, { useCallback, useContext, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview from "../components/AvatarPreview";
import PetActor from "../components/PetActor";
import PetMiniGame from "../components/PetMiniGame";
import PetMatch3 from "../components/PetMatch3";

const SPECIES = [
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "dog", emoji: "🐶", label: "Perro" },
  { id: "hamster", emoji: "🐹", label: "Hámster" },
];

const VIP_THRESHOLD = 200;

const MOOD_LABEL = {
  happy: "😊 ¡Feliz!",
  meh: "😐 Tranquilo",
  sad: "😢 Necesita cariño",
  hungry: "🍽️ ¡Tiene hambre!",
  sleepy: "😴 Con sueño",
  dirty: "🧼 Está sucio",
};

const STAGE_LABEL = { "bebé": "Bebé", joven: "Joven", adulto: "Adulto" };

function Bar({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const ACTION_REACTION = { feed: "eat", play: "play", clean: "clean" };

export default function PetScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const avatarConfig = user?.avatarConfig || {};

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null); // petView completo
  const [points, setPoints] = useState(0);

  const [species, setSpecies] = useState("cat");
  const [name, setName] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [busy, setBusy] = useState(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [match3Open, setMatch3Open] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [reaction, setReaction] = useState({ type: null, id: 0 });
  const sleepTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [petRes, walletRes] = await Promise.all([
        apiFetch("/pet"),
        apiFetch("/points/wallet").catch(() => null),
      ]);
      setState(petRes || null);
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
      return () => sleepTimer.current && clearTimeout(sleepTimer.current);
    }, [load])
  );

  const applyResult = (r) => {
    setState(r || null);
    if (r?.action && ACTION_REACTION[r.action]) {
      setReaction((x) => ({ type: ACTION_REACTION[r.action], id: x.id + 1 }));
    }
    if (r?.action === "sleep") {
      setSleeping(true);
      sleepTimer.current && clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => setSleeping(false), 2600);
    }
  };

  const call = async (path, body, key) => {
    if (busy) return null;
    try {
      setBusy(key);
      const r = await apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      applyResult(r);
      return r;
    } catch (e) {
      const err = e?.data?.error || e?.message;
      const map = {
        NO_COFFEE: "Ya no te queda café. Pásate por London Café y con tu compra recargas su despensa.",
        NO_BREAD: "Ya no te queda pan. Pásate por London Café y con tu compra recargas su despensa.",
        PET_TIRED: "Tu mascota está agotada de jugar. Dale un café ☕ o déjala dormir 😴 para seguir.",
        CLEAN_COOLDOWN: "Espera un momento antes de volver a limpiar.",
        SLEEP_COOLDOWN: `Acaba de dormir. Vuelve en ${Math.ceil((e?.data?.secondsLeft || 0) / 60)} min.`,
        NOT_TIRED: "Todavía tiene energía, no quiere dormir.",
        ALREADY_CLEAN: "Ya está limpio ✨",
      };
      Alert.alert("", map[err] || err || "No se pudo.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const onAdopt = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Falta el nombre", "Ponle un nombre a tu mascota.");
      return;
    }
    try {
      setAdopting(true);
      const r = await apiFetch("/pet/adopt", { method: "POST", body: JSON.stringify({ species, name: cleanName }) });
      setState(r || null);
    } catch (e) {
      const err = e?.data?.error || e?.message;
      if (err === "VIP_REQUIRED") Alert.alert("Exclusivo VIP 🔒", `Necesitas ${VIP_THRESHOLD} Buddy Coins para adoptar una mascota.`);
      else Alert.alert("Error", err || "No se pudo adoptar.");
    } finally {
      setAdopting(false);
    }
  };

  const onGameFinish = async (score) => {
    setGameOpen(false);
    await call("/pet/play", { score }, "play");
  };

  const onMatch3Finish = async (score) => {
    setMatch3Open(false);
    await call("/pet/play", { score }, "play");
  };

  const pet = state?.pet;
  const owned = !!pet?.owned;
  // `state.isVIP` viene de isUserVIP() en el backend, que llama al POS y
  // falla cerrado si hay un blip de red. Como ya tenemos el saldo real
  // del wallet (points), usamos ese como respaldo -- adoptar igual se
  // valida server-side, así que no se pierde el gate.
  const isVIP = owned || (state ? !!state.isVIP : false) || points >= VIP_THRESHOLD;
  const pantry = state?.pantry || { coffee: 0, bread: 0 };
  const mood = state?.mood;
  const mess = !!pet?.mess;
  const tired = Number(pet?.energy ?? 100) <= 80;
  const energy = Number(pet?.energy ?? 100);
  const canPlay = energy >= 22; // mismo umbral que PLAY_MIN_ENERGY en el backend

  const renderOwned = () => (
    <View>
      {/* Escena */}
      <View style={styles.scene}>
        <View style={styles.sceneChar}>
          <AvatarPreview config={avatarConfig} size={96} />
          <Text style={styles.sceneCaption}>Tú</Text>
        </View>
        <View style={styles.sceneChar}>
          <PetActor
            species={pet.species}
            mood={mood}
            mess={mess}
            sleeping={sleeping}
            size={pet && state?.stage === "bebé" ? 78 : 92}
            reaction={reaction}
            onTapPet={() => setReaction((x) => ({ type: "tickle", id: x.id + 1 }))}
          />
          <Text style={styles.sceneCaption} numberOfLines={1}>{pet.name}</Text>
        </View>
      </View>

      <Text style={styles.moodText}>{MOOD_LABEL[mood] || "🐾"}</Text>

      {/* Nivel de amistad */}
      <View style={styles.lvlRow}>
        <Text style={styles.lvlLabel}>Nivel {state?.level || 1} · amistad</Text>
        <Text style={styles.lvlMeta}>
          Día {state?.ageDays ?? 0} · {STAGE_LABEL[state?.stage] || "Adulto"}
        </Text>
      </View>
      <View style={styles.xpTrack}>
        <View
          style={[
            styles.xpFill,
            { width: `${Math.min(100, Math.round((100 * (state?.xpInLevel || 0)) / (state?.xpForNext || 1)))}%` },
          ]}
        />
      </View>

      {/* 4 barras */}
      <Bar label="Hambre" value={pet.hunger} color={colors.accent} />
      <Bar label="Felicidad" value={pet.happiness} color={colors.primary} />
      <Bar label="Energía" value={pet.energy} color="#4f9d69" />
      <Bar label="Higiene" value={pet.hygiene} color="#4a90c2" />

      {/* Despensa */}
      <Text style={styles.pantryHint}>Despensa (la misma de tu avatar)</Text>
      <View style={styles.actionRow}>
        <ActionBtn
          emoji="☕"
          label={busy === "coffee" ? "..." : `Café · ${pantry.coffee}`}
          disabled={pantry.coffee <= 0 || !!busy}
          onPress={() => call("/pet/feed", { type: "coffee" }, "coffee")}
        />
        <ActionBtn
          emoji="🥐"
          label={busy === "bread" ? "..." : `Pan · ${pantry.bread}`}
          disabled={pantry.bread <= 0 || !!busy}
          onPress={() => call("/pet/feed", { type: "bread" }, "bread")}
        />
      </View>

      <View style={[styles.actionRow, { marginTop: 10 }]}>
        <ActionBtn
          emoji="🧼"
          label={busy === "clean" ? "..." : "Limpiar"}
          badge={mess}
          disabled={!!busy}
          onPress={() => call("/pet/clean", null, "clean")}
        />
        <ActionBtn
          emoji="😴"
          label={busy === "sleep" ? "..." : "Dormir"}
          disabled={!tired || !!busy}
          onPress={() => call("/pet/sleep", null, "sleep")}
        />
      </View>

      <View style={styles.playRow}>
        <Pressable
          style={[styles.playBtn, (!canPlay || busy) && { opacity: 0.45 }]}
          onPress={() => canPlay && !busy && setGameOpen(true)}
          disabled={!canPlay || !!busy}
        >
          <Text style={styles.playText}>🎮 Atrapa</Text>
        </Pressable>
        <Pressable
          style={[styles.playBtn, (!canPlay || busy) && { opacity: 0.45 }]}
          onPress={() => canPlay && !busy && setMatch3Open(true)}
          disabled={!canPlay || !!busy}
        >
          <Text style={styles.playText}>🧱 Tetris</Text>
        </Pressable>
      </View>

      {!canPlay ? (
        <Text style={styles.nudgeText}>
          Tu mascota está agotada de jugar. Dale un{" "}
          <Text style={{ fontWeight: "900", color: colors.primary }}>café ☕</Text> o déjala{" "}
          <Text style={{ fontWeight: "900", color: colors.primary }}>dormir 😴</Text> para seguir jugando.
          {pantry.coffee <= 0 && pantry.bread <= 0
            ? " Pásate por London Café y con tu compra recargas su despensa."
            : ""}
        </Text>
      ) : (
        <Text style={styles.tipText}>
          Jugar cansa mucho → recárgala con café/pan o un descanso. Comer ensucia un poco → límpiala.
        </Text>
      )}
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
          ) : !owned ? (
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
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="words"
                importantForAutofill="no"
                style={styles.nameInput}
              />

              <Pressable style={[styles.saveBtn, adopting && { opacity: 0.75 }]} onPress={onAdopt} disabled={adopting}>
                <Text style={styles.saveText}>{adopting ? "Adoptando..." : "Adoptar"}</Text>
              </Pressable>
            </View>
          ) : (
            renderOwned()
          )}
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <PetMiniGame
        visible={gameOpen}
        species={pet?.species}
        petName={pet?.name || "tu mascota"}
        onClose={() => setGameOpen(false)}
        onFinish={onGameFinish}
      />
      <PetMatch3
        visible={match3Open}
        species={pet?.species}
        petName={pet?.name || "tu mascota"}
        avatarConfig={avatarConfig}
        onClose={() => setMatch3Open(false)}
        onFinish={onMatch3Finish}
      />
    </Screen>
  );
}

function ActionBtn({ emoji, label, onPress, disabled, badge }) {
  return (
    <Pressable style={[styles.foodBtn, disabled && styles.foodBtnDisabled]} onPress={onPress} disabled={disabled}>
      {badge ? <View style={styles.badge} /> : null}
      <Text style={styles.foodEmoji}>{emoji}</Text>
      <Text style={styles.foodLabel}>{label}</Text>
    </Pressable>
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

  scene: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    backgroundColor: "#faf3ea",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 150,
  },
  sceneChar: { alignItems: "center", maxWidth: "48%" },
  sceneCaption: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: "800" },

  moodText: { marginTop: 12, textAlign: "center", color: "#111", fontSize: 15, fontWeight: "900" },

  lvlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  lvlLabel: { color: "#111", fontSize: 12, fontWeight: "900" },
  lvlMeta: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  xpTrack: { height: 8, borderRadius: 999, backgroundColor: colors.primarySoft, overflow: "hidden", marginTop: 6 },
  xpFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },

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
  foodEmoji: { fontSize: 24 },
  foodLabel: { marginTop: 4, color: "#111", fontSize: 12, fontWeight: "900" },
  badge: { position: "absolute", top: 8, right: 10, width: 9, height: 9, borderRadius: 999, backgroundColor: "#d9534f" },

  playRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  playBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  playText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  tipText: { marginTop: 12, color: colors.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 16 },
  nudgeText: {
    marginTop: 12,
    color: "#111",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 17,
    backgroundColor: "rgba(232,207,174,0.22)",
    borderRadius: 12,
    padding: 10,
  },

  saveBtn: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", alignSelf: "center" },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
