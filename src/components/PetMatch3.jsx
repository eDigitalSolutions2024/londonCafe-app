import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing } from "react-native";
import { colors } from "../theme/colors";
import AvatarPreview from "./AvatarPreview";
import PetActor from "./PetActor";

const COLS = 5;
const ROWS = 6;
const TILE = 46;
const MOVES = 18;
const TARGET_CLEARED = 55; // limpiar esto = score 1.0

// Fichas con tema de café
const KINDS = ["☕", "🥐", "🍰", "🍪", "🫖"];

function rndKind() {
  return Math.floor(Math.random() * KINDS.length);
}

function makeBoard() {
  // genera sin matches iniciales
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let k;
      do {
        k = rndKind();
      } while (
        (c >= 2 && row[c - 1] === k && row[c - 2] === k) ||
        (r >= 2 && b[r - 1][c] === k && b[r - 2][c] === k)
      );
      row.push(k);
    }
    b.push(row);
  }
  return b;
}

function findMatches(b) {
  const hit = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = b[r][c];
      if (k == null) continue;
      if (c + 2 < COLS && b[r][c + 1] === k && b[r][c + 2] === k) {
        hit.add(`${r},${c}`); hit.add(`${r},${c + 1}`); hit.add(`${r},${c + 2}`);
        let cc = c + 3;
        while (cc < COLS && b[r][cc] === k) { hit.add(`${r},${cc}`); cc++; }
      }
      if (r + 2 < ROWS && b[r + 1][c] === k && b[r + 2][c] === k) {
        hit.add(`${r},${c}`); hit.add(`${r + 1},${c}`); hit.add(`${r + 2},${c}`);
        let rr = r + 3;
        while (rr < ROWS && b[rr][c] === k) { hit.add(`${rr},${c}`); rr++; }
      }
    }
  }
  return hit;
}

function collapse(b) {
  // baja las fichas y rellena arriba
  const nb = b.map((row) => row.slice());
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (nb[r][c] != null) {
        nb[write][c] = nb[r][c];
        if (write !== r) nb[r][c] = null;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) nb[r][c] = rndKind();
  }
  return nb;
}

function areAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export default function PetMatch3({ visible, species = "cat", petName = "tu mascota", avatarConfig, onClose, onFinish }) {
  const [board, setBoard] = useState(makeBoard);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState(MOVES);
  const [cleared, setCleared] = useState(0);
  const [phase, setPhase] = useState("play"); // play | done
  const [busy, setBusy] = useState(false);
  const [petReaction, setPetReaction] = useState({ type: null, id: 0 });
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const resolving = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setBoard(makeBoard());
    setSel(null);
    setMoves(MOVES);
    setCleared(0);
    setPhase("play");
    setBusy(false);
  }, [visible]);

  const bounceAvatar = () => {
    avatarBounce.setValue(0);
    Animated.sequence([
      Animated.timing(avatarBounce, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(avatarBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const resolveBoard = async (startBoard) => {
    resolving.current = true;
    let b = startBoard;
    let totalThisMove = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const m = findMatches(b);
      if (m.size === 0) break;
      totalThisMove += m.size;
      // marca limpiando
      const nb = b.map((row) => row.slice());
      m.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        nb[r][c] = null;
      });
      setBoard(nb);
      await new Promise((res) => setTimeout(res, 160));
      b = collapse(nb);
      setBoard(b);
      await new Promise((res) => setTimeout(res, 140));
    }
    if (totalThisMove > 0) {
      setCleared((x) => x + totalThisMove);
      if (totalThisMove >= 6) setPetReaction((x) => ({ type: "play", id: x.id + 1 }));
      else setPetReaction((x) => ({ type: "eat", id: x.id + 1 }));
      bounceAvatar();
    }
    resolving.current = false;
    return totalThisMove;
  };

  const onTapCell = async (r, c) => {
    if (phase !== "play" || busy || resolving.current) return;
    if (!sel) {
      setSel({ r, c });
      return;
    }
    if (sel.r === r && sel.c === c) {
      setSel(null);
      return;
    }
    if (!areAdjacent(sel, { r, c })) {
      setSel({ r, c });
      return;
    }
    // intentar swap
    setBusy(true);
    const a = sel;
    const bcell = { r, c };
    setSel(null);
    const nb = board.map((row) => row.slice());
    const tmp = nb[a.r][a.c];
    nb[a.r][a.c] = nb[bcell.r][bcell.c];
    nb[bcell.r][bcell.c] = tmp;

    if (findMatches(nb).size === 0) {
      // sin match -> revertir con un pequeño delay para que se vea el swap
      setBoard(nb);
      await new Promise((res) => setTimeout(res, 150));
      setBoard(board);
      setBusy(false);
      return;
    }

    setBoard(nb);
    await resolveBoard(nb);
    const left = moves - 1;
    setMoves(left);
    setBusy(false);
    if (left <= 0) {
      setPhase("done");
    }
  };

  const score = Math.max(0, Math.min(1, cleared / TARGET_CLEARED));

  const finish = () => onFinish?.(score, cleared);

  const avatarScale = avatarBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });

  const grid = useMemo(() => board, [board]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {phase === "play" ? (
            <>
              <View style={styles.hdr}>
                <Text style={styles.hdrTitle}>Combo de café 🍬</Text>
                <Text style={styles.hdrMeta}>Movs: {moves}</Text>
              </View>
              <Text style={styles.hdrSub}>Junta 3 o más · limpiadas: {cleared}</Text>

              <View style={styles.stageRow}>
                <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                  <View style={styles.sideChar}>
                    <AvatarPreview config={avatarConfig} size={44} />
                  </View>
                </Animated.View>

                <View style={styles.board}>
                  {grid.map((row, r) => (
                    <View key={r} style={styles.boardRow}>
                      {row.map((k, c) => {
                        const isSel = sel && sel.r === r && sel.c === c;
                        return (
                          <Pressable
                            key={`${r}-${c}`}
                            onPress={() => onTapCell(r, c)}
                            style={[styles.cell, isSel && styles.cellSel]}
                          >
                            <Text style={styles.tile}>{k == null ? "" : KINDS[k]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View style={styles.sideChar}>
                  <PetActor species={species} mood="happy" size={44} reaction={petReaction} />
                </View>
              </View>

              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Salir</Text>
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 380, backgroundColor: colors.card, borderRadius: 20, padding: 14 },

  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hdrTitle: { color: "#111", fontSize: 16, fontWeight: "900" },
  hdrMeta: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 2, marginBottom: 8 },

  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  sideChar: { width: 46, alignItems: "center", justifyContent: "center" },

  board: {
    backgroundColor: "#faf1e4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: 3,
  },
  boardRow: { flexDirection: "row" },
  cell: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    margin: 1,
    backgroundColor: "#fff",
  },
  cellSel: { backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.primary },
  tile: { fontSize: 26 },

  cancel: { alignSelf: "center", marginTop: 10, paddingVertical: 8, paddingHorizontal: 18 },
  cancelText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },

  doneWrap: { alignItems: "center", paddingVertical: 18 },
  doneEmoji: { fontSize: 54 },
  doneTitle: { color: "#111", fontSize: 20, fontWeight: "900", marginTop: 6 },
  doneSub: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginTop: 4 },
  doneBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 40 },
  doneBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
