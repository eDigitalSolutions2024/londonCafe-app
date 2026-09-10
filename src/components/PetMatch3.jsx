import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";
import AvatarPreview from "./AvatarPreview";
import PetActor from "./PetActor";

// --- Tablero estilo Pokémon Puzzle / Tetris Attack -------------------------
const COLS = 6;
const ROWS = 11; // filas visibles (torre)
const TILE = 40;
const START_FILLED = 5; // filas llenas al empezar (desde abajo)
const RISE_MS_START = 4200; // cada cuánto sube una fila nueva
const RISE_MS_MIN = 1900;
const RISE_SPEEDUP_EVERY = 18000; // -300ms cada 18s
const TARGET_CLEARED = 70; // fichas para score 1.0

const KINDS = ["☕", "🥐", "🍰", "🍪", "🫖", "🥯"];
const CLEARING = -2; // marca temporal de ficha explotando

const rndKind = () => Math.floor(Math.random() * KINDS.length);

function emptyRow() {
  return new Array(COLS).fill(null);
}

function newBottomRow() {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    let k;
    do {
      k = rndKind();
    } while (c >= 2 && row[c - 1] === k && row[c - 2] === k);
    row.push(k);
  }
  return row;
}

function makeGrid() {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(emptyRow());
  for (let r = ROWS - START_FILLED; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let k;
      do {
        k = rndKind();
      } while (
        (c >= 2 && g[r][c - 1] === k && g[r][c - 2] === k) ||
        (r >= ROWS - START_FILLED + 2 && g[r - 1][c] === k && g[r - 2][c] === k)
      );
      g[r][c] = k;
    }
  }
  return g;
}

function findMatches(g) {
  const hit = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = g[r][c];
      if (k == null || k === CLEARING) continue;
      if (c + 2 < COLS && g[r][c + 1] === k && g[r][c + 2] === k) {
        let cc = c;
        while (cc < COLS && g[r][cc] === k) hit.add(`${r},${cc++}`);
      }
      if (r + 2 < ROWS && g[r + 1][c] === k && g[r + 2][c] === k) {
        let rr = r;
        while (rr < ROWS && g[rr][c] === k) hit.add(`${rr++},${c}`);
      }
    }
  }
  return hit;
}

function applyGravity(g) {
  const ng = g.map((row) => row.slice());
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (ng[r][c] != null && ng[r][c] !== CLEARING) {
        const v = ng[r][c];
        ng[r][c] = null;
        ng[write][c] = v;
        write--;
      } else if (ng[r][c] === CLEARING) {
        ng[r][c] = null;
      }
    }
  }
  return ng;
}

function areHAdjacent(a, b) {
  return a.r === b.r && Math.abs(a.c - b.c) === 1;
}

