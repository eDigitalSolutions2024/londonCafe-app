import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing, PanResponder } from "react-native";
import { colors } from "../theme/colors";
import AvatarPreview from "./AvatarPreview";
import PetActor from "./PetActor";

// --- Tablero estilo Pokémon Puzzle / Tetris Attack -------------------------
const COLS = 6;
const ROWS = 12;
const TILE = 38;
const CELL = TILE + 2;
const START_FILLED = 4;
const RISE_MS_START = 6500;
const RISE_MS_MIN = 2600;
const RISE_SPEEDUP_EVERY = 22000;
const TARGET_CLEARED = 60;
const SWAP_THRESHOLD = CELL * 0.42; // cuánto hay que arrastrar para intercambiar

const KINDS = ["☕", "🥐", "🍰", "🍪", "🫖", "🥯"];
const CLEARING = -2;

const rndKind = () => Math.floor(Math.random() * KINDS.length);
const emptyRow = () => new Array(COLS).fill(null);

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
      const v = ng[r][c];
      if (v != null && v !== CLEARING) {
        ng[r][c] = null;
        ng[write][c] = v;
        write--;
      } else if (v === CLEARING) {
        ng[r][c] = null;
      }
    }
  }
  return ng;
}

export default function PetMatch3({ visible, species = "cat", petName = "tu mascota", avatarConfig, onClose, onFinish }) {
  const [grid, setGrid] = useState(makeGrid);
  const [cleared, setCleared] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState("play");
  const [danger, setDanger] = useState(false);
  const [dragCell, setDragCell] = useState(null); // {r, c} celda agarrada (solo para marcar el render)

  const resolving = useRef(false);
  const resolvePending = useRef(false);
  const riseTimer = useRef(null);
  const speedTimer = useRef(null);
  const riseMs = useRef(RISE_MS_START);
  const overRef = useRef(false);
  const phaseRef = useRef("play");
  const gridRef = useRef(grid);
  gridRef.current = grid;
  phaseRef.current = phase;

  const riseAnim = useRef(new Animated.Value(0)).current;
  const comboAnim = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const [petReaction, setPetReaction] = useState({ type: null, id: 0 });

  // Arrastre: SOLO visual mientras se mueve; el swap se aplica al soltar.
  const dragX = useRef(new Animated.Value(0)).current; // ficha agarrada sigue el dedo
  const nbL = useRef(new Animated.Value(0)).current; // vecino izquierdo se desliza
  const nbR = useRef(new Animated.Value(0)).current; // vecino derecho se desliza
  const dragRef = useRef({ r: 0, c: 0, active: false, dx: 0 });

  useEffect(() => {
    if (!visible) return;
    const g0 = makeGrid();
    setGrid(g0);
    gridRef.current = g0;
    setCleared(0);
    setCombo(0);
    setPhase("play");
    phaseRef.current = "play";
    setDanger(false);
    setDragCell(null);
    resolving.current = false;
    resolvePending.current = false;
    overRef.current = false;
    riseMs.current = RISE_MS_START;
    dragX.setValue(0);
    nbL.setValue(0);
    nbR.setValue(0);

    scheduleRise();
    speedTimer.current = setInterval(() => {
      riseMs.current = Math.max(RISE_MS_MIN, riseMs.current - 400);
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
    if (resolving.current || dragRef.current.active) {
      scheduleRise();
      return;
    }
    const ended = doRise();
    if (!ended) scheduleRise();
  }

  function doRise() {
    if (overRef.current) return true;
    const g = gridRef.current;
    if (g[0].some((x) => x != null && x !== CLEARING)) {
      endGame();
      return true;
    }
    const ng = g.slice(1).map((row) => row.slice());
    ng.push(newBottomRow());
    setGrid(ng);
    gridRef.current = ng;

    riseAnim.setValue(CELL);
    Animated.timing(riseAnim, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    setDanger(ng[1].some((x) => x != null) || ng[0].some((x) => x != null));
    if (findMatches(ng).size > 0) runResolve(0);
    return false;
  }

  // Re-entrante: si ya está corriendo, marca pendiente y sale. Lee gridRef
  // fresco en cada iteración, así ve swaps hechos entre pasos.
  async function runResolve(baseCombo) {
    if (resolving.current) {
      resolvePending.current = true;
      return;
    }
    resolving.current = true;
    let chain = baseCombo || 0;
    let total = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const g = gridRef.current;
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

      if (chain >= 2) {
        setCombo(chain);
        popCombo();
      }
      setPetReaction((x) => ({ type: chain >= 3 ? "play" : "eat", id: x.id + 1 }));
      bounceAvatar();

      await wait(170);
      const g2 = applyGravity(gridRef.current);
      setGrid(g2);
      gridRef.current = g2;
      await wait(140);
    }

    if (total > 0) setCleared((x) => x + total);
    setDanger(gridRef.current[1].some((x) => x != null) || gridRef.current[0].some((x) => x != null));
    resolving.current = false;

    if (resolvePending.current && !overRef.current) {
      resolvePending.current = false;
      runResolve(0);
    }
  }

  // --- Gestos ---
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        phaseRef.current === "play" && !resolving.current && !overRef.current,
      onMoveShouldSetPanResponder: (_e, gs) =>
        phaseRef.current === "play" && !resolving.current && !overRef.current && Math.abs(gs.dx) > 4,
      onPanResponderGrant: (e) => {
        if (resolving.current || overRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        const c = Math.floor(locationX / CELL);
        const r = Math.floor(locationY / CELL);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
        const k = gridRef.current[r][c];
        if (k == null || k === CLEARING) return;
        dragRef.current = { r, c, active: true, dx: 0 };
        dragX.setValue(0);
        nbL.setValue(0);
        nbR.setValue(0);
        setDragCell({ r, c });
      },
      onPanResponderMove: (_e, gs) => {
        const d = dragRef.current;
        if (!d.active) return;
        if (resolving.current || overRef.current) return;
        let dx = Math.max(-CELL, Math.min(CELL, gs.dx));
        // no dejes arrastrar fuera del tablero
        if (d.c === 0 && dx < 0) dx = 0;
        if (d.c === COLS - 1 && dx > 0) dx = 0;
        d.dx = dx;
        dragX.setValue(dx);
        nbR.setValue(dx > 0 ? -dx : 0); // vecino derecho se corre a la izq
        nbL.setValue(dx < 0 ? -dx : 0); // vecino izquierdo se corre a la der
      },
      onPanResponderRelease: () => finishDrag(),
      onPanResponderTerminate: () => finishDrag(),
    })
  ).current;

  function finishDrag() {
    const d = dragRef.current;
    dragRef.current = { ...d, active: false };
    setDragCell(null);

    const doSnap = () => {
      Animated.parallel([
        Animated.spring(dragX, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbL, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbR, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
      ]).start();
    };

    if (resolving.current || overRef.current) {
      doSnap();
      return;
    }
    const dir = d.dx > SWAP_THRESHOLD ? 1 : d.dx < -SWAP_THRESHOLD ? -1 : 0;
    const tc = d.c + dir;
    if (dir !== 0 && tc >= 0 && tc < COLS) {
      const g = gridRef.current.map((row) => row.slice());
      const t = g[d.r][d.c];
      g[d.r][d.c] = g[d.r][tc];
      g[d.r][tc] = t;
      setGrid(g);
      gridRef.current = g;
      // reset instantáneo de los offsets (el grid ya refleja el swap)
      dragX.setValue(0);
      nbL.setValue(0);
      nbR.setValue(0);
      if (findMatches(g).size > 0) runResolve(0);
    } else {
      doSnap();
    }
  }

  function endGame() {
    if (overRef.current) return;
    overRef.current = true;
    setPhase("over");
    phaseRef.current = "over";
    clearTimeout(riseTimer.current);
    clearInterval(speedTimer.current);
  }

  function popCombo() {
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
              <Text style={styles.hdrSub}>Arrastra una ficha de lado para acomodarla · junta 3 o más</Text>

              <View style={styles.stageRow}>
                <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                  <View style={styles.sideChar}>
                    <AvatarPreview config={avatarConfig} size={44} />
                    <Text style={styles.sideCap}>Tú</Text>
                  </View>
                </Animated.View>

                <View style={[styles.boardWrap, danger && styles.boardDanger]}>
                  <View style={styles.boardClip}>
                    <Animated.View style={{ transform: [{ translateY: riseAnim }] }} {...pan.panHandlers}>
                      {grid.map((row, r) => (
                        <View key={r} style={styles.row}>
                          {row.map((k, c) => {
                            const empty = k == null;
                            const clearing = k === CLEARING;
                            const isDrag = dragCell && dragCell.r === r && dragCell.c === c;
                            const isNbL = dragCell && dragCell.r === r && c === dragCell.c - 1;
                            const isNbR = dragCell && dragCell.r === r && c === dragCell.c + 1;
                            let extra = null;
                            if (isDrag) extra = { transform: [{ translateX: dragX }, { scale: 1.08 }], zIndex: 20 };
                            else if (isNbL) extra = { transform: [{ translateX: nbL }] };
                            else if (isNbR) extra = { transform: [{ translateX: nbR }] };
                            return (
                              <Animated.View
                                key={`${r}-${c}`}
                                style={[
                                  styles.cell,
                                  empty && styles.cellEmpty,
                                  clearing && styles.cellClearing,
                                  isDrag && styles.cellDrag,
                                  extra,
                                ]}
                              >
                                <Text style={styles.tile}>{empty ? "" : clearing ? "✨" : KINDS[k]}</Text>
                              </Animated.View>
                            );
                          })}
                        </View>
                      ))}
                    </Animated.View>
                  </View>

                  <Animated.Text
                    pointerEvents="none"
                    style={[styles.combo, { opacity: comboAnim, transform: [{ scale: comboScale }] }]}
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

  boardWrap: { backgroundColor: "#f3e6d3", borderRadius: 12, borderWidth: 2, borderColor: colors.primarySoft, padding: 3 },
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
  cellClearing: { backgroundColor: "#fff6df" },
  cellDrag: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: "#fff3e0",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
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
