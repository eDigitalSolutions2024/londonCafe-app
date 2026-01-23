import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";

/**
 * Barra tipo "stepper" como la imagen:
 * - ticks en 25 / 50 / 75 / 100 (o lo que definas)
 * - línea de progreso
 * - marcador (pin) en el punto actual
 */
export default function PointsStepperBar({
  points = 68,
  maxPoints = 200,
  steps = [50, 100, 150, 200],
  title = "Puntos",
  subtitle = "Rewards",

  // ✅ NUEVO: icono para mostrar junto al número (en vez de la estrella)
  iconSource = null,
  iconSize = 18, // opcional
}) {
  const clamped = Math.max(0, Math.min(maxPoints, points));

  const normalizedSteps = useMemo(() => {
    const s = Array.from(new Set(steps))
      .filter((v) => v > 0 && v <= maxPoints)
      .sort((a, b) => a - b);
    return s.length ? s : [maxPoints];
  }, [steps, maxPoints]);

  const progressPct = (clamped / maxPoints) * 100;

  return (
    <View style={styles.card}>
      {/* Header como la imagen (número grande + label a la derecha) */}
      <View style={styles.header}>
        <View>
          {/* ✅ Número + icono (reemplaza ★) */}
          <View style={styles.bigRow}>
            <Text style={styles.bigNumber}>{clamped}</Text>

            {iconSource ? (
              <Image
                source={iconSource}
                style={[
                  styles.coinIcon,
                  { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
                ]}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.star}>★</Text>
            )}
          </View>

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
    ...appStyles.card,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  // ✅ contenedor para número + icono
  bigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  bigNumber: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },

  // fallback (si no se pasa iconSource)
  star: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  // ✅ icono moneda
  coinIcon: {
    marginTop: 2,
    backgroundColor: "transparent",
  },

  smallLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
  },

  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
  },
  pillText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },

  barWrap: {
    position: "relative",
    height: 58,
    justifyContent: "center",
  },

  track: {
    position: "absolute",
    left: 6,
    right: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  fill: {
    position: "absolute",
    left: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  pinWrap: {
    position: "absolute",
    top: 0,
    transform: [{ translateX: -8 }],
    alignItems: "center",
  },
  pin: {
    width: 2,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 999,
    opacity: 0.9,
  },
  pinDot: {
    marginTop: 2,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: "#fff",
  },

  stepsRow: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 26,
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
    backgroundColor: "#D9D9D9",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepText: {
    marginTop: 6,
    fontSize: 10,
    color: colors.textMuted,
  },

  hint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
  },
});
