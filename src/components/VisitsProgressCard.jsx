import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";

const TOTAL_VISITS = 5;

// v3: la v1 (puntitos planos) no enganchaba, la v2 (taza SVG que se
// llenaba de líquido) tampoco convenció -- "regrésalo a casillas, la
// gente se engancha más" (pedido explícito). Es el mismo patrón de
// "tarjeta de sellos" de cualquier cafetería física -- 5 casillas que se
// van sellando una por una. Lo que se le agrega arriba de la v1: cada vez
// que la tarjeta aparece, las casillas ya ganadas se "sellan" en cascada
// (stagger, una tras otra) con un rebote + un anillo de tinta que se
// expande y se desvanece -- el efecto físico de estampar un sello -- en
// vez de aparecer ya llenas de golpe. Al completar las 5, toda la fila
// pulsa un brillo dorado.
export default function VisitsProgressCard({ count = 0, rewardsEarned = 0, onPress }) {
  const safeCount = Math.max(0, Math.min(TOTAL_VISITS, Number(count) || 0));
  const remaining = TOTAL_VISITS - safeCount;
  const justReset = safeCount === 0 && Number(rewardsEarned) > 0;
  const isFull = safeCount === TOTAL_VISITS;

  // Una animación de sello (scale + anillo) por casilla.
  const stampAnims = useRef(
    Array.from({ length: TOTAL_VISITS }, () => ({
      scale: new Animated.Value(0.4),
      ring: new Animated.Value(0),
    }))
  ).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reinicia y reproduce el sellado en cascada de las casillas ganadas
    // cada vez que la tarjeta se monta/cambia el conteo.
    const stamps = stampAnims.slice(0, safeCount).map((a, i) => {
      a.scale.setValue(0.4);
      a.ring.setValue(0);
      return Animated.sequence([
        Animated.delay(i * 110),
        Animated.parallel([
          Animated.spring(a.scale, { toValue: 1, friction: 4.5, tension: 140, useNativeDriver: true }),
          Animated.timing(a.ring, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]);
    });
    // Las casillas vacías quedan visibles de una, sin animación.
    stampAnims.slice(safeCount).forEach((a) => {
      a.scale.setValue(1);
      a.ring.setValue(0);
    });
    Animated.parallel(stamps).start();
  }, [safeCount]);

  useEffect(() => {
    if (!isFull) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFull]);

  const subtitle = justReset
    ? "¡Nueva ronda! Ya ganaste bebidas gratis antes 🎉"
    : isFull
    ? "¡Bebida gratis desbloqueada! 🎉"
    : remaining === 1
    ? "1 visita más y tu próxima bebida es gratis"
    : `${remaining} visitas más para tu bebida gratis`;

  // shadowOpacity solo anima en iOS (Android usa `elevation`, fijo) -- el
  // brillo de "completado" se hace con opacity en su lugar, que sí es
  // multiplataforma.
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });

  return (
    <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>☕ Visitas</Text>
        <Text style={styles.count}>{safeCount}/{TOTAL_VISITS}</Text>
      </View>

      <View style={styles.stampsRow}>
        {Array.from({ length: TOTAL_VISITS }).map((_, i) => {
          const filled = i < safeCount;
          const { scale, ring } = stampAnims[i];
          const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] });
          const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
          return (
            <View key={i} style={styles.slotWrap}>
              <View style={styles.slotCell}>
                {filled && (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
                  />
                )}
                {filled && isFull && (
                  <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]} />
                )}
                <Animated.View
                  style={[
                    styles.slot,
                    filled ? styles.slotFilled : styles.slotEmpty,
                    { transform: [{ scale: filled ? scale : 1 }] },
                  ]}
                >
                  <Text style={[styles.slotEmoji, !filled && styles.slotEmojiMuted]}>☕</Text>
                </Animated.View>
              </View>
              {i < TOTAL_VISITS - 1 ? <View style={[styles.line, filled && styles.lineFilled]} /> : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.subtitle, isFull && styles.subtitleFull]}>{subtitle}</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "900" },
  count: { color: colors.primary, fontSize: 13.5, fontWeight: "900" },

  stampsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  slotWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  slotCell: { alignItems: "center", justifyContent: "center" },

  ring: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  glow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D4A017",
  },
  slot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  slotFilled: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  slotEmpty: {
    backgroundColor: "rgba(123,30,58,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(123,30,58,0.18)",
    borderStyle: "dashed",
  },
  slotEmoji: { fontSize: 15 },
  slotEmojiMuted: { opacity: 0.35 },

  line: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(123,30,58,0.12)",
    marginHorizontal: 2,
  },
  lineFilled: { backgroundColor: colors.primary },

  subtitle: {
    marginTop: 10,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  subtitleFull: { color: colors.primary, fontSize: 12 },
});
