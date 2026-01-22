import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import AvatarPreview from "./AvatarPreview";

export default function AvatarWidget({
  name = "Tu avatar",
  mood = "Con energía",
  energy = 80,
  avatarConfig = {
    skin: "skin_01",
    hair: null,
    hairColor: "hairColor_01",
    top: "top_01",
    bottom: "bottom_01",
    shoes: "shoes_01",
    accessory: null,
  },

  onFeedCoffee = () => {},
  onFeedBread = () => {},

  // ✅ 1 tap
  onAvatarPress = () => {},
  // ✅ long press
  onAvatarLongPress = () => {},
  // ✅ suelta
  onAvatarPressIn = () => {},
  onAvatarPressOut = () => {},
}) {
  const energyPct = Math.max(0, Math.min(100, Number(energy) || 0));

  // ✅ Fix Android: a veces dispara onPress después de longPress
  const longPressedRef = useRef(false);
  const longPressAtRef = useRef(0);
  const resetTimerRef = useRef(null);

  const LONGPRESS_GUARD_MS = 450; // ventana para bloquear el onPress tras long press

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

    // Si hubo long press (o acaba de ocurrir), NO navegamos a settings
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

    // ✅ NO reseteamos “inmediato” porque en algunos Android el orden de eventos es raro.
    // Mejor: resetea un poco después del release para que no se cuele un onPress tardío.
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      longPressedRef.current = false;
      longPressAtRef.current = 0;
      resetTimerRef.current = null;
    }, LONGPRESS_GUARD_MS);
  };

  return (
    <View style={styles.card}>
      {/* Lado izquierdo: Avatar */}
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
            <AvatarPreview config={avatarConfig} size={72} />
          </Pressable>

          <Text style={styles.avatarName}>{name}</Text>
          <Text style={styles.avatarMood}>{mood}</Text>
        </View>
      </View>

      {/* Lado derecho: Energía + acciones */}
      <View style={styles.right}>
        <Text style={styles.label}>Energía</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${energyPct}%` }]} />
        </View>

        <Text style={styles.energyText}>{energyPct}%</Text>

        <View style={styles.actions}>
          <Pressable onPress={onFeedCoffee} style={styles.actionBtn}>
            <Text style={styles.actionText}>Dar café</Text>
          </Pressable>

          <Pressable onPress={onFeedBread} style={styles.actionBtnOutline}>
            <Text style={styles.actionTextOutline}>Dar pan</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Tip: aliméntalo cada cierto tiempo para mantenerlo feliz.
        </Text>
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

  left: {
    width: 120,
    justifyContent: "center",
  },

  right: {
    flex: 1,
    justifyContent: "center",
  },

  avatarBox: {
    alignItems: "center",
    gap: 6,
  },

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

  avatarName: {
    color: colors.text,
    fontWeight: "800",
  },

  avatarMood: {
    color: colors.textMuted,
    fontSize: 12,
  },

  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
  },

  energyText: {
    color: colors.text,
    marginTop: 6,
    fontWeight: "800",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  actionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  actionBtnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },

  actionTextOutline: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 14,
  },
});
