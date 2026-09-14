import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, PanResponder } from "react-native";
import { colors } from "../theme/colors";
import { getDoodleLevel, MAX_DOODLE_LEVEL } from "../assets/doodleLevels";

/**
 * "Salto Café" -- mini-juego estilo Doodle Jump: la mascota rebota sola
 * hacia arriba de plataforma en plataforma, el jugador solo controla el
 * eje horizontal (arrastra el dedo por cualquier parte del tablero, el
 * personaje sigue el desplazamiento). Por niveles, igual que Café Crush:
 * cada nivel pide llegar a una altura (`targetHeight`) antes de caerse de
 * la pantalla -- entre más alto el nivel, plataformas más angostas y más
 * separadas (ver doodleLevels.js).
 *
 * Toda la física vive en refs (posición/velocidad del personaje, lista de
 * plataformas, cámara) -- se actualiza en un loop de setInterval a ~60fps
 * y se fuerza un re-render con un contador tonto (`renderTick`) en vez de
 * guardar cada posición en estado de React, que sería mucho más lento con
 * updates cada 16ms.
 */
const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };

const BOARD_WIDTH = 300;
const BOARD_HEIGHT = 420;
const CHAR_SIZE = 40;
const CHAR_HALF = CHAR_SIZE / 2;
const PLATFORM_HEIGHT = 14;
const GRAVITY = 0.32;
const JUMP_VELOCITY = -11.5;
const CAMERA_ANCHOR = BOARD_HEIGHT * 0.38; // altura de pantalla donde se "clava" el personaje mientras sube
const FRAME_MS = 16;

