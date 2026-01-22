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
    hair: "hair_01",
    top: "top_01",
    bottom: "bottom_01",
    shoes: "shoes_01",
    accessory: null,
  },
  onFeedCoffee = () => {},
  onFeedBread = () => {},

  // ✅ 1 tap = settings
  onAvatarPress = () => {},
  // ✅ long press = vista grande
  onAvatarLongPress = () => {},
  // ✅ opcionales (por si quieres animar o algo)
  onAvatarPressIn = () => {},
  onAvatarPressOut = () => {},
}) {
  const energyPct = Math.max(0, Math.min(100, Number(energy) || 0));

  // ✅ Evita que onPress se dispare después de un long press
  const longPressFiredRef = useRef(false);

  const handlePressIn = () => {
    longPressFiredRef.current = false; // reset al tocar
    onAvatarPressIn?.();
  };

  const handleLongPress = () => {
    longPressFiredRef.current = true;
    onAvatarLongPress?.();
  };

  const handlePress = () => {
    // Si venimos de long press, NO navegamos a settings
    if (longPressFiredRef.current) return;
    onAvatarPress?.();
  };

  const handlePressOut = () => {
    onAvatarPressOut?.();

    // Resetea después de soltar (por si el usuario toca otra vez)
    // (lo ponemos con micro-delay para no interferir con el press cycle)
    setTimeout(() => {
      longPressFiredRef.current = false;
    }, 0);
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
