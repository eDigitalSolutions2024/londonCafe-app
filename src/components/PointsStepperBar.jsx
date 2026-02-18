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
  iconSize =60,
  pillIconSize = 24,

  onPress,
  disabledPress = false,

  showStepLabels = true,
}) {
  const rawPoints = Number(points) || 0;
  const rawProgress = Number(progressPoints) || 0;
  const rawTotal = Number(totalAccumulated) || 0;

  const clampedProgress = Math.max(0, Math.min(maxPoints, rawProgress));
  const progressPct = maxPoints > 0 ? (clampedProgress / maxPoints) * 100 : 0;

  const displayPoints = useMemo(() => {
    try {
      return rawPoints.toLocaleString();
    } catch {
      return String(rawPoints);
    }
  }, [rawPoints]);

  const displayTotal = useMemo(() => {
    try {
      return rawTotal.toLocaleString();
    } catch {
      return String(rawTotal);
    }
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
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.bigRow}>
            <Text style={styles.bigNumber}>{displayPoints}</Text>

            {iconSource ? (
              <View style={styles.coinRing}>
                <Image
                  source={iconSource}
                  style={[
                    styles.coinIcon,
                    { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
                  ]}
                  resizeMode="contain"
                />
              </View>
            ) : null}

       
          </View>

          <Text style={styles.smallLabel}>{title}</Text>
        </View>

        {/* Pill */}
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
            const pct = maxPoints > 0 ? (stepValue / maxPoints) * 100 : 0;
            const reached = clampedProgress >= stepValue;

            return (
              <View key={`${stepValue}-${idx}`} style={[styles.stepItem, { left: `${pct}%` }]}>
                <View style={[styles.stepDot, reached && styles.stepDotActive]} />
                {showStepLabels ? <Text style={styles.stepText}>{stepValue}</Text> : null}
              </View>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ✅ un poquito más grande que la racha
  card: {
    marginTop: 14,
    ...appStyles.card,

    paddingVertical: 14, // antes 12
    paddingHorizontal: 14,

    // “premium” sin cambiar appStyles
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.98,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },

  bigRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },

  // ✅ número más hero
  bigNumber: {
    color: colors.text,
    fontSize: 30, // antes 26
    fontWeight: "900",
    lineHeight: 34,
    letterSpacing: 0.2,
  },

  // ✅ moneda dentro de “ring” suave
  coinRing: {
    width: 50,
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(128,16,35,0.06)",
    borderWidth: 1,
    borderColor: "rgba(128,16,35,0.12)",
  },
  coinIcon: { backgroundColor: "transparent" },

  smallLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  // ✅ badge “Acum: 276” más fino
  accBadge: {
    marginLeft: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(128,16,35,0.08)",
    borderWidth: 1,
    borderColor: "rgba(128,16,35,0.14)",
  },
  accBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(128,16,35,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { color: colors.primary, fontWeight: "900", fontSize: 11, letterSpacing: 0.2 },
  pillIcon: { backgroundColor: "transparent" },

  // ✅ barra más “pro”
  barWrap: { position: "relative", height: 50, justifyContent: "center" },

  track: {
    position: "absolute",
    left: 6,
    right: 6,
    height: 9, // antes 6
    borderRadius: 999,
    backgroundColor: "rgba(128,16,35,0.14)",
  },
  fill: {
    position: "absolute",
    left: 6,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  pinWrap: { position: "absolute", top: -1, transform: [{ translateX: -7 }], alignItems: "center" },
  pin: { width: 2, height: 16, backgroundColor: colors.primary, borderRadius: 999, opacity: 0.9 },
  pinDot: {
    marginTop: 2,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#fff",
  },

  stepsRow: { position: "absolute", left: 6, right: 6, top: 24, height: 24 },
  stepItem: { position: "absolute", transform: [{ translateX: -7 }], alignItems: "center" },
  stepDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.12)",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stepDotActive: { backgroundColor: colors.primary },

  stepText: {
    marginTop: 5,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: "800",
  },
});
