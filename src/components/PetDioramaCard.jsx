import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import AvatarPreview from "./AvatarPreview";
import { updatePetWidget } from "../widgets/updatePetWidget";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };
const MOOD = {
  happy: "Feliz 😊",
  meh: "Tranquilo 😐",
  sad: "Necesita cariño 😢",
  hungry: "¡Tiene hambre! 🍽️",
  sleepy: "Con sueño 😴",
  dirty: "Está sucio 🧼",
};
const NEED = {
  feed: "tiene hambre 🍽️",
  play: "quiere jugar 🎾",
  sleep: "tiene sueño 😴",
  clean: "hay que limpiarlo 🧼",
};

/**
 * Mini-diorama animado del avatar + la mascota, acceso rápido desde el
 * Home. El "3D" es fingido: mesa inclinada (perspective + rotateX),
 * sombras de piso que se encogen al saltar, y rebote/balanceo continuo.
 * Muestra la necesidad más urgente (need) y un ❗ si hay algo que atender.
 */
export default function PetDioramaCard({ avatarConfig, onPress, refreshSignal = 0 }) {
  const [pet, setPet] = useState(null);
  const [mood, setMood] = useState(null);
  const [need, setNeed] = useState(null);
  const [isVIP, setIsVIP] = useState(null);

  const bobA = useRef(new Animated.Value(0)).current;
  const bobP = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const alert = useRef(new Animated.Value(0)).current;

  // Se re-consulta cada vez que `refreshSignal` cambia (Home lo sube al
  // enfocarse, al volver del background y cada 45s) -> se actualiza sin
  // pull-to-refresh.
  useEffect(() => {
    let alive = true;
    apiFetch("/pet")
      .then((r) => {
        if (!alive) return;
        setPet(r?.pet || null);
        setMood(r?.mood || null);
        setNeed(r?.need || null);
        setIsVIP(!!r?.isVIP);
        // empuja el estado al widget de pantalla de inicio (Android)
        if (r?.pet?.owned) {
          updatePetWidget({ pet: r.pet, mood: r.mood, need: r.need, ageDays: r.ageDays });
        }
      })
      .catch(() => alive && setIsVIP((v) => (v == null ? false : v)));
    return () => {
      alive = false;
    };
  }, [refreshSignal]);

  useEffect(() => {
    const loop = (val, dur, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
    const a = loop(bobA, 2100);
    const p = loop(bobP, 1650, 240);
    const g = loop(glow, 1500);
    a.start();
    p.start();
    g.start();
    return () => {
      a.stop();
      p.stop();
      g.stop();
    };
  }, [bobA, bobP, glow]);

  useEffect(() => {
    if (!need) {
      alert.stopAnimation(() => alert.setValue(0));
      return;
    }
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(alert, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(alert, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    l.start();
    return () => l.stop();
  }, [need, alert]);

  const avatarY = bobA.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const avatarScale = bobA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const avatarShadowSX = bobA.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1.35] });

  const petY = bobP.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const petRot = bobP.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });
  const petShadowSX = bobP.interpolate({ inputRange: [0, 1], outputRange: [2.1, 1.4] });

  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.6] });
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const alertScale = alert.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });

  const owned = !!pet?.owned;
  const speciesEmoji = SPECIES_EMOJI[pet?.species] || "🐾";

  let statusLine = "Cuídala como un Tamagotchi";
  if (isVIP === false) statusLine = "Exclusivo VIP";
  else if (isVIP && !owned) statusLine = "Adopta a tu compañero";
  else if (owned) {
    const tail = need ? NEED[need] : MOOD[mood] || "";
    statusLine = `${pet.name} · ${tail}`.trim();
  }

  return (
    <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
      <View style={styles.stage}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="petRoom" cx="50%" cy="34%" rx="80%" ry="80%">
              <Stop offset="0%" stopColor="#fff5e8" stopOpacity="1" />
              <Stop offset="62%" stopColor="#f4e2c9" stopOpacity="1" />
              <Stop offset="100%" stopColor="#e7d0b1" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#petRoom)" />
        </Svg>

        <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />

        <View style={styles.tilt}>
          <View style={styles.slot}>
            <Animated.View style={[styles.groundShadow, { transform: [{ scaleX: avatarShadowSX }] }]} />
            <Animated.View style={{ transform: [{ translateY: avatarY }, { scale: avatarScale }] }}>
              <View style={styles.avatarShadow}>
                <AvatarPreview config={avatarConfig} size={46} />
              </View>
            </Animated.View>
          </View>

          <View style={styles.slot}>
            <Animated.View style={[styles.groundShadow, { transform: [{ scaleX: petShadowSX }] }]} />
            <Animated.View style={{ transform: [{ translateY: petY }, { rotateZ: petRot }] }}>
              <Text style={styles.petEmoji}>{speciesEmoji}</Text>
            </Animated.View>
            {pet?.mess ? <Text style={styles.poop}>💩</Text> : null}
          </View>
        </View>

        {need ? (
          <Animated.Text style={[styles.alert, { transform: [{ scale: alertScale }] }]}>❗</Animated.Text>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title}>Mascota VIP</Text>
        <Text style={styles.status} numberOfLines={1}>
          {statusLine}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stage: { width: 150, height: 94, justifyContent: "flex-end", alignItems: "center", overflow: "hidden" },
  halo: { position: "absolute", width: 116, height: 84, borderRadius: 999, backgroundColor: colors.accent, top: 6 },
  tilt: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 12,
    transform: [{ perspective: 600 }, { rotateX: "12deg" }],
  },
  slot: { alignItems: "center", justifyContent: "flex-end", width: 60, height: 64 },
  groundShadow: { position: "absolute", bottom: 5, width: 26, height: 7, borderRadius: 999, backgroundColor: "rgba(58,20,10,0.30)" },
  avatarShadow: { shadowColor: "#3a1410", shadowOpacity: 0.32, shadowRadius: 4, shadowOffset: { width: 0, height: 4 } },
  petEmoji: {
    fontSize: 40,
    textShadowColor: "rgba(58,20,16,0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 5,
  },
  poop: { position: "absolute", right: 2, bottom: 6, fontSize: 15 },
  alert: { position: "absolute", top: 6, right: 10, fontSize: 20 },
  meta: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  title: { color: "#111", fontSize: 14, fontWeight: "900" },
  status: { color: colors.textMuted, fontSize: 11.5, fontWeight: "700", marginTop: 3 },
  chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "900", paddingRight: 14 },
});
