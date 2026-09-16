import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";

/**
 * "Gancho social" v1: amigos + racha COMPARTIDA. La racha compartida no
 * es un campo nuevo en el server -- se calcula comparando la racha diaria
 * de cada quien (la misma de "Día 19/28" en Home), ver
 * computeSharedStreak() en friends.controller.js. Agregar amigos es por
 * username (sin QR/cámara todavía -- necesitaría una librería nueva y un
 * build, no solo Metro).
 */
export default function AmigosScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/friends")
      .then((r) => {
        setFriends(r?.friends || []);
        setIncoming(r?.incoming || []);
        setOutgoing(r?.outgoing || []);
      })
      .catch((e) => console.log("❌ friends load:", e?.data || e?.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      apiFetch(`/friends/search?q=${encodeURIComponent(q)}`)
        .then((r) => alive && setResults(r?.results || []))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const sendRequest = async (userId) => {
    try {
      setBusyId(userId);
      await apiFetch("/friends/request", { method: "POST", body: JSON.stringify({ toUserId: userId }) });
      setResults((r) => r.map((u) => (u.userId === userId ? { ...u, friendStatus: "pending" } : u)));
      load();
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo enviar la solicitud.");
    } finally {
      setBusyId(null);
    }
  };

  const respond = async (friendshipId, action) => {
    try {
      setBusyId(friendshipId);
      await apiFetch(`/friends/${friendshipId}/${action}`, { method: "POST" });
      load();
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo completar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen safeStyle={styles.safeDark}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Amigos</Text>
          <Text style={styles.sub}>Mantengan viva su racha juntos 🔥</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por username..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {searching ? <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} /> : null}
      </View>

      {results.length > 0 ? (
        <View style={styles.resultsBox}>
          {results.map((u) => (
            <View key={u.userId} style={styles.resultRow}>
              <Text style={styles.resultName} numberOfLines={1}>{u.name}</Text>
              {u.friendStatus === "accepted" ? (
                <Text style={styles.resultTag}>Ya son amigos</Text>
              ) : u.friendStatus === "pending" ? (
                <Text style={styles.resultTag}>Pendiente</Text>
              ) : (
                <Pressable
                  onPress={() => sendRequest(u.userId)}
                  disabled={busyId === u.userId}
                  style={[styles.addBtn, busyId === u.userId && { opacity: 0.6 }]}
                >
                  <Text style={styles.addBtnText}>Agregar</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 50, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.friendshipId}
          contentContainerStyle={{ padding: 20, paddingTop: 6 }}
          ListHeaderComponent={
            incoming.length > 0 ? (
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.sectionLabel}>Solicitudes</Text>
                {incoming.map((f) => (
                  <View key={f.friendshipId} style={styles.requestRow}>
                    <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => respond(f.friendshipId, "accept")}
                        disabled={busyId === f.friendshipId}
                        style={styles.acceptBtn}
                      >
                        <Text style={styles.acceptBtnText}>Aceptar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => respond(f.friendshipId, "decline")}
                        disabled={busyId === f.friendshipId}
                        style={styles.declineBtn}
                      >
                        <Text style={styles.declineBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.friendCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName} numberOfLines={1}>{item.name}</Text>
                {outgoing.length === 0 && item.sharedStreak === 0 ? (
                  <Text style={styles.friendHint}>Reclamen su racha diaria el mismo día para empezar 🔥</Text>
                ) : null}
              </View>
              {item.sharedStreak > 0 ? (
                <View style={styles.streakPill}>
                  <Text style={styles.streakPillText}>🔥 {item.sharedStreak}</Text>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Todavía no tienes amigos agregados. Búscalos arriba por su username.
            </Text>
          }
          ListFooterComponent={
            outgoing.length > 0 ? (
              <View style={{ marginTop: 18 }}>
                <Text style={styles.sectionLabel}>Solicitudes enviadas</Text>
                {outgoing.map((f) => (
                  <View key={f.friendshipId} style={styles.requestRow}>
                    <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.resultTag}>Esperando</Text>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeDark: { backgroundColor: "#0b0709" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: -2 },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", marginTop: 2 },

  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#fff",
    fontWeight: "700",
  },

  resultsBox: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  resultName: { color: "#fff", fontWeight: "800", fontSize: 13, flex: 1 },
  resultTag: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800" },
  addBtn: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  addBtnText: { color: "#2A0E18", fontWeight: "900", fontSize: 11.5 },

  sectionLabel: {
    marginBottom: 8,
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  acceptBtn: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  acceptBtnText: { color: "#fff", fontWeight: "900", fontSize: 11.5 },
  declineBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  declineBtnText: { color: "rgba(255,255,255,0.6)", fontWeight: "900" },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  friendName: { color: "#111", fontWeight: "900", fontSize: 14 },
  friendHint: { marginTop: 2, color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },
  streakPill: { backgroundColor: "rgba(122,30,58,0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  streakPillText: { color: colors.primary, fontWeight: "900", fontSize: 13 },

  emptyText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 30,
    lineHeight: 18,
  },
});
