// src/components/MusicToggle.jsx
//
// Botón redondo 🎵/🔇 para silenciar la música de fondo de los minijuegos.
// Se coloca con `style` (position absolute) dentro del modal de cada juego.
// Si el binario no trae expo-audio, no se muestra (no hay nada que silenciar).
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { gameMusic } from "../audio/gameMusic";
import { useMusicMuted } from "../audio/useGameMusic";

export default function MusicToggle({ style }) {
  const [muted, toggle] = useMusicMuted();
  if (!gameMusic.isAvailable()) return null;

  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={muted ? "Activar música" : "Silenciar música"}
      style={({ pressed }) => [styles.btn, muted && styles.btnMuted, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={styles.icon}>{muted ? "🔇" : "🎵"}</Text>
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
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  btnMuted: { backgroundColor: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.12)" },
  icon: { fontSize: 17 },
});
