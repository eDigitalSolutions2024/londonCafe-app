import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import LondonBuddyLogo from "../assets/icons/LondonBuddy.png";

export default function PointsStepperBar({
  points = 0,
  progressPoints = 0,
  totalAccumulated = 0,

  maxPoints = 200,
  steps = [50, 100, 150, 200],
  title = "Buddy Coins",
  subtitle = "Buddy Coins",

  iconSource = LondonBuddyLogo,
  iconSize = 22,
  pillIconSize = 12,

  onPress,
  disabledPress = false,

  // ✅ extra opcional (por si luego quieres)
  showStepLabels = true,
}) {
  const rawPoints = Number(points) || 0;
  const rawProgress = Number(progressPoints) || 0;
  const rawTotal = Number(totalAccumulated) || 0;

  const clampedProgress = Math.max(0, Math.min(maxPoints, rawProgress));
  const progressPct = maxPoints > 0 ? (clampedProgress / maxPoints) * 100 : 0;

  const displayPoints = useMemo(() => {
    try { return rawPoints.toLocaleString(); } catch { return String(rawPoints); }
  }, [rawPoints]);

  const displayTotal = useMemo(() => {
    try { return rawTotal.toLocaleString(); } catch { return String(rawTotal); }
  }, [rawTotal]);

  const normalizedSteps = useMemo(() => {
    const s = Array.from(new Set(steps))
      .filter((v) => v > 0 && v <= maxPoints)
      .sort((a, b) => a - b);
    return s.length ? s : [maxPoints];
  }, [steps, maxPoints]);

  return (
    <Pressable
      onPress={disabledPress ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        onPress && !disabledPress && pressed && styles.cardPressed,
      ]}
      android_ripple={
        onPress && !disabledPress ? { color: "rgba(0,0,0,0.06)" } : undefined
      }
    >
      {/* Header compacto */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.bigRow}>
            <Text style={styles.bigNumber}>{displayPoints}</Text>

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

            {/* ✅ badge acumulados en el header */}
            <View style={styles.accBadge}>
              <Text style={styles.accBadgeText}>Acum: {displayTotal}</Text>
            </View>
          </View>

          {/* ✅ deja solo un label (sin duplicar) */}
          <Text style={styles.smallLabel}>{title}</Text>
        </View>

        {/* Pill compacto */}
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

      {/* Barra compacta */}
      <View style={styles.barWrap}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: `${progressPct}%` }]} />

        <View style={[styles.pinWrap, { left: `${progressPct}%` }]}>
          <View style={styles.pin} />
          <View style={styles.pinDot} />
        </View>

        <View style={styles.stepsRow}>
          {normalizedSteps.map((stepValue, idx) => {
            const pct = maxPoints > 0 ? (stepValue / maxPoints) * 100 : 0;
            const reached = clampedProgress >= stepValue;

            return (
              <View key={`${stepValue}-${idx}`} style={[styles.stepItem, { left: `${pct}%` }]}>
                <View style={[styles.stepDot, reached && styles.stepDotActive]} />
                {showStepLabels ? (
                  <Text style={styles.stepText}>{stepValue}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      {/* ✅ quitamos hint + quitamos totalRow (ya vive arriba) */}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    ...appStyles.card,

    // ✅ compacta el card
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.98,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },

  bigRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  bigNumber: { color: colors.text, fontSize: 26, fontWeight: "900", lineHeight: 30 },
  coinIcon: { marginTop: 1, backgroundColor: "transparent" },

  smallLabel: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: "700" },

  // ✅ badge “Acum: 276”
  accBadge: {
    marginLeft: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  accBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
  },

  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  pillIcon: { backgroundColor: "transparent" },

  // ✅ compacta barra
  barWrap: { position: "relative", height: 44, justifyContent: "center" },

  track: {
    position: "absolute",
    left: 6,
    right: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  fill: {
    position: "absolute",
    left: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  pinWrap: { position: "absolute", top: 0, transform: [{ translateX: -7 }], alignItems: "center" },
  pin: { width: 2, height: 14, backgroundColor: colors.primary, borderRadius: 999, opacity: 0.9 },
  pinDot: {
    marginTop: 2,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#fff",
  },

  stepsRow: { position: "absolute", left: 6, right: 6, top: 20, height: 22 },
  stepItem: { position: "absolute", transform: [{ translateX: -7 }], alignItems: "center" },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#D9D9D9",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepText: { marginTop: 4, fontSize: 9, color: colors.textMuted },
});
