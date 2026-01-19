import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme/colors";
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
}) {

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        {/* Preview 2D (placeholder por ahora) */}
        <View style={styles.avatarBox}>
        <View style={styles.avatarCircle}>
        <AvatarPreview config={avatarConfig} size={74} />
        </View>

          <Text style={styles.avatarName}>{name}</Text>
          <Text style={styles.avatarMood}>{mood}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.label}>Energía</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, energy))}%` }]} />
        </View>
        <Text style={styles.energyText}>{energy}%</Text>

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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border ?? "#3b2a35",
    backgroundColor: colors.card ?? "#121018",
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  left: { width: 120, justifyContent: "center" },
  right: { flex: 1, justifyContent: "center" },

  avatarBox: { alignItems: "center", gap: 6 },
  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary ?? "#7b1f3a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden", // 👈 agrega esto
  },
  avatarEmoji: { fontSize: 28 },
  avatarName: { color: colors.text ?? "#fff", fontWeight: "700" },
  avatarMood: { color: colors.textMuted ?? "#c7c7c7", fontSize: 12 },

  label: { color: colors.textMuted ?? "#c7c7c7", fontSize: 12, marginBottom: 6 },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#221c27",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2f2633",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary ?? "#7b1f3a" },
  energyText: { color: colors.text ?? "#fff", marginTop: 6, fontWeight: "700" },

  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primary ?? "#7b1f3a",
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  actionBtnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary ?? "#7b1f3a",
  },
  actionTextOutline: { color: colors.text ?? "#fff", fontWeight: "700", fontSize: 12 },

  hint: { color: colors.textMuted ?? "#c7c7c7", fontSize: 11, marginTop: 10, lineHeight: 14 },
});
