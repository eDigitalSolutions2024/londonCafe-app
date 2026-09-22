import React, { useCallback, useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator, Alert, Switch } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import AvatarPreview from "../components/AvatarPreview";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

/**
 * "Gancho social" v1: amigos + racha COMPARTIDA. La racha compartida no
 * es un campo nuevo en el server -- se calcula comparando la racha diaria
 * de cada quien (la misma de "Día 19/28" en Home), ver
 * computeSharedStreak() en friends.controller.js. Agregar amigos es por
 * username (sin QR/cámara todavía -- necesitaría una librería nueva y un
 * build, no solo Metro).
 */
export default function AmigosScreen({ navigation }) {
  const { user, setUser } = useContext(AuthContext);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // ✅ "Amigos en el café ahora" -- opt-in, apagado por default. El
  // servidor nunca recibe coordenadas GPS reales, solo este booleano (ver
  // CafePresenceTracker.jsx, que hace el ping mientras está activado).
  const [presenceBusy, setPresenceBusy] = useState(false);
  const shareEnabled = !!user?.presence?.shareEnabled;
  const hereCount = friends.filter((f) => f.here).length;

  const togglePresence = async (next) => {
    try {
      setPresenceBusy(true);
      const r = await apiFetch("/me/presence", { method: "PUT", body: JSON.stringify({ shareEnabled: next }) });
      setUser((u) => (u ? { ...u, presence: r?.presence || { ...u.presence, shareEnabled: next } } : u));
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo actualizar.");
    } finally {
      setPresenceBusy(false);
    }
  };

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

      <View style={styles.presenceRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.presenceTitle}>Amigos en el café</Text>
          <Text style={styles.presenceSub}>
            {shareEnabled
              ? "Tus amigos ven cuando estás en London Café ahora mismo."
              : "Actívalo para que tus amigos sepan cuando estás aquí (y ver cuándo ellos están)."}
          </Text>
        </View>
        {presenceBusy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Switch
            value={shareEnabled}
            onValueChange={togglePresence}
            trackColor={{ false: "rgba(255,255,255,0.15)", true: colors.primary }}
            thumbColor="#fff"
          />
        )}
      </View>

      {hereCount > 0 ? (
        <View style={styles.hereBanner}>
          <Text style={styles.hereBannerText}>
            🟢 {hereCount} {hereCount === 1 ? "amigo está" : "amigos están"} en London Café ahora
          </Text>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o username..."
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
              <View style={styles.smallAvatarWrap}>
                <AvatarPreview config={{ avatar3dSnapshotUrl: u.snapshotUrl }} size={32} />
              </View>
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
                    <View style={styles.smallAvatarWrap}>
                      <AvatarPreview config={{ avatar3dSnapshotUrl: f.snapshotUrl }} size={32} />
                    </View>
                    <Text style={styles.requestName} numberOfLines={1}>{f.name}</Text>
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
            <Pressable
              style={styles.friendCard}
              onPress={() =>
                navigation.navigate("Chat", {
                  friendshipId: item.friendshipId,
                  name: item.name,
                  snapshotUrl: item.snapshotUrl,
                })
              }
            >
              <View style={styles.avatarOuter}>
                <View style={[styles.avatarWrap, item.here && styles.avatarWrapHere]}>
                  <AvatarPreview config={{ avatar3dSnapshotUrl: item.snapshotUrl }} size={44} />
                </View>
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.friendName} numberOfLines={1}>{item.name}</Text>
                  {item.here ? <View style={styles.hereDot} /> : null}
                </View>
                {item.here ? (
                  <Text style={styles.friendHereText}>En London Café ahora</Text>
                ) : outgoing.length === 0 && item.sharedStreak === 0 ? (
                  <Text style={styles.friendHint}>Reclamen su racha diaria el mismo día para empezar 🔥</Text>
                ) : (
                  <Text style={styles.friendHint}>Toca para chatear 💬</Text>
                )}
              </View>
              {item.sharedStreak > 0 ? (
                <View style={styles.streakPill}>
                  <Text style={styles.streakPillText}>🔥 {item.sharedStreak}</Text>
                </View>
              ) : null}
            </Pressable>
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
                    <Text style={styles.requestName} numberOfLines={1}>{f.name}</Text>
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

  presenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
  },
  presenceTitle: { color: "#fff", fontWeight: "900", fontSize: 13 },
  presenceSub: { marginTop: 2, color: "rgba(255,255,255,0.5)", fontSize: 10.5, fontWeight: "700", lineHeight: 14 },

  hereBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "rgba(79,157,105,0.15)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  hereBannerText: { color: "#4f9d69", fontWeight: "900", fontSize: 12 },

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
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  smallAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
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
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  // Texto claro para usar SOBRE el fondo oscuro de requestRow -- friendName
  // es texto oscuro pensado para las tarjetas blancas (friendCard), se veía
  // invisible (oscuro sobre oscuro) reusado aquí.
  requestName: { flex: 1, color: "#fff", fontWeight: "900", fontSize: 14 },
  acceptBtn: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  acceptBtnText: { color: "#fff", fontWeight: "900", fontSize: 11.5 },
  declineBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  declineBtnText: { color: "rgba(255,255,255,0.6)", fontWeight: "900" },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  avatarOuter: { width: 44, height: 44 },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  avatarWrapHere: {
    borderWidth: 2,
    borderColor: "#4f9d69",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "900" },
  friendName: { color: "#111", fontWeight: "900", fontSize: 14 },
  friendHint: { marginTop: 2, color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },
  friendHereText: { marginTop: 2, color: "#4f9d69", fontSize: 10.5, fontWeight: "800" },
  hereDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4f9d69" },
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