export default function PetMatch3({ visible, species = "cat", petName = "tu mascota", avatarConfig, onClose, onFinish }) {
  const [grid, setGrid] = useState(makeGrid);
  const [sel, setSel] = useState(null);
  const [cleared, setCleared] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState("play"); // play | over
  const [danger, setDanger] = useState(false);

  const resolving = useRef(false);
  const risePending = useRef(false);
  const riseTimer = useRef(null);
  const speedTimer = useRef(null);
  const riseMs = useRef(RISE_MS_START);
  const overRef = useRef(false);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const riseAnim = useRef(new Animated.Value(0)).current;
  const comboAnim = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const [petReaction, setPetReaction] = useState({ type: null, id: 0 });

  // --- ciclo de vida ---
  useEffect(() => {
    if (!visible) return;
    const g0 = makeGrid();
    setGrid(g0);
    gridRef.current = g0;
    setSel(null);
    setCleared(0);
    setCombo(0);
    setPhase("play");
    setDanger(false);
    resolving.current = false;
    risePending.current = false;
    overRef.current = false;
    riseMs.current = RISE_MS_START;

    scheduleRise();
    speedTimer.current = setInterval(() => {
      riseMs.current = Math.max(RISE_MS_MIN, riseMs.current - 300);
    }, RISE_SPEEDUP_EVERY);

    return () => {
      clearTimeout(riseTimer.current);
      clearInterval(speedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function scheduleRise() {
    clearTimeout(riseTimer.current);
    riseTimer.current = setTimeout(onRiseTick, riseMs.current);
  }

  function onRiseTick() {
    if (overRef.current) return;
    if (resolving.current) {
      risePending.current = true;
      scheduleRise();
      return;
    }
    const ended = doRise();
    if (!ended) scheduleRise();
  }

  function doRise() {
    if (overRef.current) return true;
    const g = gridRef.current;
    const toppedOut = g[0].some((x) => x != null && x !== CLEARING);
    if (toppedOut) {
      endGame();
      return true;
    }
    const ng = g.slice(1).map((row) => row.slice());
    ng.push(newBottomRow());
    setGrid(ng);
    gridRef.current = ng;
    setSel(null);

    // desliza visualmente hacia arriba
    riseAnim.setValue(TILE);
    Animated.timing(riseAnim, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    setDanger(ng[1].some((x) => x != null) || ng[0].some((x) => x != null));

    // ¿la nueva fila creó matches?
    if (findMatches(ng).size > 0) resolve(ng, 0);
    return false;
  }

  async function resolve(startGrid, baseCombo) {
    resolving.current = true;
    let g = startGrid;
    let chain = baseCombo || 0;
    let total = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const m = findMatches(g);
      if (m.size === 0) break;
      chain += 1;
      total += m.size;

      const marking = g.map((row) => row.slice());
      m.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        marking[r][c] = CLEARING;
      });
      setGrid(marking);
      gridRef.current = marking;

      if (chain >= 2) popCombo(chain);
      setPetReaction((x) => ({ type: chain >= 3 ? "play" : "eat", id: x.id + 1 }));
      bounceAvatar();

      await wait(170);
      g = applyGravity(marking);
      setGrid(g);
      gridRef.current = g;
      await wait(140);
    }

    if (total > 0) {
      setCleared((x) => x + total);
      setCombo(chain);
    }
    setDanger(g[1].some((x) => x != null) || g[0].some((x) => x != null));
    resolving.current = false;

    if (risePending.current && !overRef.current) {
      risePending.current = false;
      doRise();
    }
  }

  const onTapCell = async (r, c) => {
    if (phase !== "play" || resolving.current) return;
    const k = gridRef.current[r][c];
    if (k == null || k === CLEARING) {
      setSel(null);
      return;
    }
    if (!sel) {
      setSel({ r, c });
      return;
    }
    if (sel.r === r && sel.c === c) {
      setSel(null);
      return;
    }
    if (!areHAdjacent(sel, { r, c })) {
      setSel({ r, c });
      return;
    }
    // swap libre (estilo Panel de Pon): siempre intercambia
    const g = gridRef.current.map((row) => row.slice());
    const tmp = g[sel.r][sel.c];
    g[sel.r][sel.c] = g[r][c];
    g[r][c] = tmp;
    setSel(null);
    setGrid(g);
    gridRef.current = g;

    if (findMatches(g).size > 0) {
      await resolve(g, 0);
    }
  };

  function endGame() {
    if (overRef.current) return;
    overRef.current = true;
    setPhase("over");
    clearTimeout(riseTimer.current);
    clearInterval(speedTimer.current);
  }

  function popCombo(n) {
    comboAnim.setValue(0);
    Animated.sequence([
      Animated.timing(comboAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(comboAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }
  function bounceAvatar() {
    avatarBounce.setValue(0);
    Animated.sequence([
      Animated.timing(avatarBounce, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.spring(avatarBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]).start();
  }
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  const score = Math.max(0, Math.min(1, cleared / TARGET_CLEARED));
  const finish = () => onFinish?.(score, cleared);

  const avatarScale = avatarBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const comboScale = comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const comboOpacity = comboAnim;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>Café Tetris 🧱</Text>
                <Text style={[styles.hdrMeta, danger && styles.hdrDanger]}>
                  {danger ? "¡Peligro!" : `${cleared} fichas`}
                </Text>
              </View>
              <Text style={styles.hdrSub}>Intercambia fichas de lado · junta 3 o más</Text>

              <View style={styles.stageRow}>
                <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                  <View style={styles.sideChar}>
                    <AvatarPreview config={avatarConfig} size={44} />
                    <Text style={styles.sideCap}>Tú</Text>
                  </View>
                </Animated.View>

                <View style={[styles.boardWrap, danger && styles.boardDanger]}>
                  <View style={styles.boardClip}>
                    <Animated.View style={{ transform: [{ translateY: riseAnim }] }}>
                      {grid.map((row, r) => (
                        <View key={r} style={styles.row}>
                          {row.map((k, c) => {
                            const isSel = sel && sel.r === r && sel.c === c;
                            const empty = k == null;
                            const clearing = k === CLEARING;
                            return (
                              <Pressable
                                key={`${r}-${c}`}
                                onPress={() => onTapCell(r, c)}
                                style={[
                                  styles.cell,
                                  empty && styles.cellEmpty,
                                  isSel && styles.cellSel,
                                  clearing && styles.cellClearing,
                                ]}
                              >
                                <Text style={styles.tile}>{empty ? "" : clearing ? "✨" : KINDS[k]}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))}
                    </Animated.View>
                  </View>

                  <Animated.Text
                    pointerEvents="none"
                    style={[styles.combo, { opacity: comboOpacity, transform: [{ scale: comboScale }] }]}
                  >
                    ¡Combo x{combo}!
                  </Animated.Text>
                </View>

                <View style={styles.sideChar}>
                  <PetActor species={species} mood="happy" size={44} reaction={petReaction} />
                  <Text style={styles.sideCap} numberOfLines={1}>{petName}</Text>
                </View>
              </View>

              <Pressable style={styles.endBtn} onPress={endGame}>
                <Text style={styles.endBtnText}>Terminar</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>{score >= 0.75 ? "🎉" : score >= 0.4 ? "😸" : "🙂"}</Text>
              <Text style={styles.doneTitle}>{cleared} fichas</Text>
              <Text style={styles.doneSub}>
                {score >= 0.75 ? `¡${petName} está feliz!` : score >= 0.4 ? `A ${petName} le gustó` : `${petName} quiere otra`}
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 12 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 22, padding: 14 },

  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hdrTitle: { color: "#111", fontSize: 17, fontWeight: "900" },
  hdrMeta: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  hdrDanger: { color: "#d9534f" },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 2, marginBottom: 8 },

  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  sideChar: { width: 46, alignItems: "center", justifyContent: "flex-end" },
  sideCap: { marginTop: 2, color: colors.textMuted, fontSize: 9, fontWeight: "800" },

  boardWrap: {
    backgroundColor: "#f3e6d3",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    padding: 3,
  },
  boardDanger: { borderColor: "#d9534f" },
  boardClip: { overflow: "hidden", borderRadius: 8 },
  row: { flexDirection: "row" },
  cell: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    margin: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(122,30,58,0.08)",
  },
  cellEmpty: { backgroundColor: "transparent", borderColor: "transparent" },
  cellSel: { backgroundColor: colors.accent, borderColor: colors.primary, borderWidth: 2 },
  cellClearing: { backgroundColor: "#fff6df" },
  tile: { fontSize: 24 },

  combo: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
    textShadowColor: "#fff",
    textShadowRadius: 6,
  },

  endBtn: { alignSelf: "center", marginTop: 12, paddingVertical: 10, paddingHorizontal: 26, borderRadius: 999, borderWidth: 1.5, borderColor: colors.primarySoft },
  endBtnText: { color: colors.primary, fontWeight: "900", fontSize: 13 },

  doneWrap: { alignItems: "center", paddingVertical: 20 },
  doneEmoji: { fontSize: 54 },
  doneTitle: { color: "#111", fontSize: 22, fontWeight: "900", marginTop: 6 },
  doneSub: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginTop: 4 },
  doneBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 44 },
  doneBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
