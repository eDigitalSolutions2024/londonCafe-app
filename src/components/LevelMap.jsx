import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { colors } from "../theme/colors";

// Mapa de niveles genérico -- lo usan tanto Café Crush como Salto Café.
// Progresión SECUENCIAL: solo se puede jugar hasta `unlockedLevel` (el
// backend lo sube al ganar el nivel actual, ver pet.controller.js
// `playPet`). Los niveles por debajo de `unlockedLevel` ya se pasaron
// (⭐); el actual está abierto; el resto sigue con 🔒 hasta llegar ahí.
export default function LevelMap({ visible, title, levels, unlockedLevel = 1, badge, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.hdr}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.sub}>Elige un nivel</Text>

          <View style={styles.grid}>
            {levels.map((l) => {
              const locked = l.level > unlockedLevel;
              const done = l.level < unlockedLevel;
              return (
                <Pressable
                  key={l.level}
                  disabled={locked}
                  onPress={() => onSelect(l.level)}
                  style={[styles.tile, locked && styles.tileLocked, done && styles.tileDone]}
                >
                  <Text style={[styles.tileNum, locked && styles.tileNumLocked]}>
                    {locked ? "🔒" : done ? "⭐" : l.level}
                  </Text>
                  {!locked && <Text style={styles.tileGoal}>{badge ? badge(l) : ""}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 22, padding: 16 },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#111", fontSize: 18, fontWeight: "900" },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  closeText: { fontSize: 14, fontWeight: "900", color: "#111" },
  sub: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 4, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLocked: { backgroundColor: "#e3d8c8" },
  tileDone: { backgroundColor: "#e0a800" },
  tileNum: { color: "#fff", fontSize: 22, fontWeight: "900" },
  tileNumLocked: { color: "#a3927a" },
  tileGoal: { color: "#fff", fontSize: 10, fontWeight: "800", marginTop: 2 },
});
