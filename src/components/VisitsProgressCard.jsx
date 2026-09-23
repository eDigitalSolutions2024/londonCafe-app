import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme/colors";

const TOTAL_VISITS = 5;

/**
 * Check-in de visitas: 1 se suma cada día que se paga una orden
 * identificada en el Kiosk (ver orders.ts del repo POS). Al llegar a 5 se
 * genera solo un cupón de bebida gratis (categoría "Bebidas", ver
 * GiftsScreen) y el contador vuelve a 0 -- por eso onPress manda a
 * Regalos, que es donde ese cupón ya aparece sin necesitar pantalla nueva.
 */
export default function VisitsProgressCard({ count = 0, rewardsEarned = 0, onPress }) {
  const safeCount = Math.max(0, Math.min(TOTAL_VISITS, Number(count) || 0));
  const remaining = TOTAL_VISITS - safeCount;
  const justReset = safeCount === 0 && Number(rewardsEarned) > 0;

  const subtitle = justReset
    ? "¡Nueva ronda! Ya ganaste bebidas gratis antes 🎉"
    : remaining === 0
    ? "¡Bebida gratis desbloqueada!"
    : remaining === 1
    ? "1 visita más y tu próxima bebida es gratis"
    : `${remaining} visitas más para tu bebida gratis`;

  return (
    <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>☕ Visitas</Text>
        <Text style={styles.count}>{safeCount}/{TOTAL_VISITS}</Text>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_VISITS }).map((_, i) => {
          const filled = i < safeCount;
          return (
            <View key={i} style={styles.dotSlot}>
              <View style={[styles.dot, filled && styles.dotFilled]}>
                <Text style={[styles.dotEmoji, !filled && styles.dotEmojiMuted]}>☕</Text>
              </View>
              {i < TOTAL_VISITS - 1 ? <View style={[styles.dotLine, filled && styles.dotLineFilled]} /> : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { color: colors.text, fontSize: 13.5, fontWeight: "900" },
  count: { color: colors.primary, fontSize: 13.5, fontWeight: "900" },

  dotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dotSlot: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(123,30,58,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(123,30,58,0.18)",
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotEmoji: { fontSize: 12 },
  dotEmojiMuted: { opacity: 0.35 },
  dotLine: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(123,30,58,0.12)",
    marginHorizontal: 2,
  },
  dotLineFilled: { backgroundColor: colors.primary },

  subtitle: {
    marginTop: 8,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
});
