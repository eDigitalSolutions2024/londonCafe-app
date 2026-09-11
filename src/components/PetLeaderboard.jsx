import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, ScrollView } from "react-native";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";

const SPECIES_EMOJI = { cat: "🐱", dog: "🐶", hamster: "🐹" };
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * Top de Café Crush: quién ha juntado más fichas en una sola partida.
 * Siempre muestra al usuario actual (aunque quede fuera del top) para que
 * tenga claro a cuánto está de subir -- "alguien a quien superar".
 */
export default function PetLeaderboard({ visible, onClose }) {
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    setErr(false);
    apiFetch("/pet/leaderboard")
      .then((r) => {
        if (!alive) return;
        setTop(Array.isArray(r?.top) ? r.top : []);
        setMe(r?.me || null);
      })
      .catch(() => alive && setErr(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible]);

  const meInTop = top.some((r) => r.isMe);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.hdr}>
            <Text style={styles.hdrTitle}>🏆 Top Café Crush</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
          <Text style={styles.hdrSub}>Las mascotas que más fichas juntaron en una sola partida</Text>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : err ? (
            <Text style={styles.emptyText}>No se pudo cargar la tabla. Intenta de nuevo.</Text>
          ) : top.length === 0 ? (
            <Text style={styles.emptyText}>Todavía nadie ha jugado Café Crush. ¡Sé el primero! 🎮</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {top.map((r) => (
                <Row key={r.userId} r={r} />
              ))}
              {me && !meInTop && (
                <>
                  <View style={styles.divider} />
                  <Row r={me} />
                </>
              )}
            </ScrollView>
          )}

          {me && !loading && !err && (
            <Text style={styles.meFooter}>
              {me.rank === 1
                ? "¡Vas en primer lugar! 👑"
                : `Estás #${me.rank}${top[0] ? ` · te faltan ${Math.max(0, (top[0].best || 0) - (me.best || 0))} fichas para el 1° lugar` : ""}`}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ r }) {
  return (
    <View style={[styles.row, r.isMe && styles.rowMe]}>
      <Text style={styles.rank}>{MEDAL[r.rank] || `#${r.rank}`}</Text>
      <Text style={styles.rowEmoji}>{SPECIES_EMOJI[r.species] || "🐾"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowPet} numberOfLines={1}>{r.petName}</Text>
        <Text style={styles.rowOwner} numberOfLines={1}>{r.isMe ? "Tú" : r.ownerName}</Text>
      </View>
      <Text style={styles.rowScore}>{r.best} 🍰</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 12 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 22, padding: 16 },

  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hdrTitle: { color: "#111", fontSize: 17, fontWeight: "900" },
  hdrSub: { color: colors.textMuted, fontSize: 11.5, fontWeight: "800", marginTop: 4, marginBottom: 10 },

  closeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.primarySoft },
  closeText: { color: colors.primary, fontWeight: "900", fontSize: 11.5 },

  emptyText: { color: colors.textMuted, fontSize: 12.5, fontWeight: "700", textAlign: "center", paddingVertical: 30 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowMe: { backgroundColor: "rgba(122,30,58,0.08)" },
  rank: { width: 30, textAlign: "center", fontSize: 15, fontWeight: "900", color: "#111" },
  rowEmoji: { fontSize: 22 },
  rowPet: { color: "#111", fontSize: 13, fontWeight: "900" },
  rowOwner: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700", marginTop: 1 },
  rowScore: { color: colors.primary, fontSize: 14, fontWeight: "900" },

  divider: { height: 1, backgroundColor: colors.primarySoft, marginVertical: 6 },

  meFooter: {
    marginTop: 10,
    textAlign: "center",
    color: "#111",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(232,207,174,0.22)",
    borderRadius: 10,
    paddingVertical: 8,
  },
});
