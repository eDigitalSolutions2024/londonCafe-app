import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import AvatarPreview from "./AvatarPreview";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };
const MOOD = {
  happy: { emoji: "😊", label: "Feliz" },
  meh: { emoji: "😐", label: "Tranquilo" },
  sad: { emoji: "😢", label: "Necesita cariño" },
  hungry: { emoji: "🍽️", label: "¡Tiene hambre!" },
};

/**
 * Mini-diorama animado del avatar + la mascota, como acceso rápido desde
 * el Home. El "3D" es fingido con: mesa inclinada (perspective + rotateX),
 * sombras de piso que se encogen cuando el personaje sube (pista de
 * profundidad), y un rebote/balanceo continuo para que se sienta vivo.
 */
export default function PetDioramaCard({ avatarConfig, onPress }) {
  const [pet, setPet] = useState(null);
  const [mood, setMood] = useState(null);
  const [isVIP, setIsVIP] = useState(null); // null = cargando

  const bobA = useRef(new Animated.Value(0)).current; // avatar
  const bobP = useRef(new Animated.Value(0)).current; // mascota
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    apiFetch("/pet")
      .then((r) => {
        if (!alive) return;
        setPet(r?.pet || null);
        setMood(r?.mood || null);
        setIsVIP(!!r?.isVIP);
      })
      .catch(() => {
        if (alive) setIsVIP(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const avatarY = bobA.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const avatarScale = bobA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const avatarShadowSX = bobA.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1.35] });

  const petY = bobP.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const petRot = bobP.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });
  const petShadowSX = bobP.interpolate({ inputRange: [0, 1], outputRange: [2.1, 1.4] });

  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.6] });
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });

  const owned = !!pet?.owned;
  const speciesEmoji = SPECIES_EMOJI[pet?.species] || "🐾";

  let statusLine = "Cuídala como un Tamagotchi";
  if (isVIP === false) statusLine = "Exclusivo VIP";
  else if (isVIP && !owned) statusLine = "Adopta a tu compañero";
  else if (owned) {
    const m = MOOD[mood] || {};
    statusLine = `${pet.name} · ${m.label || ""} ${m.emoji || ""}`.trim();
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

        {/* halo cálido que late detrás de los dos */}
        <Animated.View
          style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />

        {/* "mesa" inclinada */}
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
          </View>
        </View>
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
  stage: {
    width: 150,
    height: 94,
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  halo: {
    position: "absolute",
    width: 116,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.accent,
    top: 6,
  },
  tilt: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 12,
    transform: [{ perspective: 600 }, { rotateX: "12deg" }],
  },
  slot: { alignItems: "center", justifyContent: "flex-end", width: 60, height: 64 },
  groundShadow: {
    position: "absolute",
    bottom: 5,
    width: 26,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(58,20,10,0.30)",
  },
  avatarShadow: {
    shadowColor: "#3a1410",
    shadowOpacity: 0.32,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  petEmoji: {
    fontSize: 40,
    textShadowColor: "rgba(58,20,16,0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 5,
  },
  meta: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  title: { color: "#111", fontSize: 14, fontWeight: "900" },
  status: { color: colors.textMuted, fontSize: 11.5, fontWeight: "700", marginTop: 3 },
  chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "900", paddingRight: 14 },
});
