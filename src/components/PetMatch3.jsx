import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing, PanResponder } from "react-native";
import { colors } from "../theme/colors";
import AvatarPreview from "./AvatarPreview";
import PetActor from "./PetActor";
import { getMatch3Level, MAX_MATCH3_LEVEL } from "../assets/matchLevels";

// --- Tablero estilo Pokémon Puzzle / Tetris Attack -------------------------
const COLS = 6;
const ROWS = 12;
const TILE_NORMAL = 38;
const TILE_COMPACT = 24; // modo "ver todo el tablero" -- las 12 filas caben en pantalla
const SWAP_FRACTION = 0.42; // fracción de una celda que hay que arrastrar para intercambiar

const KINDS = ["☕", "🥐", "🍰", "🍪", "🫖", "🥯"];
const CLEARING = -2;

// Survival: sin niveles -- un solo cronómetro que nunca deja de correr
// (cada combinación devuelve un poco de tiempo) y una dificultad que sube
// SOLA con el puntaje: arranca con solo 3 sabores en juego (fácil armar
// combinaciones) y va agregando sabores hasta los 6 completos de KINDS
// mientras más fichas juntas -- ver kindsRef en el componente. `moves` e
// `Infinity` para no limitar movimientos -- la única forma de perder es
// que el cronómetro llegue a 0.
const SURVIVAL_START_SECONDS = 40;
const SURVIVAL_START_KINDS = 3;
const SURVIVAL_LEVEL_DEF = { kinds: SURVIVAL_START_KINDS, moves: Infinity, timeLimit: SURVIVAL_START_SECONDS, target: Infinity };

const rndKind = (kindsCount) => Math.floor(Math.random() * kindsCount);
const emptyRow = () => new Array(COLS).fill(null);

// Tablero LLENO desde el inicio (a diferencia del modo libre viejo, que
// arrancaba solo con las últimas filas llenas y el resto subía con el
// tiempo) -- acá es "por niveles": una meta fija de fichas con un número
// fijo de movimientos, estilo Candy Crush. `kindsCount` recorta cuántos
// sabores de KINDS están en juego (ver matchLevels.js).
function makeFullGrid(kindsCount) {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(emptyRow());
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let k;
      do {
        k = rndKind(kindsCount);
      } while (
        (c >= 2 && g[r][c - 1] === k && g[r][c - 2] === k) ||
        (r >= 2 && g[r - 1][c] === k && g[r - 2][c] === k)
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

// Tras la gravedad, los huecos que quedan siempre están arriba de cada
// columna (la gravedad ya compactó lo demás hacia abajo) -- se rellenan
// con fichas nuevas, como las candys que "caen" desde arriba en cualquier
// match-3.
//
// v2: antes se rellenaba con rndKind() puro, sin evitar que la ficha
// nueva quedara pegada a dos iguales (izquierda o arriba) -- con solo
// 4-6 sabores en juego, eso arma una combinación "gratis" por pura
// suerte casi en cada jugada, y el loop de runResolve la contaba como
// CASCADA del mismo combo (de ahí "apenas haces una combinación y todo
// lo que cae se hace combo"). Ahora, igual que makeFullGrid, se evita a
// propósito que la ficha nueva complete un 3-en-línea con lo que ya
// quedó asentado -- las cascadas de verdad siguen pasando (cuando el
// swap del jugador hace caer fichas EXISTENTES a una alineación nueva
// por gravedad), pero ya no se regalan solas desde el relleno aleatorio.
function refillTop(g, kindsCount) {
  const ng = g.map((row) => row.slice());
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (ng[r][c] != null) break; // ya no hay más huecos en esta columna
      let k;
      let tries = 0;
      do {
        k = rndKind(kindsCount);
        tries++;
      } while (
        tries < 12 &&
        ((c >= 2 && ng[r][c - 1] === k && ng[r][c - 2] === k) ||
          (r >= 2 && ng[r - 1][c] === k && ng[r - 2][c] === k))
      );
      ng[r][c] = k;
    }
  }
  return ng;
}

