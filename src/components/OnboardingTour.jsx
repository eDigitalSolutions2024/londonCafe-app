import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

const { width: SCREEN_W } = Dimensions.get("window");

// Un slide por sección real de la app (mismo orden que la barra de tabs en
// App.js) + uno de bienvenida al inicio. Si el día de mañana se agrega/
// quita un tab, este array es lo único que hay que tocar -- el resto del
// componente es genérico.
const SLIDES = [
  {
    emoji: "☕",
    title: "¡Bienvenido a London Café!",
    body: "Tu cafecito, tu mascota, tus recompensas -- todo en un solo lugar. Te damos un tour rapidito de 30 segundos.",
  },
  {
    emoji: "🏠",
    title: "Inicio",
    body: "Aquí vive tu avatar, tu racha diaria (reclama cada día sin fallar), tus Buddy Coins, tu mascota VIP y tus amigos.",
  },
  {
    emoji: "🛒",
    title: "Ordena",
    body: "Arma tu pedido, aplica tus cupones y paga desde la app -- pasa por él sin hacer fila.",
  },
  {
    emoji: "✨",
    title: "Escanear",
    body: "Escanea el ticket de tu compra en caja para sumar puntos y Buddy Coins automáticamente.",
  },
  {
    emoji: "🏪",
    title: "Tienda",
    body: "Consulta el menú completo de London Café, con precios y descripciones.",
  },
  {
    emoji: "🎁",
    title: "Regalos",
    body: "Envía tarjetas de regalo a tus amigos -- y aquí también aparecen tus cupones personales, listos para usar.",
  },
  {
    emoji: "📍",
    title: "Ubicación",
    body: "Encuentra la sucursal más cercana y cómo llegar.",
  },
];

export default function OnboardingTour({ onDone }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);
  const isLast = index === SLIDES.length - 1;

  const goTo = (i) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) setIndex(i);
  };

  return (
    <SafeAreaView style={styles.root}>
      <Pressable onPress={onDone} hitSlop={10} style={styles.skipBtn}>
        <Text style={styles.skipText}>Saltar →</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
            <View style={[styles.dot, i === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.nextBtn}
        onPress={() => (isLast ? onDone() : goTo(index + 1))}
      >
        <Text style={styles.nextText}>{isLast ? "Empezar" : "Siguiente →"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0709" },
  skipBtn: { alignSelf: "flex-end", paddingHorizontal: 20, paddingTop: 8 },
  skipText: { color: "rgba(255,255,255,0.55)", fontWeight: "800", fontSize: 13 },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  emoji: { fontSize: 64, marginBottom: 18 },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  body: { color: "rgba(255,255,255,0.7)", fontSize: 14.5, fontWeight: "600", textAlign: "center", lineHeight: 21 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  nextBtn: {
    marginHorizontal: 32,
    marginBottom: 24,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  nextText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
