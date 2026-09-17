import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import AvatarPreview from "./AvatarPreview";

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
  const [sleeping, setSleeping] = useState(false);

  const bobA = useRef(new Animated.Value(0)).current;
  const bobP = useRef(new Animated.Value(0)).current;
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
        setSleeping(!!r?.sleeping);
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
    a.start();
    p.start();
    return () => {
      a.stop();
      p.stop();
    };
  }, [bobA, bobP]);

  useEffect(() => {
    if (!need || sleeping) {
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
  }, [need, sleeping, alert]);

  const avatarY = bobA.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const avatarScale = bobA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const avatarShadowSX = bobA.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1.35] });

  const petY = bobP.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const petRot = bobP.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });
  const petShadowSX = bobP.interpolate({ inputRange: [0, 1], outputRange: [2.1, 1.4] });

  const alertScale = alert.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });

  const owned = !!pet?.owned;
  const speciesEmoji = SPECIES_EMOJI[pet?.species] || "🐾";

  let statusLine = "Cuídala como un Tamagotchi";
  if (isVIP === false) statusLine = "Exclusivo VIP";
  else if (isVIP && !owned) statusLine = "Adopta a tu compañero";
  else if (owned) {
    const tail = sleeping ? "durmiendo 😴 -- te avisamos" : need ? NEED[need] : MOOD[mood] || "";
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

        <View style={styles.tilt}>
          <View style={styles.slot}>
            <Animated.View style={[styles.groundShadow, { transform: [{ scaleX: avatarShadowSX }] }]} />
            <Animated.View style={{ transform: [{ translateY: avatarY }, { scale: avatarScale }] }}>
              <View style={styles.avatarShadow}>
                <AvatarPreview config={avatarConfig} size={40} />
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

        {need && !sleeping ? (
          <Animated.Text style={[styles.alert, { transform: [{ scale: alertScale }] }]}>❗</Animated.Text>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title}>Mascota VIP</Text>
        {/* Sin numberOfLines: en pantallas angostas (confirmado cortado en
            iPhone real incluso con el límite de 2 líneas) el texto puede
            necesitar 3+ líneas -- mejor que la tarjeta crezca un poco de
            alto a que la mascota/necesidad se corte a media palabra. */}
        <Text style={styles.status}>{statusLine}</Text>
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
  // height 94 → 116: en iOS, Apple Color Emoji dibuja el emoji de la
  // mascota (fontSize 40) notablemente más alto que Noto Color Emoji en
  // Android con el mismo fontSize -- con overflow:hidden y el contenido
  // anclado abajo (justifyContent:flex-end), esa diferencia se comía la
  // parte de arriba del emoji en iPhone real aunque se viera bien en el
  // emulador Android. Más alto le da margen sin tocar el layout del resto.
  //
  // El "halo" (glow ovalado detrás de los personajes) se quitó -- seguía
  // viéndose cortado por arriba en iPhone real incluso con este alto, y
  // era puramente decorativo.
  //
  // v2: toda la tarjeta (stage + emoji + avatar + paddings) se achicó
  // ~14% pareja -- se veía muy grande/tipo "píldora" comparada con las
  // demás tarjetas del Home (ej. Amigos). Se mantiene la MISMA proporción
  // alto-del-stage/tamaño-del-emoji que arregló el corte en iOS (no solo
  // se bajó el alto del stage, que hubiera vuelto a cortar el emoji).
  stage: { width: 110, height: 100, justifyContent: "flex-end", alignItems: "center", overflow: "hidden" },
  tilt: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 10,
    transform: [{ perspective: 600 }, { rotateX: "12deg" }],
  },
  slot: { alignItems: "center", justifyContent: "flex-end", width: 52, height: 55 },
  groundShadow: { position: "absolute", bottom: 5, width: 22, height: 6, borderRadius: 999, backgroundColor: "rgba(58,20,10,0.30)" },
  avatarShadow: { shadowColor: "#3a1410", shadowOpacity: 0.32, shadowRadius: 4, shadowOffset: { width: 0, height: 4 } },
  petEmoji: {
    fontSize: 34,
    textShadowColor: "rgba(58,20,16,0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 5,
  },
  poop: { position: "absolute", right: 2, bottom: 6, fontSize: 13 },
  alert: { position: "absolute", top: 6, right: 10, fontSize: 17 },
  meta: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  title: { color: "#111", fontSize: 14, fontWeight: "900" },
  status: { color: colors.textMuted, fontSize: 11.5, fontWeight: "700", marginTop: 3, lineHeight: 15 },
  chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "900", paddingRight: 14 },
});