// ¿Hay al menos UN movimiento posible (horizontal o vertical, con una
// celda vecina) que arme una combinación? Si no, el tablero está
// "trabado" y hay que rebarajarlo.
function hasAnyMove(g) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      if (v == null || v === CLEARING) continue;
      if (c + 1 < COLS && tryTestSwap(g, r, c, r, c + 1)) return true;
      if (r + 1 < ROWS && tryTestSwap(g, r, c, r + 1, c)) return true;
    }
  }
  return false;
}

function tryTestSwap(g, r1, c1, r2, c2) {
  const a = g[r1][c1];
  const b = g[r2][c2];
  if (b === CLEARING) return false;
  const g2 = g.map((row) => row.slice());
  g2[r1][c1] = b;
  g2[r2][c2] = a;
  const settled = b == null ? applyGravity(g2) : g2;
  return findMatches(settled).size > 0;
}

// Reparte de nuevo los sabores existentes en las mismas posiciones hasta
// encontrar un reparto que SÍ tenga un movimiento posible y no regale un
// match gratis de una vez.
function reshuffleBoard(g) {
  const positions = [];
  const values = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      if (v != null && v !== CLEARING) {
        positions.push([r, c]);
        values.push(v);
      }
    }
  }
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const ng = g.map((row) => row.slice());
    positions.forEach(([r, c], idx) => {
      ng[r][c] = values[idx];
    });
    best = ng;
    if (findMatches(ng).size === 0 && hasAnyMove(ng)) return ng;
  }
  return best || g; // tras 40 intentos, lo que haya salido (rarísimo llegar aquí)
}

