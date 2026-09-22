// src/components/PetBaristaNinja.jsx
//
// "Barista Ninja" -- mini-juego estilo Fruit Ninja:
// Productos exclusivos de London Café (café, croissants, pasteles, galletas,
// matcha, frappés, donas) saltan desde la parte inferior en parábolas.
// El jugador desliza el dedo por la pantalla como una katana barista para rebanarlos,
// acumulando combos de corte, evitando las bombas de vapor y alcanzando la meta
// de rebanadas (`targetSlices`) para avanzar de nivel.
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  PanResponder,
} from "react-native";
import { colors } from "../theme/colors";
import { getNinjaLevel, MAX_NINJA_LEVEL } from "../assets/ninjaLevels";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };

const BOARD_WIDTH = 320;
const BOARD_HEIGHT = 440;
const FRAME_MS = 16;
const GRAVITY = 0.38;
const ITEM_RADIUS = 26;
const MAX_STRIKES = 3;

// Solo productos reales de London Café
const CAFE_PRODUCTS = [
  { id: "latte", emoji: "☕", name: "Café Latte", color: "#8D5B4C", pts: 10 },
  { id: "croissant", emoji: "🥐", name: "Croissant", color: "#D4A373", pts: 15 },
  { id: "cake", emoji: "🍰", name: "Pastel", color: "#E63946", pts: 15 },
  { id: "cookie", emoji: "🍪", name: "Galleta", color: "#BC6C25", pts: 20 },
  { id: "matcha", emoji: "🍵", name: "Té Matcha", color: "#52B788", pts: 20 },
  { id: "frappe", emoji: "🥤", name: "Frappé", color: "#9D4EDD", pts: 25 },
  { id: "donut", emoji: "🍩", name: "Dona", color: "#E07A5F", pts: 25 },
  { id: "golden_bean", emoji: "🫘", name: "Grano Oro", color: "#FFD700", pts: 50, special: true },
];

// Survival: sin meta ni niveles fijos -- los cortes acumulados (sliced)
// SON el puntaje, y la dificultad se recalcula en cada oleada nueva
// (spawnWave) interpolando la misma curva que ya usan los 10 niveles
// fijos (ver ninjaLevels.js) pero SIN toparla en el nivel 10.
function survivalDifficultyAt(sliced) {
  const s = Math.max(0, sliced);
  return {
    spawnIntervalMs: Math.max(380, 1400 - s * 9),
    maxSimultaneous: Math.min(7, 2 + Math.floor(s / 12)),
    bombChance: Math.min(0.5, s * 0.0045),
    speedMult: Math.min(2.0, 1.0 + s * 0.0045),
  };
}
const SURVIVAL_NINJA_DEF = { targetSlices: Infinity };

function distToSegmentSquared(px, py, vx, vy, wx, wy) {
  const l2 = (vx - wx) * (vx - wx) + (vy - wy) * (vy - wy);
  if (l2 === 0) return (px - vx) * (px - vx) + (py - vy) * (py - vy);
  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - wy)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = vx + t * (wx - vx);
  const projY = vy + t * (wy - vy);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

