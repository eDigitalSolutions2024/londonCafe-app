import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing, PanResponder } from "react-native";
import { colors } from "../theme/colors";
import AvatarPreview from "./AvatarPreview";
import PetActor from "./PetActor";

// --- Tablero estilo Pokémon Puzzle / Tetris Attack -------------------------
const COLS = 6;
const ROWS = 12;
const TILE_NORMAL = 38;
const TILE_COMPACT = 24; // modo "ver todo el tablero" -- las 12 filas caben en pantalla
const START_FILLED = 4;
const RISE_MS_START = 6500;
const RISE_MS_MIN = 2600;
const RISE_SPEEDUP_EVERY = 22000;
const TARGET_CLEARED = 60;
const SWAP_FRACTION = 0.42; // fracción de una celda que hay que arrastrar para intercambiar

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
  const [compact, setCompact] = useState(false); // "ver tablero completo" -- fichas más chicas, se ven las 12 filas

  const tileSize = compact ? TILE_COMPACT : TILE_NORMAL;
  const cellSize = tileSize + 2;
  // Los PanResponder de abajo se crean UNA sola vez (useRef) y sus
  // closures no ven el `cellSize` de renders posteriores -- por eso la
  // lógica de gestos lee siempre este ref, no la constante/local de arriba.
  const cellRef = useRef(cellSize);
  cellRef.current = cellSize;

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
  const comboSpin = useRef(new Animated.Value(0)).current;
  const [comboBurst, setComboBurst] = useState([]); // chispas que salen disparadas del "¡Combo!"
  const comboPid = useRef(0);
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const [petReaction, setPetReaction] = useState({ type: null, id: 0 });

  // Arrastre: SOLO visual mientras se mueve; el swap se aplica al soltar.
  const dragX = useRef(new Animated.Value(0)).current; // ficha agarrada sigue el dedo
  const nbL = useRef(new Animated.Value(0)).current; // vecino izquierdo se desliza
  const nbR = useRef(new Animated.Value(0)).current; // vecino derecho se desliza
  const dragRef = useRef({ r: 0, c: 0, active: false, dx: 0 });
  // Un ref por FILA -- así la fila que agarraste nunca se calcula por
  // matemática de coordenadas (que fallaba con offsets verticales según
  // el dispositivo/notch). El sistema táctil de RN ya sabe, de forma
  // nativa, qué fila tocaste con solo repartir el responder por fila; acá
  // solo queda resolver la COLUMNA, midiendo esa fila en el eje X.
  const rowRefs = useRef(
    Array.from({ length: ROWS }, () => React.createRef())
  ).current;

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

    riseAnim.setValue(cellRef.current);
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
        popCombo(chain);
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
  // Antes había UN solo PanResponder en todo el tablero, y la fila se
  // calculaba con (toqueY - origenTableroY) / CELL. Ese cálculo dependía
  // de que measureInWindow() del tablero completo coincidiera EXACTO con
  // el sistema de coordenadas del toque -- en iOS eso quedaba desfasado
  // (había que tocar más arriba de la ficha real para agarrarla) y
  // ocasionalmente no agarraba nada.
  //
  // Ahora hay un PanResponder POR FILA. La fila ya no se calcula: el
  // propio sistema táctil de RN decide, por dónde tocaste, cuál fila
  // recibe el gesto -- cero matemática, cero desfase vertical posible.
  // Solo queda resolver la COLUMNA, y para eso basta medir esa fila en el
  // eje X (measureInWindow no se ve afectado por el transform vertical
  // de riseAnim, así que tampoco hace falta esperar a que termine de
  // animar para que la medición sea confiable).
  const rowPans = useRef(
    Array.from({ length: ROWS }, (_, r) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          phaseRef.current === "play" && !resolving.current && !overRef.current,
        onMoveShouldSetPanResponder: (_e, gs) =>
          phaseRef.current === "play" && !resolving.current && !overRef.current && Math.abs(gs.dx) > 4,
        onPanResponderGrant: (e) => {
          if (resolving.current || overRef.current) return;
          const { pageX } = e.nativeEvent;
          rowRefs[r].current?.measureInWindow((bx) => {
            if (overRef.current || resolving.current) return;
            const c = Math.floor((pageX - bx) / cellRef.current);
            if (c < 0 || c >= COLS) return;
            const k = gridRef.current[r][c];
            if (k == null || k === CLEARING) return;
            dragRef.current = { r, c, active: true, dx: 0 };
            dragX.setValue(0);
            nbL.setValue(0);
            nbR.setValue(0);
            setDragCell({ r, c });
          });
        },
        onPanResponderMove: (_e, gs) => {
          const d = dragRef.current;
          if (!d.active || d.r !== r) return;
          if (resolving.current || overRef.current) return;
          const cell = cellRef.current;
          let dx = Math.max(-cell, Math.min(cell, gs.dx));
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
    )
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
    const swapThreshold = cellRef.current * SWAP_FRACTION;
    const dir = d.dx > swapThreshold ? 1 : d.dx < -swapThreshold ? -1 : 0;
    const tc = d.c + dir;
    if (dir === 0 || tc < 0 || tc >= COLS) {
      doSnap();
      return;
    }

    const g = gridRef.current.map((row) => row.slice());
    const sourceVal = g[d.r][d.c];
    const targetVal = g[d.r][tc];

    if (targetVal == null) {
      // El destino está vacío -- no es un intercambio entre dos fichas,
      // es "mover la ficha ahí". Debe CAER por gravedad hasta apoyarse en
      // lo que haya debajo en esa columna (si no hay nada, llega al fondo).
      // Siempre se confirma: no hay "a dónde regresar" que tenga más
      // sentido que dejarla caer.
      g[d.r][d.c] = null;
      g[d.r][tc] = sourceVal;
      const settled = applyGravity(g);
      setGrid(settled);
      gridRef.current = settled;
      dragX.setValue(0);
      nbL.setValue(0);
      nbR.setValue(0);
      if (findMatches(settled).size > 0) runResolve(0);
      return;
    }

    // Intercambio normal entre dos fichas. Si no arma ninguna combinación,
    // no tiene "dónde acomodarse" -- vuelve a su lugar en vez de quedarse.
    g[d.r][d.c] = targetVal;
    g[d.r][tc] = sourceVal;
    if (findMatches(g).size > 0) {
      setGrid(g);
      gridRef.current = g;
      dragX.setValue(0);
      nbL.setValue(0);
      nbR.setValue(0);
      runResolve(0);
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

  // Combo "deslumbrante": punch con rebote (overshoot), un pequeño giro de
  // celebración, y chispas ✨🎉 que salen disparadas en todas direcciones.
  // Entre más grande el combo, más chispas y más dura el brillo.
  function popCombo(chain) {
    comboAnim.setValue(0);
    comboSpin.setValue(0);
    Animated.sequence([
      Animated.spring(comboAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.delay(420 + Math.min(chain, 5) * 60),
      Animated.timing(comboAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(comboSpin, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(comboSpin, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();

    const glyphs = chain >= 4 ? ["🎉", "✨", "⭐"] : ["✨", "⭐"];
    const count = Math.min(4 + chain, 10);
    const born = [];
    for (let i = 0; i < count; i++) {
      const id = ++comboPid.current;
      const v = new Animated.Value(0);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 34 + Math.random() * 22 + chain * 3;
      born.push({
        id,
        v,
        glyph: glyphs[i % glyphs.length],
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
      });
      Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        setComboBurst((cur) => cur.filter((p) => p.id !== id));
      });
    }
    setComboBurst((cur) => [...cur, ...born]);
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
  const comboScale = comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.22] });
  const comboRot = comboSpin.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "6deg"] });
  const comboColor = combo >= 4 ? "#e0a800" : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>Café Tetris 🧱</Text>
                <View style={styles.hdrRight}>
                  <Text style={[styles.hdrMeta, danger && styles.hdrDanger]}>
                    {danger ? "¡Peligro!" : `${cleared} fichas`}
                  </Text>
                  <Pressable
                    onPress={() => setCompact((v) => !v)}
                    style={styles.zoomBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.zoomBtnText}>{compact ? "🔍" : "🔎"}</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.hdrSub}>
                Arrastra una ficha de lado para acomodarla · junta 3 o más
                {compact ? "" : " · 🔎 para ver todo el tablero"}
              </Text>

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
                        <View key={r} ref={rowRefs[r]} collapsable={false} style={styles.row} {...rowPans[r].panHandlers}>
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
                                  { width: tileSize, height: tileSize },
                                  empty && styles.cellEmpty,
                                  clearing && styles.cellClearing,
                                  isDrag && styles.cellDrag,
                                  extra,
                                ]}
                              >
                                <Text style={[styles.tile, { fontSize: tileSize * 0.63 }]}>
                                  {empty ? "" : clearing ? "✨" : KINDS[k]}
                                </Text>
                              </Animated.View>
                            );
                          })}
                        </View>
                      ))}
                    </Animated.View>
                  </View>

                  <View pointerEvents="none" style={styles.comboWrap}>
                    <Animated.View style={[styles.comboHalo, { opacity: comboAnim, transform: [{ scale: comboScale }] }]} />
                    <Animated.Text
                      style={[
                        styles.combo,
                        { color: comboColor, opacity: comboAnim, transform: [{ scale: comboScale }, { rotate: comboRot }] },
                      ]}
                    >
                      ¡Combo x{combo}! {combo >= 4 ? "🔥" : ""}
                    </Animated.Text>
                    {comboBurst.map((p) => {
                      const tx = p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
                      const ty = p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
                      const op = p.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
                      const sc = p.v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.7] });
                      return (
                        <Animated.Text
                          key={p.id}
                          style={[
                            styles.comboSpark,
                            { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] },
                          ]}
                        >
                          {p.glyph}
                        </Animated.Text>
                      );
                    })}
                  </View>
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
  hdrRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  hdrMeta: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  hdrDanger: { color: "#d9534f" },
  zoomBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: { fontSize: 13 },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 2, marginBottom: 8 },

  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  sideChar: { width: 46, alignItems: "center", justifyContent: "flex-end" },
  sideCap: { marginTop: 2, color: colors.textMuted, fontSize: 9, fontWeight: "800" },

  boardWrap: { backgroundColor: "#f3e6d3", borderRadius: 12, borderWidth: 2, borderColor: colors.primarySoft, padding: 3 },
  boardDanger: { borderColor: "#d9534f" },
  boardClip: { overflow: "hidden", borderRadius: 8 },
  row: { flexDirection: "row" },
  cell: {
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

  comboWrap: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  comboHalo: {
    position: "absolute",
    width: 130,
    height: 60,
    borderRadius: 999,
    backgroundColor: "#ffe9b0",
  },
  combo: {
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "#fff",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  comboSpark: {
    position: "absolute",
    fontSize: 18,
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
