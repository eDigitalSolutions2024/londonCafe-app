// src/components/HolidayMusicToggle.jsx
//
// Botón 🔔/🔕 para silenciar la música navideña de fondo (ver audio/holidayMusic.js).
// Fuera de temporada, o si el binario no trae expo-audio, no se muestra.
import React, { useEffect, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { holidayMusic } from "../audio/holidayMusic";

export default function HolidayMusicToggle({ style }) {
  const [muted, setMuted] = useState(holidayMusic.isMuted());
  useEffect(() => {
    setMuted(holidayMusic.isMuted());
    return holidayMusic.subscribe(setMuted);
  }, []);

  if (!holidayMusic.isAvailable()) return null;

  return (
    <Pressable
      onPress={holidayMusic.toggleMuted}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={muted ? "Activar música navideña" : "Silenciar música navideña"}
      style={({ pressed }) => [styles.btn, muted && styles.btnMuted, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={styles.icon}>{muted ? "🔕" : "🔔"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,215,106,0.55)",
  },
  btnMuted: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)" },
  icon: { fontSize: 16 },
});