export default function PetMatch3({ visible, level = 1, survival = false, species = "cat", petName = "tu mascota", avatarConfig, onClose, onFinish }) {
  const levelDef = survival ? SURVIVAL_LEVEL_DEF : getMatch3Level(level);

  // Dificultad dinámica de Survival: cuántos sabores (de KINDS) están en
  // juego AHORA MISMO -- sube según clearedRef.current, ver runResolve.
  // En modo por niveles se queda fija en levelDef.kinds toda la partida.
  const kindsRef = useRef(levelDef.kinds);

  const [grid, setGrid] = useState(() => makeFullGrid(kindsRef.current));
  const [cleared, setCleared] = useState(0);
  const [movesLeft, setMovesLeft] = useState(levelDef.moves);
  const [combo, setCombo] = useState(0);
  const [comboSize, setComboSize] = useState(0); // fichas juntadas en ESE golpe (no el chain)
  const [phase, setPhase] = useState("play");
  const [won, setWon] = useState(false);
  const [loseReason, setLoseReason] = useState("moves"); // "moves" | "time"
  const [timeLeft, setTimeLeft] = useState(levelDef.timeLimit);
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
  const overRef = useRef(false);
  const phaseRef = useRef("play");
  const gridRef = useRef(grid);
  // Fuente de verdad SÍNCRONA de cleared/movesLeft -- setCleared/setMovesLeft
  // son async (batched), y runResolve necesita el valor real YA actualizado
  // dentro de la MISMA llamada async (después de un await) para decidir si
  // el nivel se ganó o se perdió, no el valor que tenía el closure al
  // arrancar la función.
  const clearedRef = useRef(0);
  const movesLeftRef = useRef(levelDef.moves);
  const timeLeftRef = useRef(levelDef.timeLimit);
  gridRef.current = grid;
  phaseRef.current = phase;

  const comboAnim = useRef(new Animated.Value(0)).current;
  const comboSpin = useRef(new Animated.Value(0)).current;
  const [comboBurst, setComboBurst] = useState([]); // chispas que salen disparadas del "¡Combo!"
  const comboPid = useRef(0);
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const [petReaction, setPetReaction] = useState({ type: null, id: 0 });

  // Arrastre: SOLO visual mientras se mueve; el swap se aplica al soltar.
  // Movimiento en CRUZ -- horizontal (columna, misma fila) Y vertical
  // (fila, misma columna). Se traba al eje que domine la distancia
  // arrastrada en cada frame (igual que cualquier match-3 estándar), así
  // que un dedo un poco diagonal no queda "a medias" entre los dos ejes.
  const dragX = useRef(new Animated.Value(0)).current; // ficha agarrada sigue el dedo (X)
  const dragY = useRef(new Animated.Value(0)).current; // ficha agarrada sigue el dedo (Y)
  const nbL = useRef(new Animated.Value(0)).current; // vecino izquierdo se desliza
  const nbR = useRef(new Animated.Value(0)).current; // vecino derecho se desliza
  const nbUp = useRef(new Animated.Value(0)).current; // vecino de arriba se desliza
  const nbDown = useRef(new Animated.Value(0)).current; // vecino de abajo se desliza
  const dragRef = useRef({ r: 0, c: 0, active: false, dx: 0, dy: 0, axis: null });
  // Aviso breve de "se barajó el tablero" cuando ya no había ningún
  // movimiento posible (ver hasAnyMove/reshuffleBoard arriba).
  const shuffleAnim = useRef(new Animated.Value(0)).current;
  const [shuffled, setShuffled] = useState(false);
  // Un ref por FILA -- así la fila que agarraste nunca se calcula por
  // matemática de coordenadas (que fallaba con offsets verticales según
  // el dispositivo/notch). El sistema táctil de RN ya sabe, de forma
  // nativa, qué fila tocaste con solo repartir el responder por fila; acá
  // solo queda resolver la COLUMNA, midiendo esa fila en el eje X.
  const rowRefs = useRef(
    Array.from({ length: ROWS }, () => React.createRef())
  ).current;

  function resetLevel() {
    kindsRef.current = survival ? SURVIVAL_START_KINDS : levelDef.kinds;
    const g0 = makeFullGrid(kindsRef.current);
    setGrid(g0);
    gridRef.current = g0;
    setCleared(0);
    clearedRef.current = 0;
    setMovesLeft(levelDef.moves);
    movesLeftRef.current = levelDef.moves;
    setTimeLeft(levelDef.timeLimit);
    timeLeftRef.current = levelDef.timeLimit;
    setCombo(0);
    setComboSize(0);
    setWon(false);
    setLoseReason("moves");
    setPhase("play");
    phaseRef.current = "play";
    setDragCell(null);
    resolving.current = false;
    resolvePending.current = false;
    overRef.current = false;
    dragX.setValue(0);
    dragY.setValue(0);
    nbL.setValue(0);
    nbR.setValue(0);
    nbUp.setValue(0);
    nbDown.setValue(0);
    setShuffled(false);
  }

  useEffect(() => {
    if (!visible) return;
    resetLevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, level]);

  // Cronómetro del nivel -- corre en paralelo al límite de movimientos
  // (lo que se acabe primero corta el nivel). Se salta mientras no esté
  // en juego (resuelto/ganado/perdido) o el modal esté cerrado.
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      if (phaseRef.current !== "play" || overRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) endGame(false, "time");
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, level]);

  // Si ya no hay NINGÚN movimiento posible (ver hasAnyMove arriba), el
  // tablero quedó trabado. Se rebaraja en el lugar (mismas posiciones,
  // sabores redistribuidos) y se avisa brevemente.
  function checkDeadlock(g) {
    if (overRef.current || dragRef.current.active) return;
    if (hasAnyMove(g)) return;
    const reshuffled = reshuffleBoard(g);
    setGrid(reshuffled);
    gridRef.current = reshuffled;
    setShuffled(true);
    shuffleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shuffleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(shuffleAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setShuffled(false));
  }

  // Re-entrante: si ya está corriendo, marca pendiente y sale. Lee gridRef
  // fresco en cada iteración, así ve swaps hechos entre pasos. Tras cada
  // vuelta de gravedad, rellena los huecos de arriba con fichas nuevas
  // (refillTop) -- si eso arma una cascada, el propio while la agarra en
  // la siguiente iteración sin gastar un movimiento extra.
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

      // Survival: cada combinación devuelve tiempo al cronómetro -- así
      // una buena racha te compra más partida, en vez de que el reloj
      // corra parejo sin importar qué tan bien juegues.
      if (survival) {
        timeLeftRef.current += Math.max(1, Math.floor(m.size / 3));
        setTimeLeft(timeLeftRef.current);
      }

      const marking = g.map((row) => row.slice());
      m.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        marking[r][c] = CLEARING;
      });
      setGrid(marking);
      gridRef.current = marking;

      // Llamativo cuando hay CADENA (chain>=2) o cuando el golpe junta 4+
      // fichas de una sola vez (aunque sea la primera y única jugada) --
      // eso también merece celebración, no solo los combos encadenados.
      if (chain >= 2 || m.size >= 4) {
        setCombo(chain);
        setComboSize(m.size);
        popCombo(chain, m.size);
      }
      setPetReaction((x) => ({ type: chain >= 3 ? "play" : "eat", id: x.id + 1 }));
      bounceAvatar();

      await wait(120);
      const g2 = applyGravity(gridRef.current);
      const g3 = refillTop(g2, kindsRef.current);
      setGrid(g3);
      gridRef.current = g3;
      await wait(100);
    }

    if (total > 0) {
      clearedRef.current += total;
      setCleared(clearedRef.current);
      // Sube la dificultad con el puntaje: más sabores en juego = más
      // difícil encontrar la siguiente combinación. Tope en KINDS.length
      // (los 6 sabores completos).
      if (survival) {
        kindsRef.current = Math.min(KINDS.length, SURVIVAL_START_KINDS + Math.floor(clearedRef.current / 25));
      }
    }
    resolving.current = false;

    if (resolvePending.current && !overRef.current) {
      resolvePending.current = false;
      runResolve(0);
      return;
    }
    // El tablero ya se asentó del todo (sin cadena pendiente) -- si nadie
    // tiene ninguna jugada posible desde aquí, se reparte de nuevo.
    checkDeadlock(gridRef.current);

    // Ya no queda nada pendiente: revisa si el nivel se ganó o se perdió.
    if (!overRef.current) {
      if (clearedRef.current >= levelDef.target) endGame(true);
      else if (movesLeftRef.current <= 0) endGame(false, "moves");
    }
  }

  // --- Gestos ---
  // Un PanResponder POR FILA: el propio sistema táctil de RN decide, por
  // dónde tocaste, cuál fila recibe el gesto -- cero matemática, cero
  // desfase vertical posible. Solo queda resolver la COLUMNA, midiendo esa
  // fila en el eje X.
  // ⚠️ Ya NO se bloquea el arrastre mientras `resolving` está en marcha
  // (una cadena/combo resolviéndose): runResolve ya es re-entrante
  // (resolvePending), así que un swap hecho a mitad de una cadena
  // simplemente encola otra pasada. Lo único que sigue bloqueando el
  // agarre es que el juego haya terminado (overRef) o que la celda tocada
  // ya no tenga una ficha válida en ESE instante.
  const rowPans = useRef(
    Array.from({ length: ROWS }, (_, r) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phaseRef.current === "play" && !overRef.current,
        onMoveShouldSetPanResponder: (_e, gs) =>
          phaseRef.current === "play" &&
          !overRef.current &&
          (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4),
        onPanResponderGrant: (e) => {
          if (overRef.current) return;
          const { pageX } = e.nativeEvent;
          rowRefs[r].current?.measureInWindow((bx) => {
            if (overRef.current) return;
            const c = Math.floor((pageX - bx) / cellRef.current);
            if (c < 0 || c >= COLS) return;
            const k = gridRef.current[r][c];
            if (k == null || k === CLEARING) return;
            dragRef.current = { r, c, active: true, dx: 0, dy: 0, axis: null };
            dragX.setValue(0);
            dragY.setValue(0);
            nbL.setValue(0);
            nbR.setValue(0);
            nbUp.setValue(0);
            nbDown.setValue(0);
            setDragCell({ r, c });
          });
        },
        onPanResponderMove: (_e, gs) => {
          const d = dragRef.current;
          if (!d.active || d.r !== r) return;
          if (overRef.current) return;
          const cell = cellRef.current;

          // Traba el eje apenas el arrastre sea claramente más de un lado
          // que del otro; hasta entonces no se decide (evita "saltar" de
          // eje con cada micro-temblor del dedo al iniciar el gesto).
          if (!d.axis) {
            if (Math.abs(gs.dx) > Math.abs(gs.dy) + 3) d.axis = "x";
            else if (Math.abs(gs.dy) > Math.abs(gs.dx) + 3) d.axis = "y";
            else return;
          }

          if (d.axis === "x") {
            let dx = Math.max(-cell, Math.min(cell, gs.dx));
            if (d.c === 0 && dx < 0) dx = 0;
            if (d.c === COLS - 1 && dx > 0) dx = 0;
            d.dx = dx;
            dragX.setValue(dx);
            nbR.setValue(dx > 0 ? -dx : 0);
            nbL.setValue(dx < 0 ? -dx : 0);
          } else {
            let dy = Math.max(-cell, Math.min(cell, gs.dy));
            if (d.r === 0 && dy < 0) dy = 0;
            if (d.r === ROWS - 1 && dy > 0) dy = 0;
            d.dy = dy;
            dragY.setValue(dy);
            nbDown.setValue(dy > 0 ? -dy : 0); // vecino de abajo se corre hacia arriba
            nbUp.setValue(dy < 0 ? -dy : 0); // vecino de arriba se corre hacia abajo
          }
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
        Animated.spring(dragY, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbL, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbR, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbUp, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(nbDown, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
      ]).start();
    };
    const resetOffsets = () => {
      dragX.setValue(0); dragY.setValue(0);
      nbL.setValue(0); nbR.setValue(0); nbUp.setValue(0); nbDown.setValue(0);
    };

    if (overRef.current) {
      doSnap();
      return;
    }

    const swapThreshold = cellRef.current * SWAP_FRACTION;
    let tr = d.r, tc = d.c;
    if (d.axis === "x") {
      const dir = d.dx > swapThreshold ? 1 : d.dx < -swapThreshold ? -1 : 0;
      if (dir === 0) { doSnap(); return; }
      tc = d.c + dir;
      if (tc < 0 || tc >= COLS) { doSnap(); return; }
    } else if (d.axis === "y") {
      const dir = d.dy > swapThreshold ? 1 : d.dy < -swapThreshold ? -1 : 0;
      if (dir === 0) { doSnap(); return; }
      tr = d.r + dir;
      if (tr < 0 || tr >= ROWS) { doSnap(); return; }
    } else {
      doSnap();
      return;
    }

    const g = gridRef.current.map((row) => row.slice());
    const sourceVal = g[d.r][d.c];
    const targetVal = g[tr][tc];

    // Ahora se puede arrastrar mientras una cadena/combo sigue resolviendo
    // -- eso abre una ventana rara donde, entre el momento en que agarraste
    // la ficha y el momento en que sueltas, esa MISMA celda pudo vaciarse
    // (una cadena la limpió y la gravedad corrió todo). Si ya no hay nada
    // que mover, no hay swap.
    if (sourceVal == null || sourceVal === CLEARING) {
      doSnap();
      return;
    }

    if (targetVal == null) {
      // El destino está vacío (ventana transitoria de una cascada en
      // curso) -- mover la ficha ahí, cae por gravedad. Solo gasta un
      // movimiento si de casualidad arma una combinación.
      g[d.r][d.c] = null;
      g[tr][tc] = sourceVal;
      const settled = applyGravity(g);
      setGrid(settled);
      gridRef.current = settled;
      resetOffsets();
      if (findMatches(settled).size > 0) {
        movesLeftRef.current = Math.max(0, movesLeftRef.current - 1);
        setMovesLeft(movesLeftRef.current);
        runResolve(0);
      }
      return;
    }

    if (targetVal === CLEARING) {
      // Celda destino a medio desvanecer (chispa ✨) -- no es un lugar
      // válido para soltar, espera a que termine de limpiarse.
      doSnap();
      return;
    }

    // Intercambio normal entre dos fichas. Solo se confirma (y gasta un
    // movimiento) si arma una combinación -- si no, vuelve a su lugar.
    g[d.r][d.c] = targetVal;
    g[tr][tc] = sourceVal;
    const settled = applyGravity(g);
    if (findMatches(settled).size > 0) {
      setGrid(settled);
      gridRef.current = settled;
      resetOffsets();
      movesLeftRef.current = Math.max(0, movesLeftRef.current - 1);
      setMovesLeft(movesLeftRef.current);
      runResolve(0);
    } else {
      doSnap();
    }
  }

  function endGame(didWin, reason) {
    if (overRef.current) return;
    overRef.current = true;
    setWon(!!didWin);
    if (!didWin) setLoseReason(reason || "moves");
    setPhase("over");
    phaseRef.current = "over";
  }

  // Combo "deslumbrante": punch con rebote (overshoot), un pequeño giro de
  // celebración, y chispas ✨🎉 que salen disparadas en todas direcciones.
  // Acortado a propósito (antes se quedaba ~0.7-1s+ tapando el tablero) --
  // el arrastre nunca estuvo bloqueado durante esto, pero la alerta grande
  // en medio de la pantalla estorbaba para seguir jugando a tiempo.
  function popCombo(chain, size) {
    const power = Math.max(chain, size - 2);
    comboAnim.setValue(0);
    comboSpin.setValue(0);
    Animated.sequence([
      Animated.spring(comboAnim, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      Animated.delay(180 + Math.min(power, 5) * 30),
      Animated.timing(comboAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(comboSpin, { toValue: 1, duration: 180, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(comboSpin, { toValue: 0, duration: 110, useNativeDriver: true }),
    ]).start();

    const glyphs = power >= 3 ? ["🎉", "✨", "⭐"] : ["✨", "⭐"];
    const count = Math.min(4 + power * 2, 14);
    const born = [];
    for (let i = 0; i < count; i++) {
      const id = ++comboPid.current;
      const v = new Animated.Value(0);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 34 + Math.random() * 22 + power * 4;
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

  // Survival no tiene target (Infinity) -- el puntaje que se manda al
  // backend (alimenta happiness/xp ganados, ver pet.controller.js) escala
  // con las fichas juntadas en vez de con "% del nivel completado".
  const score = survival
    ? Math.min(1, 0.4 + clearedRef.current / 150)
    : Math.max(0, Math.min(1, cleared / levelDef.target));
  const finish = () => onFinish?.(score, cleared, level, won);

  const avatarScale = avatarBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const comboScale = comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.22] });
  const comboRot = comboSpin.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "6deg"] });
  const comboPower = Math.max(combo, comboSize - 2);
  const comboColor = comboPower >= 4 ? "#e0a800" : colors.primary;
  // Si hubo cadena de verdad (2+ pasos) se destaca eso; si no, pero el
  // golpe fue grande (4+ fichas de un tirón), se celebra el tamaño.
  const comboLabel = combo >= 2 ? `¡Combo x${combo}!` : `¡${comboSize} de un tirón!`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>
                  Café Crush 🍰 · {survival ? "Survival 🔥" : `Nivel ${level}`}
                </Text>
                <Pressable
                  onPress={() => setCompact((v) => !v)}
                  style={styles.zoomBtn}
                  hitSlop={8}
                >
                  <Text style={styles.zoomBtnText}>{compact ? "🔍" : "🔎"}</Text>
                </Pressable>
              </View>
              <View style={styles.goalRow}>
                {survival ? (
                  <>
                    <Text style={styles.goalText}>🍰 {cleared}</Text>
                    <Text style={[styles.goalText, timeLeft <= 10 && styles.goalDanger]}>
                      ⏱ {timeLeft}s
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.goalText}>🎯 {cleared}/{levelDef.target}</Text>
                    <Text style={[styles.goalText, movesLeft <= 3 && styles.goalDanger]}>
                      🔁 {movesLeft}
                    </Text>
                    <Text style={[styles.goalText, timeLeft <= 10 && styles.goalDanger]}>
                      ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                    </Text>
                  </>
                )}
              </View>
              <Text style={styles.hdrSub}>
                {survival
                  ? "Sin fin -- cada combinación te regala tiempo, entre más juntas más sube la dificultad"
                  : `Arrastra una ficha (↔ ↕) para acomodarla · junta 3 o más${compact ? "" : " · 🔎 para ver todo el tablero"}`}
              </Text>

              <View style={styles.stageRow}>
                <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                  <View style={styles.sideChar}>
                    <AvatarPreview config={avatarConfig} size={44} />
                    <Text style={styles.sideCap}>Tú</Text>
                  </View>
                </Animated.View>

                <View style={styles.boardWrap}>
                  <View style={styles.boardClip}>
                    {grid.map((row, r) => (
                      <View key={r} ref={rowRefs[r]} collapsable={false} style={styles.row} {...rowPans[r].panHandlers}>
                        {row.map((k, c) => {
                          const empty = k == null;
                          const clearing = k === CLEARING;
                          const isDrag = dragCell && dragCell.r === r && dragCell.c === c;
                          const isNbL = dragCell && dragCell.r === r && c === dragCell.c - 1;
                          const isNbR = dragCell && dragCell.r === r && c === dragCell.c + 1;
                          const isNbUp = dragCell && dragCell.c === c && r === dragCell.r - 1;
                          const isNbDown = dragCell && dragCell.c === c && r === dragCell.r + 1;
                          let extra = null;
                          if (isDrag) {
                            extra = {
                              transform: [{ translateX: dragX }, { translateY: dragY }, { scale: 1.08 }],
                              zIndex: 20,
                            };
                          } else if (isNbL) extra = { transform: [{ translateX: nbL }] };
                          else if (isNbR) extra = { transform: [{ translateX: nbR }] };
                          else if (isNbUp) extra = { transform: [{ translateY: nbUp }] };
                          else if (isNbDown) extra = { transform: [{ translateY: nbDown }] };
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
                  </View>

                  <View pointerEvents="none" style={styles.comboWrap}>
                    <Animated.View style={[styles.comboHalo, { opacity: comboAnim, transform: [{ scale: comboScale }] }]} />
                    <Animated.Text
                      style={[
                        styles.combo,
                        { color: comboColor, opacity: comboAnim, transform: [{ scale: comboScale }, { rotate: comboRot }] },
                      ]}
                    >
                      {comboLabel} {comboPower >= 4 ? "🔥" : ""}
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

                  {shuffled && (
                    <Animated.View pointerEvents="none" style={[styles.shuffleWrap, { opacity: shuffleAnim }]}>
                      <Text style={styles.shuffleText}>🔀 ¡Sin movimientos! Se rebarajó el tablero</Text>
                    </Animated.View>
                  )}
                </View>

                <View style={styles.sideChar}>
                  <PetActor species={species} mood="happy" size={44} reaction={petReaction} />
                  <Text style={styles.sideCap} numberOfLines={1}>{petName}</Text>
                </View>
              </View>

              <Pressable style={styles.endBtn} onPress={() => endGame(false)}>
                <Text style={styles.endBtnText}>Salir</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.doneWrap}>
              <Text style={styles.doneEmoji}>{survival ? "🔥" : won ? "🎉" : "😿"}</Text>
              <Text style={styles.doneTitle}>
                {survival
                  ? `¡${cleared} fichas!`
                  : won
                  ? `¡Nivel ${level} completo!`
                  : `${cleared}/${levelDef.target} fichas`}
              </Text>
              <Text style={styles.doneSub}>
                {survival
                  ? `¡${petName} aguantó hasta el final! Se acabó el tiempo -- ¡a superar tu marca!`
                  : won
                  ? `¡${petName} está feliz! 🎉${level < MAX_MATCH3_LEVEL ? " Ya se abrió el siguiente nivel." : " ¡Completaste todos los niveles!"}`
                  : `Te faltaron ${Math.max(0, levelDef.target - cleared)} -- ${
                      loseReason === "time" ? "se acabó el tiempo" : "sin movimientos"
                    }. ¡Inténtalo de nuevo!`}
              </Text>
              {!won && (
                <Pressable style={styles.doneBtn} onPress={resetLevel}>
                  <Text style={styles.doneBtnText}>Reintentar</Text>
                </Pressable>
              )}
              <Pressable
                style={won ? styles.doneBtn : styles.doneBtnOutline}
                onPress={finish}
              >
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
  goalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  goalText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  goalDanger: { color: "#d9534f" },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 4, marginBottom: 8 },

  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  sideChar: { width: 46, alignItems: "center", justifyContent: "flex-end" },
  sideCap: { marginTop: 2, color: colors.textMuted, fontSize: 9, fontWeight: "800" },

  boardWrap: { backgroundColor: "#f3e6d3", borderRadius: 12, borderWidth: 2, borderColor: colors.primarySoft, padding: 3 },
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

  shuffleWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  shuffleText: { color: "#fff", fontSize: 10.5, fontWeight: "800", textAlign: "center" },

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
