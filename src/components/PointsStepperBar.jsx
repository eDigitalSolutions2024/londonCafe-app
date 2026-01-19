import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

/**
 * Barra tipo "stepper" como la imagen:
 * - ticks en 25 / 50 / 75 / 100 (o lo que definas)
 * - línea de progreso
 * - marcador (pin) en el punto actual
 */
export default function PointsStepperBar({
  points = 68,
  maxPoints = 200,
  steps = [50, 100, 150, 200], // niveles (puedes cambiar a [25,50,75,100] si max=100)
  title = "Puntos",
  subtitle = "Rewards",
}) {
  const clamped = Math.max(0, Math.min(maxPoints, points));

  const normalizedSteps = useMemo(() => {
    // fuerza steps dentro del rango 0..max
    const s = Array.from(new Set(steps))
      .filter((v) => v > 0 && v <= maxPoints)
      .sort((a, b) => a - b);
    // si no hay steps válidos, crea uno al max
    return s.length ? s : [maxPoints];
  }, [steps, maxPoints]);

  const progressPct = (clamped / maxPoints) * 100;

  return (
    <View style={styles.card}>
      {/* Header como la imagen (número grande + label a la derecha) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.bigNumber}>
            {clamped}
            <Text style={styles.star}>★</Text>
          </Text>
          <Text style={styles.smallLabel}>{title}</Text>
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillText}>{subtitle} ★</Text>
        </View>
      </View>

      {/* Barra */}
      <View style={styles.barWrap}>
        {/* Línea base */}
        <View style={styles.track} />

        {/* Progreso */}
        <View style={[styles.fill, { width: `${progressPct}%` }]} />

        {/* Marcador actual tipo pin */}
        <View style={[styles.pinWrap, { left: `${progressPct}%` }]}>
          <View style={styles.pin} />
          <View style={styles.pinDot} />
        </View>

        {/* Steps: bolitas + números */}
        <View style={styles.stepsRow}>
          {normalizedSteps.map((stepValue, idx) => {
            const pct = (stepValue / maxPoints) * 100;
            const reached = clamped >= stepValue;

            return (
              <View
                key={`${stepValue}-${idx}`}
                style={[styles.stepItem, { left: `${pct}%` }]}
              >
                <View style={[styles.stepDot, reached && styles.stepDotActive]} />
                <Text style={styles.stepText}>{stepValue}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        Acumula puntos y cámbialos por productos gratis ☕
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bigNumber: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 32,
  },
  star: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "800",
  },
  smallLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
  },

  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#121218",
  },
  pillText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12,
  },

  barWrap: {
    position: "relative",
    height: 54,
    justifyContent: "center",
  },

  track: {
    position: "absolute",
    left: 6,
    right: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#221c27",
    borderWidth: 1,
    borderColor: "#2f2633",
  },
  fill: {
    position: "absolute",
    left: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  // Pin (marcador)
  pinWrap: {
    position: "absolute",
    top: 2,
    transform: [{ translateX: -8 }],
    alignItems: "center",
  },
  pin: {
    width: 2,
    height: 16,
    backgroundColor: colors.accent,
    borderRadius: 999,
    opacity: 0.9,
  },
  pinDot: {
    marginTop: 2,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: "#121218",
  },

  // Steps
  stepsRow: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 22,
    height: 28,
  },
  stepItem: {
    position: "absolute",
    transform: [{ translateX: -8 }],
    alignItems: "center",
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#2f2633",
    borderWidth: 1,
    borderColor: "#3b2a35",
  },
  stepDotActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  stepText: {
    marginTop: 6,
    fontSize: 10,
    color: colors.textMuted,
  },

  hint: {
    marginTop: 10,
    fontSize: 11,
    color: colors.textMuted,
  },
});
