// src/components/BootScreen.jsx
//
// Pantalla de arranque -- antes AppContent() en App.js solo mostraba un
// <View> vacío color crema mientras AuthContext resolvía el token guardado
// (ver useEffect en AuthContext.jsx). Este componente reemplaza ese vacío
// con una animación de marca, sin bloquear nada: sigue siendo puramente
// decorativo, el gate real de "loading" sigue viviendo en AuthContext.
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

import { colors } from "../theme/colors";
import LondonCafeLogo from "../assets/markers/londoncafe1.jpg";

const RING_SIZE = 168;
const LOGO_SIZE = 116;

function BreathingRing({ delay = 0 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.55] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.ringWrap,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <View style={styles.ring} />
    </Animated.View>
  );
}

function LoadingDots() {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 420, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [values]);

  return (
    <View style={styles.dotsRow}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.35, 1], outputRange: [0.8, 1.15] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

export default function BootScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const wordmarkFade = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(10)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(wordmarkFade, { toValue: 1, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lineWidth, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
  }, [fade, logoScale, wordmarkFade, wordmarkY, lineWidth]);

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="38%" r="75%">
            <Stop offset="0%" stopColor="#3a0f22" stopOpacity="1" />
            <Stop offset="55%" stopColor="#1c0a13" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0b0709" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="38%" r="75%" fill="url(#bg)" />
      </Svg>

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <View style={styles.logoStage}>
          <BreathingRing delay={0} />
          <BreathingRing delay={900} />
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
            <Image source={LondonCafeLogo} style={styles.logo} resizeMode="cover" />
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: wordmarkFade, transform: [{ translateY: wordmarkY }], alignItems: "center" }}>
          <Text style={styles.wordmark}>LONDON CAFÉ</Text>
          <Animated.View
            style={[
              styles.underline,
              {
                width: lineWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }),
              },
            ]}
          />
          <Text style={styles.tagline}>Tu café, tu ritmo</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fade }]}>
        <LoadingDots />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0709",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoStage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(232,207,174,0.55)",
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logo: { width: "100%", height: "100%" },
  wordmark: {
    color: "#FBF3E7",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 4,
  },
  underline: {
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  tagline: {
    color: "rgba(251,243,231,0.55)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  footer: {
    position: "absolute",
    bottom: 64,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
