import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import LondonBuddyLogo from "../assets/icons/LondonBuddy.png";

export default function PointsStepperBar({
  points = 68,
  maxPoints = 200,
  steps = [50, 100, 150, 200],
  title = "Puntos",
  subtitle = "Buddy Points",

  // ✅ icono para mostrar (número + pill)
  iconSource = LondonBuddyLogo,
  iconSize = 25,

  // ✅ tamaño para el icono dentro del pill
  pillIconSize = 14,
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
      <View style={styles.header}>
        <View>
          {/* ✅ Número + moneda */}
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
            ) : null}
          </View>

          <Text style={styles.smallLabel}>{title}</Text>
        </View>

        {/* ✅ Pill: texto + moneda (SIN estrella) */}
        <View style={styles.pill}>
          <Text style={styles.pillText}>{subtitle}</Text>

          {iconSource ? (
            <Image
              source={iconSource}
              style={[
                styles.pillIcon,
                { width: pillIconSize, height: pillIconSize, borderRadius: pillIconSize / 2 },
              ]}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </View>

      {/* Barra */}
      <View style={styles.barWrap}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: `${progressPct}%` }]} />

        <View style={[styles.pinWrap, { left: `${progressPct}%` }]}>
          <View style={styles.pin} />
          <View style={styles.pinDot} />
        </View>

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

    // ✅ para meter texto + icono
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  pillText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },

  pillIcon: {
    backgroundColor: "transparent",
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
