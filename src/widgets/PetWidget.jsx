import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };

const NEED_TEXT = {
  feed: "tiene hambre 🍽️",
  play: "quiere jugar 🎾",
  sleep: "tiene sueño 😴",
  clean: "hay que limpiarlo 🧼",
};
const MOOD_TEXT = {
  happy: "está feliz 😊",
  meh: "tranquilo 😐",
  sad: "necesita cariño 😢",
  hungry: "tiene hambre 🍽️",
  sleepy: "con sueño 😴",
  dirty: "está sucio 🧼",
};

/**
 * Widget de pantalla de inicio (Android) con la mascota VIP -- estilo
 * "gadget" tipo Duolingo: la mascota y qué necesita, de un vistazo.
 * Se renderiza desde widget-task-handler.jsx con los datos de /pet.
 */
export function PetWidget({ pet, mood, need, ageDays, error }) {
  const emoji = SPECIES_EMOJI[pet?.species] || "🐾";
  const name = pet?.name || "Tu mascota";
  const line = error
    ? "Abre la app para ver a tu mascota"
    : need
    ? `${name} ${NEED_TEXT[need] || ""}`.trim()
    : `${name} ${MOOD_TEXT[mood] || ""}`.trim();
  const sub = error ? "London Café" : typeof ageDays === "number" ? `Día ${ageDays} contigo` : "London Café";

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF3EA",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TextWidget text={emoji} style={{ fontSize: 46, marginRight: 12 }} />
      <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
        <TextWidget
          text="MASCOTA VIP"
          style={{ fontSize: 10, color: "#9A7B58", fontWeight: "bold" }}
        />
        <TextWidget
          text={line}
          style={{ fontSize: 15, color: "#2A0E18", fontWeight: "bold" }}
          maxLines={2}
        />
        <TextWidget text={sub} style={{ fontSize: 11, color: "#9A7B58" }} />
      </FlexWidget>
    </FlexWidget>
  );
}
