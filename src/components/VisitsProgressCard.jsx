import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Path, Ellipse, ClipPath, Defs, G, Rect } from "react-native-svg";
import { colors } from "../theme/colors";

const TOTAL_VISITS = 5;
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Taza de café dibujada a mano (sin depender de ningún PNG externo) que se
// va "llenando" de líquido conforme suben las visitas -- pedido explícito
// del usuario ("que se vaya pintando el logo del café, algo que enganche")
// en vez de los puntos/tazas sueltas de la v1. El líquido es un <Rect>
// animado recortado con un <ClipPath> del interior de la taza -- mismo
// truco de "relleno enmascarado" que ya usa BoothStreakBar (HomeScreen.jsx)
// con MaskedView + una imagen, solo que acá la forma es 100% SVG propio,
// no depende de que un asset externo tenga transparencia real (el logo.png
// del branding remoto resultó tener un fondo tipo checkerboard "horneado"
// en los píxeles, sin canal alpha real -- no servía para esto).
export default function VisitsProgressCard({ count = 0, rewardsEarned = 0, onPress }) {
  const safeCount = Math.max(0, Math.min(TOTAL_VISITS, Number(count) || 0));
  const remaining = TOTAL_VISITS - safeCount;
  const pct = safeCount / TOTAL_VISITS;
  const justReset = safeCount === 0 && Number(rewardsEarned) > 0;
  const isFull = safeCount === TOTAL_VISITS;

  const fillAnim = useRef(new Animated.Value(0)).current;
  const steamAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  // Pequeño "pop" cada vez que sube el conteo -- refuerzo visual de que
  // algo se ganó, además del llenado.
  const prevCount = useRef(safeCount);
  useEffect(() => {
    if (safeCount !== prevCount.current) {
      prevCount.current = safeCount;
      popAnim.setValue(1.12);
      Animated.spring(popAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    }
  }, [safeCount]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(steamAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(steamAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Interior de la taza: rango vertical donde puede "subir" el líquido.
  const CUP_TOP = 34;
  const CUP_BOTTOM = 78;
  const liquidY = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [CUP_BOTTOM, CUP_TOP] });
  const liquidH = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CUP_BOTTOM - CUP_TOP] });

  const steamOpacity = steamAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });

  const subtitle = justReset
    ? "¡Nueva ronda! Ya ganaste bebidas gratis antes 🎉"
    : isFull
    ? "¡Bebida gratis desbloqueada!"
    : remaining === 1
    ? "1 visita más y tu próxima bebida es gratis"
    : `${remaining} visitas más para tu bebida gratis`;

  return (
    <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
      <View style={styles.row}>
        <Animated.View style={[styles.cupWrap, { transform: [{ scale: popAnim }] }]}>
          <Svg width={64} height={64} viewBox="0 0 100 100">
            <Defs>
              <ClipPath id="cupInner">
                {/* Interior de la taza, ligeramente adentro del contorno para
                    que el líquido se vea "dentro" de la pared. */}
                <Path d="M28 34 L72 34 L69 76 Q69 82 60 82 L40 82 Q31 82 31 76 Z" />
              </ClipPath>
            </Defs>

            {/* Platito */}
            <Ellipse cx="50" cy="90" rx="30" ry="5" fill={colors.primarySoft} />

            {/* Vapor -- solo se ve si hay algo de progreso */}
            {safeCount > 0 && (
              <AnimatedG opacity={steamOpacity}>
                <Path d="M42 22 Q38 16 42 10 Q46 4 42 -2" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" fill="none" />
                <Path d="M56 22 Q52 16 56 10 Q60 4 56 -2" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" fill="none" />
              </AnimatedG>
            )}

            {/* Líquido animado, recortado al interior de la taza */}
            <G clipPath="url(#cupInner)">
              <AnimatedRect x={20} y={liquidY} width={60} height={liquidH} fill={colors.primary} />
            </G>

            {/* Cuerpo de la taza (contorno, siempre visible) */}
            <Path
              d="M25 32 L75 32 L71 78 Q71 86 60 86 L40 86 Q29 86 29 78 Z"
              fill="none"
              stroke={colors.primary}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {/* Asa */}
            <Path
              d="M75 42 Q90 42 90 55 Q90 68 75 68"
              fill="none"
              stroke={colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        <View style={styles.meta}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Visitas</Text>
            <Text style={styles.count}>{safeCount}/{TOTAL_VISITS}</Text>
          </View>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                },
              ]}
            />
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  cupWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },

  meta: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "900" },
  count: { color: colors.primary, fontSize: 13.5, fontWeight: "900" },

  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(123,30,58,0.12)",
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  subtitle: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
});
