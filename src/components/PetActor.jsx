import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };

let PID = 0;

/**
 * La mascota como "actor" animado:
 *  - rebote (bob) continuo, siempre vivo
 *  - reacciona a cada acción vía prop `reaction={{type,id}}` (id cambia -> dispara):
 *      "eat"    -> mordidas + migas que caen
 *      "play"   -> salto + giro + corazones que suben
 *      "clean"  -> chispas ✨ + la popó se desvanece
 *      "tickle" -> meneo rápido + un corazón (al tocar la mascota)
 *  - estados: `sleeping` (💤 subiendo, atenuada, respira lento),
 *             `mess` (💩 al lado), `mood==="hungry"` (se sacude + "!")
 */
export default function PetActor({
  species = "cat",
  mood = "happy",
  mess = false,
  sleeping = false,
  size = 96,
  reaction = { type: null, id: 0 },
  onTapPet,
}) {
  const emoji = SPECIES_EMOJI[species] || "🐾";

  const bob = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const chomp = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const [particles, setParticles] = useState([]);
  const [poofMess, setPoofMess] = useState(false); // anima la salida de la 💩

  // Bob continuo (lento si duerme)
  useEffect(() => {
    const dur = sleeping ? 2400 : 1400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, sleeping]);

  // Sacudida cuando tiene hambre
  useEffect(() => {
    if (mood !== "hungry" || sleeping) {
      shake.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mood, sleeping, shake]);

  // 💤 mientras duerme
  useEffect(() => {
    if (!sleeping) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      spawn("💤", 1, { drift: 26, rise: 44, dur: 1600, size: 20, startX: size * 0.28, startY: -size * 0.1 });
      timer = setTimeout(tick, 1100);
    };
    let timer = setTimeout(tick, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sleeping]);

  // Reacciones one-shot
  useEffect(() => {
    if (!reaction?.type) return;
    if (reaction.type === "eat") {
      Animated.sequence([
        Animated.timing(chomp, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(chomp, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(chomp, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(chomp, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
      spawn("🍞", 3, { drift: 30, rise: -34, dur: 900, size: 16, gravity: true });
    } else if (reaction.type === "play") {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(hop, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
        ]),
        Animated.timing(spin, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => spin.setValue(0));
      spawn("❤️", 3, { drift: 34, rise: 54, dur: 1100, size: 18 });
    } else if (reaction.type === "clean") {
      spawn("✨", 5, { drift: 46, rise: 40, dur: 900, size: 18, burst: true });
      if (mess) {
        setPoofMess(true);
        setTimeout(() => setPoofMess(false), 500);
      }
    } else if (reaction.type === "tickle") {
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
      spawn("❤️", 1, { drift: 12, rise: 40, dur: 900, size: 16 });
    }
  }, [reaction?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function spawn(emojiChar, count, opts = {}) {
    const born = [];
    for (let i = 0; i < count; i++) {
      const id = ++PID;
      const v = new Animated.Value(0);
      const dir = (Math.random() * 2 - 1) * (opts.drift ?? 30);
      born.push({ id, v, emoji: emojiChar, dir, opts });
      const dur = opts.dur ?? 1000;
      Animated.timing(v, {
        toValue: 1,
        duration: dur,
        delay: (opts.burst ? 0 : i * 90),
        easing: opts.gravity ? Easing.in(Easing.quad) : Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setParticles((cur) => cur.filter((p) => p.id !== id));
      });
    }
    setParticles((cur) => [...cur, ...born]);
  }

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, sleeping ? -3 : -8] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const chompScale = chomp.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const wiggleDeg = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ["-10deg", "10deg"] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });

  return (
    <View style={[styles.wrap, { width: size * 1.7, height: size * 1.7 }]}>
      {/* partículas */}
      {particles.map((p) => {
        const ty = p.v.interpolate({
          inputRange: [0, 1],
          outputRange: [p.opts.startY ?? 0, (p.opts.startY ?? 0) - (p.opts.rise ?? 40)],
        });
        const tx = p.v.interpolate({ inputRange: [0, 1], outputRange: [p.opts.startX ?? 0, (p.opts.startX ?? 0) + p.dir] });
        const op = p.v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.Text
            key={p.id}
            pointerEvents="none"
            style={[
              styles.particle,
              { fontSize: p.opts.size ?? 16, opacity: op, transform: [{ translateX: tx }, { translateY: ty }] },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}

      {/* 💩 al lado */}
      {(mess || poofMess) && (
        <PoofMess out={poofMess} />
      )}

      {/* "!" cuando tiene hambre */}
      {mood === "hungry" && !sleeping && <Text style={styles.bang}>❗</Text>}

      <Pressable onPress={onTapPet} hitSlop={12}>
        <Animated.Text
          style={[
            styles.pet,
            {
              fontSize: size,
              opacity: sleeping ? 0.78 : 1,
              transform: [
                { translateY: Animated.add(bobY, hopY) },
                { translateX: shakeX },
                { rotate: sleeping ? "0deg" : wiggleDeg },
                { rotateZ: spinDeg },
                { scale: chompScale },
              ],
            },
          ]}
        >
          {emoji}
        </Animated.Text>

        {/* Ojos cerrados al dormir: dos "︶" sobre la cara, pegados al bob */}
        {sleeping && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.eyelids,
              { top: size * 0.36, gap: size * 0.14, transform: [{ translateY: bobY }] },
            ]}
          >
            <View style={[styles.lid, { width: size * 0.16, height: size * 0.055, borderRadius: size * 0.03 }]} />
            <View style={[styles.lid, { width: size * 0.16, height: size * 0.055, borderRadius: size * 0.03 }]} />
          </Animated.View>
        )}
      </Pressable>

      {/* sombra de piso */}
      <View style={[styles.ground, { width: size * 0.72 }]} />
    </View>
  );
}

function PoofMess({ out }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [s]);
  useEffect(() => {
    if (out) Animated.timing(s, { toValue: 0, duration: 380, useNativeDriver: true }).start();
  }, [out, s]);
  return (
    <Animated.Text style={[styles.poop, { transform: [{ scale: s }] }]}>💩</Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  pet: { textAlign: "center" },
  ground: {
    position: "absolute",
    bottom: 8,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(58,20,10,0.22)",
  },
  particle: { position: "absolute" },
  poop: { position: "absolute", right: "18%", bottom: 14, fontSize: 26 },
  bang: { position: "absolute", top: 6, right: "24%", fontSize: 22 },
  eyelids: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  lid: { backgroundColor: "#4a3728" },
});
