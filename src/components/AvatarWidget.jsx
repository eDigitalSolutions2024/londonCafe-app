import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import AvatarPreview from "./AvatarPreview";

export default function AvatarWidget({
  name,
  mood,
  energy, // number | null

  coffee = 0,
  bread = 0,

  feeding = false,

  avatarConfig,

  onFeedCoffee = () => {},
  onFeedBread = () => {},

  onAvatarPress = () => {},
  onAvatarLongPress = () => {},
  onAvatarPressIn = () => {},
  onAvatarPressOut = () => {},
  // ✅ opcional: si lo estás pasando desde Home
  energyFlash = false,
}) {
  const hasEnergy = energy !== null && energy !== undefined && !Number.isNaN(Number(energy));
  const energyPct = hasEnergy ? Math.max(0, Math.min(100, Number(energy))) : 0;

  const displayName = (name || "Tu avatar").trim();
  const displayMood = hasEnergy ? (mood || "") : "Cargando estado...";
  const displayEnergyText = hasEnergy ? `${Math.round(energyPct)}%` : "--";

  const canCoffee = hasEnergy && !feeding && Number(coffee) > 0;
  const canBread = hasEnergy && !feeding && Number(bread) > 0;

  // ✅ Fix Android: a veces dispara onPress después de longPress
  const longPressedRef = useRef(false);
  const longPressAtRef = useRef(0);
  const resetTimerRef = useRef(null);
  const LONGPRESS_GUARD_MS = 450;

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const handlePressIn = () => {
    clearResetTimer();
    longPressedRef.current = false;
    longPressAtRef.current = 0;
    onAvatarPressIn?.();
  };

  const handleLongPress = () => {
    longPressedRef.current = true;
    longPressAtRef.current = Date.now();
    onAvatarLongPress?.();
  };

  const handlePress = () => {
    const now = Date.now();
    if (
      longPressedRef.current ||
      (longPressAtRef.current && now - longPressAtRef.current < LONGPRESS_GUARD_MS)
    ) {
      return;
    }
    onAvatarPress?.();
  };

  const handlePressOut = () => {
    onAvatarPressOut?.();

    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      longPressedRef.current = false;
      longPressAtRef.current = 0;
      resetTimerRef.current = null;
    }, LONGPRESS_GUARD_MS);
  };

  // ✅ fallback SOLO para que no truene AvatarPreview
  const safeConfig = {
    hair: "hair_01",
    ...(avatarConfig || {}),
  };

  return (
    <View style={styles.card}>
      {/* Lado izquierdo */}
      <View style={styles.left}>
        <View style={styles.avatarBox}>
          <Pressable
            onPressIn={handlePressIn}
            onLongPress={handleLongPress}
            onPress={handlePress}
            onPressOut={handlePressOut}
            delayLongPress={250}
            style={styles.avatarCircle}
          >
            <AvatarPreview config={safeConfig} size={72} />
          </Pressable>

          <Text style={styles.avatarName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.avatarMood}>{displayMood}</Text>
        </View>
      </View>

      {/* Lado derecho */}
      <View style={styles.right}>
        {/* ✅ Energía + % en una sola fila */}
        <View style={styles.energyRow}>
          <Text style={styles.label}>Energía</Text>
          <Text style={styles.energyText}>{displayEnergyText}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${energyPct}%` },
              energyFlash && styles.progressFillFlash,
            ]}
          />
        </View>

        {/* ✅ Chips compactos */}
        <View style={styles.chipsRow}>
          <View style={[styles.chip, !canCoffee && styles.chipDisabled]}>
            <Text style={[styles.chipText, !canCoffee && styles.chipTextDisabled]}>
              ☕ {Number(coffee) || 0}
            </Text>
          </View>

          <View style={[styles.chip, !canBread && styles.chipDisabled]}>
            <Text style={[styles.chipText, !canBread && styles.chipTextDisabled]}>
              🥖 {Number(bread) || 0}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onFeedCoffee}
            style={[styles.actionBtn, !canCoffee && styles.disabledBtn]}
            disabled={!canCoffee}
          >
            <Text style={styles.actionText}>{feeding ? "..." : "Dar ☕"}</Text>
          </Pressable>

          <Pressable
            onPress={onFeedBread}
            style={[styles.actionBtnOutline, !canBread && styles.disabledBtnOutline]}
            disabled={!canBread}
          >
            <Text style={[styles.actionTextOutline, !canBread && styles.disabledTextOutline]}>
              {feeding ? "..." : "Dar 🥖"}
            </Text>
          </Pressable>
        </View>

        {!hasEnergy ? (
          <Text style={styles.hint}>Cargando buddy…</Text>
        ) : (
          <Text style={styles.hint}>Tip: aliméntalo para mantenerlo feliz.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...appStyles.card,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },

  left: { width: 112, justifyContent: "center" },
  right: { flex: 1, justifyContent: "center" },

  avatarBox: { alignItems: "center", gap: 4 },

  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarName: { color: colors.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  avatarMood: { color: colors.textMuted, fontSize: 11 },

  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  label: { color: colors.textMuted, fontSize: 11 },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },

  // ✅ opcional: pequeño flash cuando sube energía
  progressFillFlash: {
    // sin colores nuevos; usa opacidad
    opacity: 0.92,
  },

  energyText: { color: colors.text, fontWeight: "900", fontSize: 12 },

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(128,16,35,0.08)",
    borderWidth: 1,
    borderColor: "rgba(128,16,35,0.18)",
  },

  chipText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 12,
  },

  chipDisabled: { opacity: 0.55 },
  chipTextDisabled: { opacity: 0.9 },

  actions: { flexDirection: "row", gap: 8, marginTop: 10 },

  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  actionBtnOutline: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionTextOutline: { color: colors.primary, fontWeight: "900", fontSize: 12 },

  disabledBtn: { opacity: 0.45 },
  disabledBtnOutline: { opacity: 0.45 },
  disabledTextOutline: { opacity: 0.9 },

  hint: { color: colors.textMuted, fontSize: 10, marginTop: 8, lineHeight: 13 },
});
