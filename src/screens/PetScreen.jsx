import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import AvatarPreview, { mergeAvatar3D } from "../components/AvatarPreview";
import Avatar3DViewer from "../components/Avatar3DViewer";
import PetActor from "../components/PetActor";
import PetMiniGame from "../components/PetMiniGame";
import PetMatch3 from "../components/PetMatch3";
import PetDoodleJump from "../components/PetDoodleJump";
import LevelMap from "../components/LevelMap";
import { MATCH3_LEVELS } from "../assets/matchLevels";
import { DOODLE_LEVELS } from "../assets/doodleLevels";
import PetLeaderboard from "../components/PetLeaderboard";

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

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function Bar({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={styles.statItem}>
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
  const avatarConfig = mergeAvatar3D(user);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null); // petView completo
  const [points, setPoints] = useState(0);

  const [species, setSpecies] = useState("cat");
  const [name, setName] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [busy, setBusy] = useState(null);
  const [gameOpen, setGameOpen] = useState(false);
  // ✅ Café Crush ahora es por niveles: `match3Open` controla si el mapa de
  // niveles está visible, y `match3Level` (no-null) cuál nivel se está
  // jugando ahora mismo -- null = mostrando el mapa, número = jugando.
  const [match3Open, setMatch3Open] = useState(false);
  const [match3Level, setMatch3Level] = useState(null);
  // Mismo patrón exacto para "Salto Café" (Doodle Jump).
  const [doodleOpen, setDoodleOpen] = useState(false);
  const [doodleLevel, setDoodleLevel] = useState(null);
  // null = cerrado, "tetris"/"doodle" = qué tabla mostrar (ver PetLeaderboard).
  const [leaderboardGame, setLeaderboardGame] = useState(null);
  // El #1 de cada juego (para que la tarjeta del minijuego presuma "a quién
  // hay que superar" sin tener que abrir la tabla completa) -- solo
  // Café Crush y Salto Café tienen tabla (Atrapa no guarda mejor puntaje).
  const [top1, setTop1] = useState({ tetris: null, doodle: null });
  // ✅ El sueño ya no es una animación cosmética de 2.6s -- el backend
  // devuelve `sleepSecondsLeft` (tiempo real restante del freeze, ver
  // pet.controller.js) y aquí solo lo hacemos "tickear" cada segundo en
  // el cliente para el contador visual.
  const [sleepLeft, setSleepLeft] = useState(0);
  const [reaction, setReaction] = useState({ type: null, id: 0 });
  const sleeping = sleepLeft > 0;

  const load = useCallback(async () => {
    try {
      const [petRes, walletRes, tetrisTop, doodleTop] = await Promise.all([
        apiFetch("/pet"),
        apiFetch("/points/wallet").catch(() => null),
        apiFetch("/pet/leaderboard?game=tetris").catch(() => null),
        apiFetch("/pet/leaderboard?game=doodle").catch(() => null),
      ]);
      setState(petRes || null);
      setSleepLeft(Math.max(0, Number(petRes?.sleepSecondsLeft) || 0));
      if (walletRes) setPoints(Number(walletRes?.wallet?.balance) || 0);
      setTop1({
        tetris: tetrisTop?.top?.[0] || null,
        doodle: doodleTop?.top?.[0] || null,
      });
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

  // Cuenta regresiva de 1 en 1 segundo mientras está dormida; al llegar a
  // 0 se refresca /pet una vez para sincronizar el estado real del server.
  useEffect(() => {
    if (sleepLeft <= 0) return;
    const t = setInterval(() => {
      setSleepLeft((s) => {
        if (s <= 1) {
          load();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [sleepLeft > 0, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyResult = (r) => {
    setState(r || null);
    setSleepLeft(Math.max(0, Number(r?.sleepSecondsLeft) || 0));
    if (r?.action && ACTION_REACTION[r.action]) {
      setReaction((x) => ({ type: ACTION_REACTION[r.action], id: x.id + 1 }));
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
      if (err === "PET_SLEEPING") {
        // El server dice que sigue dormida (pudo pasar si el conteo local
        // se desincronizó) -- se re-sincroniza el contador con el real.
        setSleepLeft(Math.max(0, Number(e?.data?.secondsLeft) || 0));
      }
      const map = {
        NO_COFFEE: "Ya no te queda café. Pásate por London Café y con tu compra recargas su despensa.",
        NO_BREAD: "Ya no te queda pan. Pásate por London Café y con tu compra recargas su despensa.",
        PET_TIRED: "Tu mascota está agotada de jugar. Dale un café ☕ o déjala dormir 😴 para seguir.",
        CLEAN_COOLDOWN: "Espera un momento antes de volver a limpiar.",
        PET_SLEEPING: `Está durmiendo 😴 Vuelve en ${Math.ceil((e?.data?.secondsLeft || 0) / 60)} min.`,
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

  const onMatch3Finish = async (score, cleared, level, won) => {
    setMatch3Level(null); // vuelve al mapa de niveles (match3Open sigue true)
    await call("/pet/play", { score, cleared, game: "tetris", level, won }, "play");
  };

  const onDoodleFinish = async (score, height, level, won) => {
    setDoodleLevel(null); // vuelve al mapa de niveles (doodleOpen sigue true)
    await call("/pet/play", { score, height, game: "doodle", level, won }, "play");
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

  const renderStatus = () => (
    <View>
      {/* Escena */}
      <View style={styles.scene}>
        <View style={styles.sceneChar}>
          {user?.avatar3d?.owned ? (
            <Avatar3DViewer parts={user.avatar3d.parts} size={92} />
          ) : (
            <AvatarPreview config={avatarConfig} size={70} />
          )}
          <Text style={styles.sceneCaption}>Tú</Text>
        </View>
        <View style={styles.sceneChar}>
          <PetActor
            species={pet.species}
            mood={mood}
            mess={mess}
            sleeping={sleeping}
            size={pet && state?.stage === "bebé" ? 58 : 68}
            reaction={reaction}
            onTapPet={() => setReaction((x) => ({ type: "tickle", id: x.id + 1 }))}
          />
          <Text style={styles.sceneCaption} numberOfLines={1}>{pet.name}</Text>
        </View>
      </View>

      {sleeping ? (
        <View style={styles.sleepBanner}>
          <Text style={styles.sleepBannerText}>
            😴 Durmiendo… lista en {formatMMSS(sleepLeft)}
          </Text>
          <Text style={styles.sleepBannerHint}>Sal y vuelve -- te avisamos cuando despierte.</Text>
        </View>
      ) : (
        <Text style={styles.moodText}>{MOOD_LABEL[mood] || "🐾"}</Text>
      )}

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

      {/* 4 barras, en grilla 2x2 para no ocupar tanto alto */}
      <View style={styles.statsGrid}>
        <Bar label="Hambre" value={pet.hunger} color={colors.accent} />
        <Bar label="Felicidad" value={pet.happiness} color={colors.primary} />
        <Bar label="Energía" value={pet.energy} color="#4f9d69" />
        <Bar label="Higiene" value={pet.hygiene} color="#4a90c2" />
      </View>

      {/* Despensa */}
      <Text style={styles.pantryHint}>Despensa (la misma de tu avatar)</Text>
      <View style={styles.actionRow}>
        <ActionBtn
          emoji="☕"
          label={busy === "coffee" ? "..." : `Café · ${pantry.coffee}`}
          disabled={pantry.coffee <= 0 || !!busy || sleeping}
          onPress={() => call("/pet/feed", { type: "coffee" }, "coffee")}
        />
        <ActionBtn
          emoji="🥐"
          label={busy === "bread" ? "..." : `Pan · ${pantry.bread}`}
          disabled={pantry.bread <= 0 || !!busy || sleeping}
          onPress={() => call("/pet/feed", { type: "bread" }, "bread")}
        />
      </View>
      <View style={[styles.actionRow, { marginTop: 6 }]}>
        <ActionBtn
          emoji="🧼"
          label={busy === "clean" ? "..." : "Limpiar"}
          badge={mess}
          disabled={!!busy || sleeping}
          onPress={() => call("/pet/clean", null, "clean")}
        />
        <ActionBtn
          emoji="😴"
          label={busy === "sleep" ? "..." : sleeping ? formatMMSS(sleepLeft) : "Dormir"}
          disabled={!tired || !!busy || sleeping}
          onPress={() => call("/pet/sleep", null, "sleep")}
        />
      </View>
    </View>
  );

  // Aparte de la tarjeta de estado (arriba) y con su propio fondo de color
  // -- a propósito, para que salte a la vista frente a las barras/botones
  // más discretos de arriba en vez de perderse como una sección más.
  const renderGames = () => (
    <View style={styles.gamesCard}>
      <Text style={styles.gamesTitle}>🎮 Minijuegos</Text>
      <Text style={styles.gamesSub}>Toca un juego · toca el top para ver la tabla completa</Text>
      <MiniGameCard
        emoji="🍰"
        title="Café Crush"
        tint="#7B1E3A"
        blocked={!canPlay || !!busy || sleeping}
        myBest={pet?.tetrisBest ? `${pet.tetrisBest} fichas` : null}
        top={top1.tetris ? `${top1.tetris.isMe ? "Tú vas 1° 👑" : `${top1.tetris.petName}: ${top1.tetris.best} 🍰`}` : null}
        onPress={() => setMatch3Open(true)}
        onPressTop={() => setLeaderboardGame("tetris")}
      />
      <MiniGameCard
        emoji="🦘"
        title="Salto Café"
        tint="#4f9d69"
        blocked={!canPlay || !!busy || sleeping}
        myBest={pet?.doodleBest ? `altura ${pet.doodleBest}` : null}
        top={top1.doodle ? `${top1.doodle.isMe ? "Tú vas 1° 👑" : `${top1.doodle.petName}: altura ${top1.doodle.best} 🦘`}` : null}
        onPress={() => setDoodleOpen(true)}
        onPressTop={() => setLeaderboardGame("doodle")}
      />
      <MiniGameCard
        emoji="🎮"
        title="Atrapa"
        tint="#4a90c2"
        blocked={!canPlay || !!busy || sleeping}
        subtitle="Atrapa lo que caiga, rapidito"
        onPress={() => setGameOpen(true)}
      />

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
            renderStatus()
          )}
        </View>

        {!loading && isVIP && owned && renderGames()}

        <View style={{ height: 18 }} />
      </ScrollView>

      <PetMiniGame
        visible={gameOpen}
        species={pet?.species}
        petName={pet?.name || "tu mascota"}
        onClose={() => setGameOpen(false)}
        onFinish={onGameFinish}
      />
      <LevelMap
        title="Café Crush 🍰"
        visible={match3Open && match3Level == null}
        levels={MATCH3_LEVELS}
        unlockedLevel={Number(pet?.match3Level) || 1}
        badge={(l) => `${l.target} 🍰`}
        onSelect={(lvl) => setMatch3Level(lvl)}
        onClose={() => setMatch3Open(false)}
      />
      <PetMatch3
        visible={match3Open && match3Level != null}
        level={match3Level || 1}
        species={pet?.species}
        petName={pet?.name || "tu mascota"}
        avatarConfig={avatarConfig}
        onClose={() => setMatch3Level(null)}
        onFinish={onMatch3Finish}
      />
      <LevelMap
        title="Salto Café 🦘"
        visible={doodleOpen && doodleLevel == null}
        levels={DOODLE_LEVELS}
        unlockedLevel={Number(pet?.doodleLevel) || 1}
        badge={(l) => `${l.targetHeight}`}
        onSelect={(lvl) => setDoodleLevel(lvl)}
        onClose={() => setDoodleOpen(false)}
      />
      <PetDoodleJump
        visible={doodleOpen && doodleLevel != null}
        level={doodleLevel || 1}
        species={pet?.species}
        petName={pet?.name || "tu mascota"}
        onClose={() => setDoodleLevel(null)}
        onFinish={onDoodleFinish}
      />
      <PetLeaderboard
        visible={!!leaderboardGame}
        game={leaderboardGame || "tetris"}
        onClose={() => setLeaderboardGame(null)}
      />
    </Screen>
  );
}

// Tarjeta grande por minijuego -- reemplaza los 3 botoncitos de texto de
// antes (apenas se distinguían entre sí y no mostraban ningún puntaje sin
// tocar un link aparte). `myBest`/`top` son opcionales: "Atrapa" no tiene
// mejor puntaje guardado en el backend, así que se le pasa `subtitle` fijo
// en vez de datos de tabla.
function MiniGameCard({ emoji, title, tint, blocked, myBest, top, subtitle, onPress, onPressTop }) {
  return (
    <Pressable
      style={[styles.gameCard, blocked && { opacity: 0.45 }]}
      onPress={() => !blocked && onPress()}
      disabled={blocked}
    >
      <View style={[styles.gameIcon, { backgroundColor: `${tint}1f` }]}>
        <Text style={styles.gameEmoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.gameTitle}>{title}</Text>
        {myBest ? <Text style={styles.gameMyBest}>Tu mejor: {myBest}</Text> : null}
        {top ? (
          <Pressable onPress={(e) => { e.stopPropagation?.(); onPressTop?.(); }} hitSlop={6}>
            <Text style={[styles.gameTop, { color: tint }]}>{top}</Text>
          </Pressable>
        ) : subtitle ? (
          <Text style={styles.gameMyBest}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={[styles.gamePlayBtn, { backgroundColor: tint }]}>
        <Text style={styles.gamePlayText}>Jugar</Text>
      </View>
    </Pressable>
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
  // paddingBottom generoso: esta pantalla se monta sobre la barra de tabs
  // (no la reemplaza), así que sin esto el último elemento (el link del
  // leaderboard) queda tapado por la barra.
  content: { padding: 20, paddingBottom: 110 },

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
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 120,
  },
  sceneChar: { alignItems: "center", maxWidth: "50%" },
  sceneCaption: { marginTop: 2, color: colors.textMuted, fontSize: 10.5, fontWeight: "800" },

  moodText: { marginTop: 8, textAlign: "center", color: "#111", fontSize: 13, fontWeight: "900" },
  sleepBanner: {
    marginTop: 8,
    alignItems: "center",
    backgroundColor: "rgba(74,55,40,0.08)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  sleepBannerText: { color: "#111", fontSize: 13, fontWeight: "900" },
  sleepBannerHint: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: "600" },

  lvlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  lvlLabel: { color: "#111", fontSize: 11.5, fontWeight: "900" },
  lvlMeta: { color: colors.textMuted, fontSize: 10.5, fontWeight: "800" },
  xpTrack: { height: 6, borderRadius: 999, backgroundColor: colors.primarySoft, overflow: "hidden", marginTop: 5 },
  xpFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },

  // Grilla 2x2 en vez de 4 barras apiladas -- misma info, la mitad de alto.
  statsGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 8, marginTop: 10 },
  statItem: { width: "48%" },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  statLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: "800" },
  statValue: { color: "#111", fontSize: 10.5, fontWeight: "900" },
  barTrack: { height: 7, borderRadius: 999, backgroundColor: colors.primarySoft, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },

  pantryHint: { marginTop: 12, marginBottom: 6, color: colors.textMuted, fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 8 },
  foodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "#fff",
  },
  foodBtnDisabled: { opacity: 0.4 },
  foodEmoji: { fontSize: 19 },
  foodLabel: { marginTop: 3, color: "#111", fontSize: 10.5, fontWeight: "900" },
  badge: { position: "absolute", top: 6, right: 8, width: 8, height: 8, borderRadius: 999, backgroundColor: "#d9534f" },

  // Tarjeta propia (fondo de color, no blanca como el resto) para que los
  // minijuegos salten a la vista en vez de leerse como una sección más
  // debajo de las barras de estado.
  gamesCard: {
    marginTop: 14,
    backgroundColor: "#2a0f1a",
    borderRadius: 20,
    padding: 16,
  },
  gamesTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  gamesSub: { marginTop: 2, marginBottom: 12, color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gameIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gameEmoji: { fontSize: 26 },
  gameTitle: { color: "#111", fontSize: 15, fontWeight: "900" },
  gameMyBest: { marginTop: 2, color: colors.textMuted, fontSize: 11.5, fontWeight: "700" },
  gameTop: { marginTop: 2, fontSize: 11.5, fontWeight: "900" },
  gamePlayBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  gamePlayText: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

  tipText: { marginTop: 4, color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 16 },
  nudgeText: {
    marginTop: 4,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 10,
  },

  saveBtn: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", alignSelf: "center" },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