export default function PetBaristaNinja({
  visible,
  level = 1,
  survival = false,
  species = "cat",
  petName = "tu mascota",
  onClose,
  onFinish,
}) {
  const levelDef = survival ? SURVIVAL_NINJA_DEF : getNinjaLevel(level);
  const petEmoji = SPECIES_EMOJI[species] || "🐾";

  const [phase, setPhase] = useState("play"); // 'play' | 'over'
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [slicedCount, setSlicedCount] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [comboText, setComboText] = useState(null);
  const [, setRenderTick] = useState(0);

  const phaseRef = useRef("play");
  const overRef = useRef(false);
  phaseRef.current = phase;

  // Entidades del juego en refs para rendimiento a 60 FPS
  const itemsRef = useRef([]);
  const halvesRef = useRef([]);
  const particlesRef = useRef([]);
  const bladeTrailRef = useRef([]);
  const lastTouchRef = useRef(null);
  const currentSwipeSlices = useRef(0);
  const pidRef = useRef(0);
  const particleIdRef = useRef(0);
  const trailIdRef = useRef(0);

  const scoreRef = useRef(0);
  const slicedCountRef = useRef(0);
  const strikesRef = useRef(0);
  const nextSpawnTimeRef = useRef(0);

  // Inicialización y reinicio de partida
  useEffect(() => {
    if (!visible) return;
    phaseRef.current = "play";
    overRef.current = false;
    setPhase("play");
    setWon(false);
    setScore(0);
    setSlicedCount(0);
    setStrikes(0);
    setComboText(null);

    scoreRef.current = 0;
    slicedCountRef.current = 0;
    strikesRef.current = 0;
    itemsRef.current = [];
    halvesRef.current = [];
    particlesRef.current = [];
    bladeTrailRef.current = [];
    lastTouchRef.current = null;
    currentSwipeSlices.current = 0;
    nextSpawnTimeRef.current = Date.now() + 600;
  }, [visible, level]);

  // Fin del juego (victoria o derrota)
  const triggerGameOver = (didWin, reason = "") => {
    if (overRef.current) return;
    overRef.current = true;
    phaseRef.current = "over";
    setPhase("over");
    setWon(didWin);

    if (reason === "bomb") {
      setComboText("💥 ¡BOMBA DE VAPOR!");
    }
  };

  // Lanzamiento de productos de café
  const spawnWave = (now) => {
    const d = survival ? survivalDifficultyAt(slicedCountRef.current) : levelDef;
    const isBomb = Math.random() < d.bombChance;
    const count = Math.min(
      d.maxSimultaneous,
      1 + Math.floor(Math.random() * d.maxSimultaneous)
    );

    for (let i = 0; i < count; i++) {
      pidRef.current += 1;
      const id = pidRef.current;
      const x = 50 + Math.random() * (BOARD_WIDTH - 100);
      const y = BOARD_HEIGHT + 10;
      // velocidad horizontal hacia el centro
      const vx = ((BOARD_WIDTH / 2 - x) / 70) + (Math.random() - 0.5) * 2.8;
      // velocidad vertical con parábola
      const vy = -(11.8 + Math.random() * 3.2) * d.speedMult;
      const rot = Math.random() * 360;
      const vrot = (Math.random() - 0.5) * 10;

      if (isBomb && i === 0) {
        itemsRef.current.push({
          id,
          type: "bomb",
          emoji: "💣",
          name: "Bomba Vapor",
          color: "#333",
          x,
          y,
          vx,
          vy,
          rot,
          vrot,
          radius: ITEM_RADIUS,
          sliced: false,
        });
      } else {
        const isGolden = Math.random() < 0.08;
        const prod = isGolden
          ? CAFE_PRODUCTS[CAFE_PRODUCTS.length - 1]
          : CAFE_PRODUCTS[Math.floor(Math.random() * (CAFE_PRODUCTS.length - 1))];

        itemsRef.current.push({
          id,
          type: "food",
          ...prod,
          x,
          y,
          vx,
          vy,
          rot,
          vrot,
          radius: ITEM_RADIUS,
          sliced: false,
        });
      }
    }

    nextSpawnTimeRef.current = now + d.spawnIntervalMs * (0.85 + Math.random() * 0.3);
  };

  // Detección de corte entre dos puntos del dedo
  const checkSlice = (p1, p2) => {
    if (overRef.current) return;

    itemsRef.current.forEach((it) => {
      if (it.sliced) return;

      const distSq = distToSegmentSquared(it.x, it.y, p1.x, p1.y, p2.x, p2.y);
      if (distSq <= it.radius * it.radius * 1.35) {
        it.sliced = true;

        if (it.type === "bomb") {
          // Cortar bomba = detonación y fin
          triggerGameOver(false, "bomb");
          return;
        }

        // Crear 2 mitades volando hacia los lados
        pidRef.current += 1;
        halvesRef.current.push({
          id: pidRef.current,
          emoji: it.emoji,
          x: it.x - 6,
          y: it.y,
          vx: it.vx - 3.5,
          vy: it.vy - 1.5,
          rot: it.rot,
          vrot: -9,
          scale: 0.85,
        });

        pidRef.current += 1;
        halvesRef.current.push({
          id: pidRef.current,
          emoji: it.emoji,
          x: it.x + 6,
          y: it.y,
          vx: it.vx + 3.5,
          vy: it.vy - 1.5,
          rot: it.rot,
          vrot: 9,
          scale: 0.85,
        });

        // Crear partículas de salpicadura de color
        for (let k = 0; k < 6; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 4.5;
          particleIdRef.current += 1;
          particlesRef.current.push({
            id: particleIdRef.current,
            x: it.x,
            y: it.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: it.color,
            life: 1.0,
            size: 4 + Math.random() * 4,
          });
        }

        currentSwipeSlices.current += 1;

        // Puntos
        const pts = it.pts || 10;
        scoreRef.current += pts;
        slicedCountRef.current += 1;
        setScore(scoreRef.current);
        setSlicedCount(slicedCountRef.current);

        // Comprobar victoria
        if (slicedCountRef.current >= levelDef.targetSlices) {
          triggerGameOver(true);
        }
      }
    });

    // Notificación visual de combos si cortó múltiples en el mismo trazo
    if (currentSwipeSlices.current >= 3) {
      const combo = currentSwipeSlices.current;
      setComboText(`¡Combo x${combo}! 🔥`);
      scoreRef.current += combo * 5;
      setScore(scoreRef.current);
    }
  };

  // PanResponder para captura táctil suave de la estela de corte
  const panResponder = useRef(
    PanResponder.create({
      // v2: bug real -- devolvía true SIEMPRE, sin importar la fase. Eso
      // capturaba el toque ANTES de que pudiera llegarle al botón
      // "Continuar" de la pantalla de fin de nivel (mismo View, el botón
      // vive encima de este responder de corte) -- el onPanResponderGrant/
      // Move de abajo sí revisaban `phase === "play"`, pero para
      // entonces el toque ya había sido interceptado, así que el botón
      // nunca recibía el tap. Se agrega la misma condición aquí, un paso
      // antes: si no se está jugando, este responder ni siquiera se
      // adjudica el toque.
      onStartShouldSetPanResponder: () => phaseRef.current === "play",
      onMoveShouldSetPanResponder: () => phaseRef.current === "play",
      onPanResponderGrant: (evt) => {
        if (phaseRef.current !== "play") return;
        const { locationX, locationY } = evt.nativeEvent;
        lastTouchRef.current = { x: locationX, y: locationY };
        trailIdRef.current += 1;
        bladeTrailRef.current = [{ x: locationX, y: locationY, id: trailIdRef.current, life: 1 }];
        currentSwipeSlices.current = 0;
      },
      onPanResponderMove: (evt) => {
        if (phaseRef.current !== "play") return;
        const { locationX, locationY } = evt.nativeEvent;
        const current = { x: locationX, y: locationY };

        if (lastTouchRef.current) {
          checkSlice(lastTouchRef.current, current);
        }

        lastTouchRef.current = current;
        trailIdRef.current += 1;
        bladeTrailRef.current.push({
          x: locationX,
          y: locationY,
          id: trailIdRef.current,
          life: 1,
        });
        if (bladeTrailRef.current.length > 8) {
          bladeTrailRef.current.shift();
        }
      },
      onPanResponderRelease: () => {
        lastTouchRef.current = null;
        currentSwipeSlices.current = 0;
      },
    })
  ).current;

  // Bucle de físicas y render a 60 FPS
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Desvanecer estela
      bladeTrailRef.current.forEach((p) => {
        p.life -= 0.15;
      });
      bladeTrailRef.current = bladeTrailRef.current.filter((p) => p.life > 0);

      // Desvanecer partículas
      particlesRef.current.forEach((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.05;
      });
      particlesRef.current = particlesRef.current.filter((pt) => pt.life > 0);

      // Físicas de mitades cortadas
      halvesRef.current.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.vy += GRAVITY * 0.9;
        h.rot += h.vrot;
      });
      halvesRef.current = halvesRef.current.filter((h) => h.y < BOARD_HEIGHT + 60);

      if (phaseRef.current === "play") {
        // Generación de oleada
        if (now >= nextSpawnTimeRef.current && slicedCountRef.current < levelDef.targetSlices) {
          spawnWave(now);
        }

        // Físicas de ítems activos
        const remaining = [];
        itemsRef.current.forEach((it) => {
          if (it.sliced) return;

          it.x += it.vx;
          it.y += it.vy;
          it.vy += GRAVITY;
          it.rot += it.vrot;

          // Si cayó sin rebanar
          if (it.y > BOARD_HEIGHT + 35) {
            if (it.type === "food") {
              strikesRef.current += 1;
              setStrikes(strikesRef.current);
              if (strikesRef.current >= MAX_STRIKES) {
                triggerGameOver(false, "strikes");
              }
            }
            // Bomba caída no penaliza
          } else {
            remaining.push(it);
          }
        });
        itemsRef.current = remaining;
      }

      setRenderTick((t) => (t + 1) % 1000);
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, [visible, levelDef]);

  const handleFinish = () => {
    if (onFinish) {
      onFinish(score, slicedCount, level, won);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Encabezado */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Barista Ninja 🥷</Text>
              <Text style={styles.sub}>
                {survival ? "Survival 🔥 · ¡corta sin parar!" : `Nivel ${level} · Corta ${levelDef.targetSlices} productos`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Marcador Superior */}
          <View style={styles.hudRow}>
            <View style={styles.hudBadge}>
              <Text style={styles.hudLabel}>CORTES</Text>
              <Text style={styles.hudValue}>{slicedCount}{survival ? "" : ` / ${levelDef.targetSlices}`}</Text>
            </View>
            <View style={styles.hudBadge}>
              <Text style={styles.hudLabel}>PUNTOS</Text>
              <Text style={styles.hudValue}>{score}</Text>
            </View>
            <View style={styles.hudBadge}>
              <Text style={styles.hudLabel}>VIDAS</Text>
              <Text style={styles.hudValue}>
                {Array.from({ length: MAX_STRIKES }).map((_, idx) => (
                  <Text key={idx} style={{ opacity: idx < strikes ? 0.25 : 1.0 }}>☕</Text>
                ))}
              </Text>
            </View>
          </View>

          {/* Tablero de Juego */}
          <View style={styles.board} {...panResponder.panHandlers}>
            {/* Combo Popup */}
            {comboText && (
              <View pointerEvents="none" style={styles.comboBadge}>
                <Text style={styles.comboText}>{comboText}</Text>
              </View>
            )}

            {/* Estela de corte */}
            {bladeTrailRef.current.map((pt) => (
              <View
                key={pt.id}
                pointerEvents="none"
                style={[
                  styles.bladePoint,
                  {
                    left: pt.x - 3,
                    top: pt.y - 3,
                    opacity: pt.life,
                  },
                ]}
              />
            ))}

            {/* Partículas de salpicadura */}
            {particlesRef.current.map((pt) => (
              <View
                key={pt.id}
                pointerEvents="none"
                style={[
                  styles.particle,
                  {
                    left: pt.x - pt.size / 2,
                    top: pt.y - pt.size / 2,
                    width: pt.size,
                    height: pt.size,
                    borderRadius: pt.size / 2,
                    backgroundColor: pt.color,
                    opacity: pt.life,
                  },
                ]}
              />
            ))}

            {/* Mitades rebanadas */}
            {halvesRef.current.map((h) => (
              <View
                key={h.id}
                pointerEvents="none"
                style={[
                  styles.itemContainer,
                  {
                    left: h.x - 14,
                    top: h.y - 14,
                    transform: [{ rotate: `${h.rot}deg` }, { scale: h.scale }],
                  },
                ]}
              >
                <Text style={styles.itemEmoji}>{h.emoji}</Text>
              </View>
            ))}

            {/* Ítems activos volando */}
            {itemsRef.current.map((it) => (
              <View
                key={it.id}
                pointerEvents="none"
                style={[
                  styles.itemContainer,
                  {
                    left: it.x - ITEM_RADIUS,
                    top: it.y - ITEM_RADIUS,
                    transform: [{ rotate: `${it.rot}deg` }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.itemGlow,
                    it.special && styles.goldenGlow,
                    it.type === "bomb" && styles.bombGlow,
                  ]}
                >
                  <Text style={styles.itemEmoji}>{it.emoji}</Text>
                </View>
              </View>
            ))}

            {/* Mascota animando en la esquina */}
            <View pointerEvents="none" style={styles.petCorner}>
              <Text style={{ fontSize: 26 }}>{petEmoji}</Text>
              <Text style={styles.petCornerName}>{petName}</Text>
            </View>

            {/* Pantalla Final (Victoria / Derrota) */}
            {phase === "over" && (
              <View style={styles.overlay}>
                <Text style={{ fontSize: 50, marginBottom: 8 }}>
                  {won ? "🏆" : "💥"}
                </Text>
                <Text style={styles.overTitle}>
                  {survival ? `¡${slicedCount} cortes!` : won ? "¡NIVEL COMPLETADO!" : "¡FIN DEL JUEGO!"}
                </Text>
                <Text style={styles.overSub}>
                  {won
                    ? `¡Dominaste el corte barista! Rebanaste ${slicedCount} productos.`
                    : strikes >= MAX_STRIKES
                    ? `Se te cayeron demasiados cafés ☕${survival ? " -- ¡a superar tu marca!" : ""}`
                    : `¡Cortaste una bomba de vapor! 💣${survival ? " -- ¡a superar tu marca!" : ""}`}
                </Text>

                <View style={styles.scoreBox}>
                  <Text style={styles.scoreBoxLabel}>Puntuación final</Text>
                  <Text style={styles.scoreBoxVal}>{score} pts</Text>
                </View>

                <Pressable style={styles.actionBtn} onPress={handleFinish}>
                  <Text style={styles.actionBtnText}>
                    {survival ? "Salir" : won ? "Continuar ⭐" : "Volver al mapa"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
  },
  sub: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  closeText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#444",
  },

  hudRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  hudBadge: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  hudValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
    marginTop: 2,
  },

  board: {
    width: "100%",
    height: BOARD_HEIGHT,
    backgroundColor: "#161114",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },

  comboBadge: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    backgroundColor: "#FFB703",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    zIndex: 10,
  },
  comboText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
  },

  itemContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  itemGlow: {
    width: ITEM_RADIUS * 2,
    height: ITEM_RADIUS * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  goldenGlow: {
    borderRadius: ITEM_RADIUS,
    backgroundColor: "rgba(255,215,0,0.25)",
  },
  bombGlow: {
    borderRadius: ITEM_RADIUS,
    backgroundColor: "rgba(255,0,0,0.2)",
  },
  itemEmoji: {
    fontSize: 32,
  },

  bladePoint: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64D2FF",
    shadowColor: "#64D2FF",
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  particle: {
    position: "absolute",
  },

  petCorner: {
    position: "absolute",
    bottom: 8,
    left: 10,
    alignItems: "center",
    opacity: 0.85,
  },
  petCornerName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "800",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  overTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  overSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  scoreBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    marginBottom: 20,
  },
  scoreBoxLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scoreBoxVal: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
});
