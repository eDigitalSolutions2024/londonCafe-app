import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";

const TOY = { cat: "🧶", dog: "🦴", hamster: "🌰" };
const PET = { cat: "🐱", dog: "🐶", hamster: "🐹" };
const DURATION_S = 8;
const TARGET_HITS = 12; // atrapadas para score 1.0
const AREA_W = 300;
const AREA_H = 340;
const TOY_SIZE = 54;
const PET_SIZE = 56;

/**
 * Mini-juego tipo POU: un juguete rebota por el área; tócalo cuantas
 * veces puedas en 8s. La mascota persigue el juguete abajo y brinca
 * cuando lo atrapas. Al terminar devuelve score 0..1 (aciertos/objetivo).
 */
export default function PetMiniGame({ visible, species = "cat", petName = "tu mascota", onClose, onFinish }) {
  const toy = TOY[species] || "🎾";
  const petEmoji = PET[species] || "🐾";

  const pos = useRef(new Animated.ValueXY({ x: AREA_W / 2 - TOY_SIZE / 2, y: AREA_H / 2 - TOY_SIZE / 2 })).current;
  const pop = useRef(new Animated.Value(1)).current;
  const petX = useRef(new Animated.Value(AREA_W / 2 - PET_SIZE / 2)).current;
  const petHop = useRef(new Animated.Value(0)).current;
  const petBob = useRef(new Animated.Value(0)).current;

  const [hits, setHits] = useState(0);
  const [left, setLeft] = useState(DURATION_S);
  const [phase, setPhase] = useState("play"); // "play" | "done"
  const moveRef = useRef(null);
  const tickRef = useRef(null);

  // Bob suave de la mascota (siempre)
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(petBob, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(petBob, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, petBob]);

  useEffect(() => {
    if (!visible) return;
    setHits(0);
    setLeft(DURATION_S);
    setPhase("play");
    pos.setValue({ x: AREA_W / 2 - TOY_SIZE / 2, y: AREA_H / 2 - TOY_SIZE / 2 });
    petX.setValue(AREA_W / 2 - PET_SIZE / 2);

    const chase = (targetX) => {
      const px = Math.max(0, Math.min(AREA_W - PET_SIZE, targetX + TOY_SIZE / 2 - PET_SIZE / 2));
      Animated.timing(petX, { toValue: px, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    };

    const jump = () => {
      const x = Math.random() * (AREA_W - TOY_SIZE);
      const y = Math.random() * (AREA_H - TOY_SIZE - 70); // deja espacio abajo para la mascota
      Animated.timing(pos, {
        toValue: { x, y },
        duration: 620,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
      chase(x);
    };
    moveRef.current = setInterval(jump, 720);
    jump();

    tickRef.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(moveRef.current);
          clearInterval(tickRef.current);
          setPhase("done");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(moveRef.current);
      clearInterval(tickRef.current);
    };
  }, [visible, pos, petX]);

  const onCatch = () => {
    if (phase !== "play") return;
    setHits((h) => h + 1);
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
    // la mascota brinca de alegría
    Animated.sequence([
      Animated.timing(petHop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(petHop, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    // el juguete salta a otro lado
    const x = Math.random() * (AREA_W - TOY_SIZE);
    const y = Math.random() * (AREA_H - TOY_SIZE - 70);
    Animated.timing(pos, { toValue: { x, y }, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(petX, {
      toValue: Math.max(0, Math.min(AREA_W - PET_SIZE, x + TOY_SIZE / 2 - PET_SIZE / 2)),
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const score = Math.max(0, Math.min(1, hits / TARGET_HITS));
  const finish = () => onFinish?.(score, hits);

  const petBobY = petBob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const petHopY = petHop.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>¡Atrapa el juguete!</Text>
                <Text style={styles.hdrTimer}>{left}s</Text>
              </View>
              <Text style={styles.hdrSub}>Atrapadas: {hits}</Text>

              <View style={styles.area}>
                <Animated.View style={[styles.toyWrap, { transform: pos.getTranslateTransform() }]}>
                  <Pressable onPress={onCatch} hitSlop={12}>
                    <Animated.Text style={[styles.toy, { transform: [{ scale: pop }] }]}>{toy}</Animated.Text>
                  </Pressable>
                </Animated.View>

                {/* la mascota persigue abajo */}
                <Animated.Text
                  pointerEvents="none"
                  style={[
                    styles.pet,
                    { transform: [{ translateX: petX }, { translateY: Animated.add(petBobY, petHopY) }] },
                  ]}
                >
                  {petEmoji}
                </Animated.Text>
              </View>

              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Salir</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>{score >= 0.75 ? "🎉" : score >= 0.4 ? "😸" : "🙂"}</Text>
              <Text style={styles.doneTitle}>{hits} atrapadas</Text>
              <Text style={styles.doneSub}>
                {score >= 0.75
                  ? `¡${petName} está feliz!`
                  : score >= 0.4
                  ? `A ${petName} le gustó`
                  : `${petName} quiere otra`}
              </Text>
              <Pressable style={styles.doneBtn} onPress={finish}>
                <Text style={styles.doneBtnText}>Listo</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 360, backgroundColor: colors.card, borderRadius: 20, padding: 16 },

  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hdrTitle: { color: "#111", fontSize: 16, fontWeight: "900" },
  hdrTimer: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  hdrSub: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginTop: 2, marginBottom: 10 },

  area: {
    width: AREA_W,
    height: AREA_H,
    alignSelf: "center",
    backgroundColor: "#faf1e4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    overflow: "hidden",
  },
  toyWrap: { position: "absolute", width: TOY_SIZE, height: TOY_SIZE, alignItems: "center", justifyContent: "center" },
  toy: { fontSize: 44 },
  pet: { position: "absolute", bottom: 8, left: 0, fontSize: PET_SIZE, width: PET_SIZE, textAlign: "center" },

  cancel: { alignSelf: "center", marginTop: 12, paddingVertical: 8, paddingHorizontal: 18 },
  cancelText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },

  doneWrap: { alignItems: "center", paddingVertical: 18 },
  doneEmoji: { fontSize: 54 },
  doneTitle: { color: "#111", fontSize: 20, fontWeight: "900", marginTop: 6 },
  doneSub: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginTop: 4 },
  doneBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 40 },
  doneBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
