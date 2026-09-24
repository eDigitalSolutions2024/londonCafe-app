import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import AvatarPreview from "../components/AvatarPreview";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";

// Chat 1:1 con un amigo. Sin websockets -- se hace polling cada 4s
// mientras la pantalla está enfocada (mismo patrón "REST + polling" que
// ya usa el resto de la app, ver el debounce de búsqueda en
// AmigosScreen.jsx). Para ~40 usuarios no vale la pena meter
// infraestructura de sockets solo por esto.
const POLL_MS = 4000;

export default function ChatScreen({ route, navigation }) {
  const { friendshipId, name, snapshotUrl } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // "height" de KeyboardAvoidingView en Android seguía sin subir el input
  // -- con edgeToEdgeEnabled:true (app.json) esa combinación con
  // adjustResize es un punto débil conocido (el resize del sistema y el
  // cálculo de KeyboardAvoidingView no cuadran). En vez de seguir
  // peleando con el comportamiento automático, en Android se mide el alto
  // real del teclado con los eventos nativos y se aplica como padding
  // directo -- no depende de que el "resize" de la ventana se calcule bien.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onShow = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const onHide = Keyboard.addListener("keyboardDidHide", () => setAndroidKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // El tab bar de abajo es `position: absolute` (App.js) -- flota SOBRE
  // el contenido en vez de empujarlo, así que tapaba el input del chat.
  // Se oculta mientras el chat está enfocado y se regresa al salir, mismo
  // patrón estándar de React Navigation para pantallas anidadas.
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => parent?.setOptions({ tabBarStyle: { position: "absolute", backgroundColor: "#111118", borderTopColor: "#222230" } });
    }, [navigation])
  );

  const load = useCallback(
    (opts = {}) => {
      if (!friendshipId) return;
      return apiFetch(`/friends/${friendshipId}/messages`)
        .then((r) => setMessages(r?.messages || []))
        .catch((e) => console.log("❌ chat load:", e?.data || e?.message))
        .finally(() => opts.silent || setLoading(false));
    },
    [friendshipId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(() => load({ silent: true }), POLL_MS);
      return () => clearInterval(t);
    }, [load])
  );

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    try {
      await apiFetch(`/friends/${friendshipId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: value }),
      });
      await load({ silent: true });
      requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
    } catch (e) {
      setText(value); // regresa el texto si falló, para no perder lo escrito
      console.log("❌ chat send:", e?.data || e?.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen safeStyle={styles.safeDark} withPadding={false} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerAvatarWrap}>
          <AvatarPreview config={{ avatar3dSnapshotUrl: snapshotUrl }} size={36} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{name || "Chat"}</Text>
      </View>

      {/* iOS sigue con KeyboardAvoidingView normal (funciona bien ahí).
          Android usa androidKeyboardHeight (ver arriba) en vez de
          behavior="height" -- ver esa nota para el porqué. behavior=null
          en Android para que KeyboardAvoidingView no intente compensar
          por su cuenta y se pisen los dos ajustes. */}
      <KeyboardAvoidingView
        style={[{ flex: 1 }, Platform.OS === "android" && { paddingBottom: androidKeyboardHeight }]}
        behavior={Platform.OS === "ios" ? "padding" : null}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Todavía no hay mensajes. Manda el primero 👋
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>{item.text}</Text>
                </View>
              </View>
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeDark: { backgroundColor: "#0b0709" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: -2 },
  headerAvatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", flex: 1 },

  emptyText: {
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 40,
    fontSize: 13,
    fontWeight: "700",
  },

  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13 },
  bubbleTheirs: { backgroundColor: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { color: "#fff", fontSize: 14, fontWeight: "600", lineHeight: 19 },
  bubbleTextMine: { color: "#fff" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontWeight: "600",
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 17, fontWeight: "900" },
});