export default function PetDoodleJump({ visible, level = 1, species = "cat", petName = "tu mascota", onClose, onFinish }) {
  const levelDef = getDoodleLevel(level);
  const emoji = SPECIES_EMOJI[species] || "🐾";

  const [phase, setPhase] = useState("play");
  const [won, setWon] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const phaseRef = useRef("play");
  const overRef = useRef(false);
  phaseRef.current = phase;

  const charRef = useRef({ x: BOARD_WIDTH / 2, y: BOARD_HEIGHT - 60 });
  const vyRef = useRef(0);
  const startYRef = useRef(BOARD_HEIGHT - 60);
  const heightRef = useRef(0);
  const cameraTopRef = useRef(0);
  const platformsRef = useRef([]);
  const topmostYRef = useRef(0);
  const platformPid = useRef(0);
  const dragStartXRef = useRef(0);

  const squash = useRef(new Animated.Value(1)).current;

  function ensurePlatformsAbove() {
    const targetTop = cameraTopRef.current - BOARD_HEIGHT * 0.5;
    while (topmostYRef.current > targetTop) {
      const gap = levelDef.gapMin + Math.random() * (levelDef.gapMax - levelDef.gapMin);
      const w = levelDef.platformWidth;
      const y = topmostYRef.current - gap;
      const x = w / 2 + Math.random() * (BOARD_WIDTH - w);
      platformsRef.current.push({ id: platformPid.current++, x, y, w });
      topmostYRef.current = y;
    }
  }

  function prunePlatforms() {
    const limit = cameraTopRef.current + BOARD_HEIGHT * 2;
    if (platformsRef.current.length > 40) {
      platformsRef.current = platformsRef.current.filter((p) => p.y < limit);
    }
  }

  function triggerBounce() {
    squash.setValue(1);
    Animated.sequence([
      Animated.timing(squash, { toValue: 0.72, duration: 60, useNativeDriver: true }),
      Animated.spring(squash, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
  }

  function resetLevel() {
    const startX = BOARD_WIDTH / 2;
    const startY = BOARD_HEIGHT - 60;
    charRef.current = { x: startX, y: startY };
    vyRef.current = 0;
    startYRef.current = startY;
    heightRef.current = 0;
    cameraTopRef.current = 0;
    overRef.current = false;
    platformPid.current = 0;

    // Plataforma inicial justo debajo del personaje -- primer rebote
    // inmediato, sin caída libre al arrancar.
    const w0 = levelDef.platformWidth;
    const y0 = startY + CHAR_HALF + 4;
    platformsRef.current = [{ id: platformPid.current++, x: startX, y: y0, w: w0 }];
    topmostYRef.current = y0;
    ensurePlatformsAbove();

    setWon(false);
    setPhase("play");
    phaseRef.current = "play";
    setRenderTick((t) => t + 1);
  }

  useEffect(() => {
    if (!visible) return;
    resetLevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, level]);

  function endGame(didWin) {
    if (overRef.current) return;
    overRef.current = true;
    setWon(!!didWin);
    setPhase("over");
    phaseRef.current = "over";
  }

  function tick() {
    if (phaseRef.current !== "play") return;
    const ch = charRef.current;

    vyRef.current += GRAVITY;
    const prevY = ch.y;
    ch.y += vyRef.current;

    // Aterriza solo si iba cayendo (vy>0) y el pie cruzó la plataforma
    // justo en ESTE frame -- evita "pegarse" al tocar una desde abajo.
    if (vyRef.current > 0) {
      const prevFoot = prevY + CHAR_HALF;
      const foot = ch.y + CHAR_HALF;
      for (let i = 0; i < platformsRef.current.length; i++) {
        const p = platformsRef.current[i];
        if (prevFoot <= p.y && foot >= p.y) {
          const withinX = ch.x + CHAR_HALF > p.x - p.w / 2 && ch.x - CHAR_HALF < p.x + p.w / 2;
          if (withinX) {
            vyRef.current = JUMP_VELOCITY;
            ch.y = p.y - CHAR_HALF;
            triggerBounce();
            break;
          }
        }
      }
    }

    // Envuelve horizontalmente (como el Doodle Jump original).
    if (ch.x < -CHAR_HALF) ch.x = BOARD_WIDTH + CHAR_HALF;
    if (ch.x > BOARD_WIDTH + CHAR_HALF) ch.x = -CHAR_HALF;

    // Cámara: solo avanza hacia arriba, nunca retrocede al caer.
    cameraTopRef.current = Math.min(cameraTopRef.current, ch.y - CAMERA_ANCHOR);

    // Altura máxima alcanzada (no baja aunque el personaje caiga de vuelta).
    const climbed = startYRef.current - ch.y;
    if (climbed > heightRef.current) heightRef.current = climbed;

    ensurePlatformsAbove();
    prunePlatforms();

    if (heightRef.current >= levelDef.targetHeight) {
      endGame(true);
    } else if (ch.y - cameraTopRef.current > BOARD_HEIGHT + CHAR_SIZE) {
      endGame(false); // se cayó de la pantalla visible
    }

    setRenderTick((t) => t + 1);
  }

  useEffect(() => {
    if (!visible || phase !== "play") return;
    const id = setInterval(tick, FRAME_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, phase]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === "play",
      onMoveShouldSetPanResponder: () => phaseRef.current === "play",
      onPanResponderGrant: () => {
        dragStartXRef.current = charRef.current.x;
      },
      onPanResponderMove: (_e, gs) => {
        if (phaseRef.current !== "play") return;
        charRef.current.x = dragStartXRef.current + gs.dx;
      },
    })
  ).current;

  const score = Math.max(0, Math.min(1, heightRef.current / levelDef.targetHeight));
  const finish = () => onFinish?.(score, Math.round(heightRef.current), level, won);

  const ch = charRef.current;
  const camTop = cameraTopRef.current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>Salto Café 🦘 · Nivel {level}</Text>
              </View>
              <View style={styles.goalRow}>
                <Text style={styles.goalText}>
                  📏 {Math.max(0, Math.round(heightRef.current))}/{levelDef.targetHeight}
                </Text>
              </View>
              <Text style={styles.hdrSub}>Arrastra a los lados para moverte -- la mascota rebota sola</Text>

              <View style={styles.boardWrap} {...panResponder.panHandlers}>
                {platformsRef.current.map((p) => {
                  const top = p.y - camTop - PLATFORM_HEIGHT / 2;
                  if (top < -PLATFORM_HEIGHT || top > BOARD_HEIGHT) return null;
                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.platform,
                        { left: p.x - p.w / 2, top, width: p.w },
                      ]}
                    />
                  );
                })}

                <Animated.Text
                  style={[
                    styles.char,
                    {
                      left: ch.x - CHAR_HALF,
                      top: ch.y - camTop - CHAR_HALF,
                      transform: [{ scaleY: squash }],
                    },
                  ]}
                >
                  {emoji}
                </Animated.Text>
              </View>

              <Pressable style={styles.endBtn} onPress={() => endGame(false)}>
                <Text style={styles.endBtnText}>Salir</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>{won ? "🎉" : "😿"}</Text>
              <Text style={styles.doneTitle}>
                {won ? `¡Nivel ${level} completo!` : `${Math.round(heightRef.current)}/${levelDef.targetHeight}`}
              </Text>
              <Text style={styles.doneSub}>
                {won
                  ? `¡${petName} llegó hasta arriba! 🎉${level < MAX_DOODLE_LEVEL ? " Ya se abrió el siguiente nivel." : " ¡Completaste todos los niveles!"}`
                  : `${petName} se cayó -- ¡inténtalo de nuevo!`}
              </Text>
              {!won && (
                <Pressable style={styles.doneBtn} onPress={resetLevel}>
                  <Text style={styles.doneBtnText}>Reintentar</Text>
                </Pressable>
              )}
              <Pressable style={won ? styles.doneBtn : styles.doneBtnOutline} onPress={finish}>
                <Text style={won ? styles.doneBtnText : styles.doneBtnOutlineText}>
                  {won ? "Ver niveles 🗺️" : "Salir"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 12 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 22, padding: 14 },

  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hdrTitle: { color: "#111", fontSize: 16, fontWeight: "900" },
  goalRow: { flexDirection: "row", justifyContent: "center", marginTop: 6 },
  goalText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 4, marginBottom: 8, textAlign: "center" },

  boardWrap: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    alignSelf: "center",
    backgroundColor: "#eaf4fb",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    overflow: "hidden",
  },
  platform: {
    position: "absolute",
    height: PLATFORM_HEIGHT,
    borderRadius: 7,
    backgroundColor: "#4f9d69",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  char: {
    position: "absolute",
    width: CHAR_SIZE,
    height: CHAR_SIZE,
    fontSize: CHAR_SIZE * 0.85,
    textAlign: "center",
    lineHeight: CHAR_SIZE,
  },

  endBtn: { alignSelf: "center", marginTop: 12, paddingVertical: 10, paddingHorizontal: 26, borderRadius: 999, borderWidth: 1.5, borderColor: colors.primarySoft },
  endBtnText: { color: colors.primary, fontWeight: "900", fontSize: 13 },

  doneWrap: { alignItems: "center", paddingVertical: 20 },
  doneEmoji: { fontSize: 54 },
  doneTitle: { color: "#111", fontSize: 22, fontWeight: "900", marginTop: 6 },
  doneSub: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginTop: 4, textAlign: "center", paddingHorizontal: 10 },
  doneBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 44 },
  doneBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  doneBtnOutline: { marginTop: 12, borderRadius: 999, borderWidth: 1.5, borderColor: colors.primarySoft, paddingVertical: 11, paddingHorizontal: 44 },
  doneBtnOutlineText: { color: colors.primary, fontWeight: "900", fontSize: 14 },
});
