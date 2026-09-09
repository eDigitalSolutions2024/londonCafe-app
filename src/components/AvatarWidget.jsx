import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { colors } from "../theme/colors";
import { appStyles } from "../theme/styles";
import AvatarPreview from "./AvatarPreview";

// ✅ Resalta el avatar con un brillo dorado detrás -- a propósito distinto
// del anillo delgado (stroke) que ya usa el logo de London Café arriba en
// el header, para que no se confundan visualmente (pedido del usuario).
// Mismo patrón de radio-seguro que el resto de la app (r bien dentro del
// lienzo, más un stop final en 0% de opacidad) para no repetir el bug del
// "cuadro" al magnificarse con el scale animado.
function AvatarGlow({ size = 100 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        top: -(size - 76) / 2,
        left: -(size - 76) / 2,
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: [{ scale }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.6" />
            <Stop offset="60%" stopColor={colors.accent} stopOpacity="0.22" />
            <Stop offset="90%" stopColor={colors.accent} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.42} fill="url(#avatarGlow)" />
      </Svg>
    </Animated.View>
  );
}

// ✅ Badge de "editar" -- estático a propósito, el pulso ya lo hace el
// brillo del avatar (AvatarGlow); dos cosas parpadeando a la vez competían
// por la atención.
function EditBadge() {
  return (
    <View pointerEvents="none" style={styles.editBadge}>
      <Text style={styles.editBadgeText}>✏️</Text>
    </View>
  );
}

export default function AvatarWidget({
  name,
  mood,
  moodEmoji = "🙂",
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
            style={styles.avatarPressable}
          >
            <AvatarGlow size={112} />
            {/* avatarCircle recorta la imagen (overflow hidden) -- el badge
                vive fuera de ese contenedor para no cortarse en la orilla. */}
            <View style={styles.avatarCircle}>
              <AvatarPreview config={safeConfig} size={76} />
            </View>
            <EditBadge />
          </Pressable>

          {/* <Text style={styles.avatarName} numberOfLines={2}>
            {displayName}
          </Text>*/}
          <View style={styles.moodRow}>
  <Text style={styles.avatarMood}>{displayMood}</Text>
  <Text style={styles.moodEmoji}>{moodEmoji}</Text>
</View>
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
  <Pressable
    onPress={onFeedCoffee}
    disabled={!canCoffee}
    style={({ pressed }) => [
      styles.feedBtn,
      !canCoffee && styles.feedBtnDisabled,
      pressed && canCoffee && styles.feedBtnPressed,
    ]}
  >
    <Text style={[styles.feedBtnText, !canCoffee && styles.feedBtnTextDisabled]}>
      ☕ {Number(coffee) || 0}
    </Text>
  </Pressable>

  <Pressable
    onPress={onFeedBread}
    disabled={!canBread}
    style={({ pressed }) => [
      styles.feedBtn,
      !canBread && styles.feedBtnDisabled,
      pressed && canBread && styles.feedBtnPressed,
    ]}
  >
    <Text style={[styles.feedBtnText, !canBread && styles.feedBtnTextDisabled]}>
      🥖 {Number(bread) || 0}
    </Text>
  </Pressable>
</View>

        {/*<View style={styles.actions}>
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
        </View>*/}

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
  gap: 10,
  paddingVertical: 8,  // ✅ más compacto
},

left: { width: 96, justifyContent: "center" }, // ✅ reduce espacio
right: { flex: 1, justifyContent: "center" },

chipsRow: {
  flexDirection: "row",
  gap: 10,
  marginTop: 10,
  justifyContent: "center",
},


chip: {
  flexDirection: "row",      // ✅ para icono + count + dar
  alignItems: "center",
  gap: 8,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  backgroundColor: "rgba(128,16,35,0.12)", // ✅ más color
  borderWidth: 1,
  borderColor: "rgba(128,16,35,0.25)",
},

chipPressed: {
  transform: [{ scale: 0.98 }],
  opacity: 0.92,
},

chipText: {
  color: colors.primary,
  fontWeight: "900",
  fontSize: 12,
},

chipCount: {
  color: colors.primary,
  fontWeight: "900",
  fontSize: 12,
  minWidth: 18,
  textAlign: "center",
},

chipDar: {
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  backgroundColor: colors.primary,      // ✅ rojo de tu app
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.06)",
},

chipDarText: {
  color: "#fff",                        // ✅ texto blanco
  fontSize: 10,
  fontWeight: "900",
},

  avatarBox: { alignItems: "center", gap: 4 },

  avatarPressable: { position: "relative", width: 76, height: 76 },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    // ✅ borde dorado sólido (no el anillo delgado tipo gradiente que ya
    // usa el logo del header) + el glow detrás -- así se lee como "esto
    // es especial/tócalo", con un lenguaje visual distinto al del logo.
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  editBadgeText: { fontSize: 9 },

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

  feedBtn: {
  minWidth: 86,
  height: 34,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.primary,     // ✅ rojo app
  paddingHorizontal: 12,
},

feedBtnPressed: {
  transform: [{ scale: 0.98 }],
  opacity: 0.95,
},

feedBtnDisabled: {
  backgroundColor: colors.primarySoft, // ✅ suave cuando no hay
  borderWidth: 1,
  borderColor: colors.primarySoft,
},

feedBtnText: {
  color: "#fff",
  fontWeight: "900",
  fontSize: 12,
},

feedBtnTextDisabled: {
  color: colors.textMuted,
},
moodRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},

moodEmoji: {
  fontSize: 12,
},
});
