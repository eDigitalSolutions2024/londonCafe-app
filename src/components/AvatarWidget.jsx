import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import AvatarPreview from "./AvatarPreview";

export default function AvatarWidget({
  // ✅ NO defaults “bonitos” para no hardcodear
  name,
  mood,
  energy, // number | null

  // inventario (acumulable)
  coffee = 0,
  bread = 0,

  // cuando estás pegándole al backend
  feeding = false,

  // avatar
  avatarConfig,

  onFeedCoffee = () => {},
  onFeedBread = () => {},

  // tap / long press
  onAvatarPress = () => {},
  onAvatarLongPress = () => {},
  onAvatarPressIn = () => {},
  onAvatarPressOut = () => {},
}) {
  const hasEnergy = energy !== null && energy !== undefined && !Number.isNaN(Number(energy));
  const energyPct = hasEnergy ? Math.max(0, Math.min(100, Number(energy))) : 0;

  const displayName = (name || "Tu avatar").trim();
  const displayMood = hasEnergy ? (mood || "") : "Cargando estado...";
  const displayEnergyText = hasEnergy ? `${energyPct}%` : "--";

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

  // ✅ fallback SOLO para que no truene AvatarPreview, no para “inventar”
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

          <Text style={styles.avatarName}>{displayName}</Text>
          <Text style={styles.avatarMood}>{displayMood}</Text>
        </View>
      </View>

      {/* Lado derecho */}
      <View style={styles.right}>
        <Text style={styles.label}>Energía</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${energyPct}%` }]} />
        </View>

        <Text style={styles.energyText}>{displayEnergyText}</Text>

        {/* Inventario */}
        <Text style={styles.inventory}>
          Café: {Number(coffee) || 0}  •  Pan: {Number(bread) || 0}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onFeedCoffee}
            style={[styles.actionBtn, !canCoffee && styles.disabledBtn]}
            disabled={!canCoffee}
          >
            <Text style={styles.actionText}>
              {feeding ? "..." : "Dar café"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onFeedBread}
            style={[styles.actionBtnOutline, !canBread && styles.disabledBtnOutline]}
            disabled={!canBread}
          >
            <Text style={[styles.actionTextOutline, !canBread && styles.disabledTextOutline]}>
              {feeding ? "..." : "Dar pan"}
            </Text>
          </Pressable>
        </View>

        {!hasEnergy ? (
          <Text style={styles.hint}>Falta cargar buddy desde el backend.</Text>
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
    gap: 14,
  },

  left: { width: 120, justifyContent: "center" },
  right: { flex: 1, justifyContent: "center" },

  avatarBox: { alignItems: "center", gap: 6 },

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

  avatarName: { color: colors.text, fontWeight: "800" },
  avatarMood: { color: colors.textMuted, fontSize: 12 },

  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },

  energyText: { color: colors.text, marginTop: 6, fontWeight: "800" },

  inventory: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  actions: { flexDirection: "row", gap: 10, marginTop: 10 },

  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  actionBtnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  actionTextOutline: { color: colors.primary, fontWeight: "800", fontSize: 12 },

  disabledBtn: { opacity: 0.45 },
  disabledBtnOutline: { opacity: 0.45 },
  disabledTextOutline: { opacity: 0.9 },

  hint: { color: colors.textMuted, fontSize: 11, marginTop: 10, lineHeight: 14 },
});
