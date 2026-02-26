// src/screens/GiftsScreen.jsx
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";

import { AuthContext } from "../context/AuthContext";
import { fetchMyGiftCards, purchaseGiftCard, redeemGiftCard } from "../api/giftcards";
import { colors } from "../theme/colors";
import AvatarPreview from "../components/AvatarPreview"; // ✅ ajusta si tu path cambia

const moneyPresets = [50, 100, 200, 300, 500];

const UI = {
  bg: colors?.background || "#f6f6f7",
  card: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  text: colors?.text || "#101318",
  muted: colors?.textMuted || "#6b7280",
  primary: colors?.primary || "#7b1e3b",
  primarySoft: colors?.primarySoft || "rgba(123,30,59,0.15)",
};

function SectionTitle({ children, right }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <Text style={{ color: UI.text, fontSize: 16, fontWeight: "900" }}>
        {children}
      </Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

function Card({ children }) {
  return (
    <View
      style={{
        backgroundColor: UI.card,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: UI.border,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
        marginBottom: 14,
      }}
    >
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: active ? UI.primary : UI.border,
        backgroundColor: active ? UI.primary : "#fff",
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : UI.text,
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={{
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled ? "rgba(0,0,0,0.15)" : UI.primary,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function OutlineButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={{
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: disabled ? "rgba(123,30,59,0.35)" : UI.primary,
        backgroundColor: "#fff",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <Text
        style={{
          color: disabled ? "rgba(123,30,59,0.55)" : UI.primary,
          fontWeight: "900",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "none",
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9aa0a6"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={{
        height: 46,
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: UI.border,
        backgroundColor: "#fff",
        color: UI.text,
      }}
    />
  );
}

function GiftPreview({ amount, toEmail, message, fromUser }) {
  const safeEmail = (toEmail || "").trim();
  const safeMsg = (message || "").trim();

  const fromName = fromUser?.name || fromUser?.username || "London Buddy";
  const fromAt = fromUser?.username ? `@${fromUser.username}` : "";

  return (
    <View
      style={{
        borderRadius: 18,
        padding: 14,
        backgroundColor: UI.primary,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.85)",
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        Tarjeta de regalo
      </Text>

      {/* De / Para */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: 10,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {fromUser?.avatarConfig ? (
              <AvatarPreview config={fromUser.avatarConfig} size={52} />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900" }}>🙂</Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 11 }}>
              De:
            </Text>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }} numberOfLines={1}>
              {fromName} {fromAt}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", maxWidth: 150 }}>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 11 }}>
            Para:
          </Text>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }} numberOfLines={1}>
            {safeEmail || "—"}
          </Text>
        </View>
      </View>

      {/* Amount */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 30 }}>
          ${amount}
        </Text>
      </View>

      {/* Message */}
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 12 }}>
          Mensaje
        </Text>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }} numberOfLines={2}>
          {safeMsg || "Disfruta tu café ☕️"}
        </Text>
      </View>
    </View>
  );
}

function GiftPillCard({ item, variant = "received", onPress }) {
  const isActive = item.status === "ACTIVE";

  const from = item?.fromUser;
  const fromName = from?.name || from?.username || "London Buddy";
  const fromAt = from?.username ? `@${from.username}` : "";

  const toLabel = item?.toEmail || item?.toUser?.email || "—";

  // ✅ Hint SOLO en recibidas + activa
  const showHint = variant === "received" && isActive;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(item)}
      disabled={variant !== "received" || !isActive}
      style={{
        borderRadius: 18,
        padding: 14,
        backgroundColor: UI.primary,
        marginTop: 10,
        opacity: variant === "received" && !isActive ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          {/* Avatar chibi */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {from?.avatarConfig ? (
              <AvatarPreview config={from.avatarConfig} size={54} />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900" }}>🙂</Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 11 }}>
              De:
            </Text>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
              {fromName} {fromAt}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", maxWidth: 140 }}>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 11 }}>
            Para:
          </Text>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }} numberOfLines={1}>
            {toLabel}
          </Text>
        </View>
      </View>

      {/* Code */}
      {!!item.code ? (
        <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 10, fontWeight: "900" }}>
          {item.code}
        </Text>
      ) : null}

      {/* Amount + status */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 10,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 28 }}>
          ${item.amount}
        </Text>

        <View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor:
              item.status === "ACTIVE"
                ? "rgba(255,255,255,0.18)"
                : item.status === "REDEEMED"
                ? "rgba(255,255,255,0.10)"
                : "rgba(255,255,255,0.10)",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>
            {item.status === "ACTIVE" ? "Activa" : item.status === "REDEEMED" ? "Canjeada" : "Cancelada"}
          </Text>
        </View>
      </View>

      {/* Message */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 11 }}>
          Mensaje
        </Text>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }} numberOfLines={2}>
          {item.message || "Disfruta tu café ☕️"}
        </Text>
      </View>

      {/* ✅ Hint SOLO en recibidas */}
      {showHint ? (
        <Text style={{ color: "rgba(255,255,255,0.95)", marginTop: 10, fontWeight: "900", fontSize: 12 }}>
          Toca para usar este código
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function GiftsScreen() {
  const { token, user } = useContext(AuthContext);

  const scrollRef = useRef(null);
  const redeemYRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);

  const [toEmail, setToEmail] = useState("");
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState("");

  const [redeemCode, setRedeemCode] = useState("");

  const activeReceived = useMemo(
    () => received.filter((g) => g.status === "ACTIVE"),
    [received]
  );

  const load = useCallback(async () => {
    if (!token) return;

    const res = await fetchMyGiftCards(token);
    if (!res?.ok) throw new Error(res?.msg || "No se pudieron cargar gift cards.");

    setReceived(res.received || []);
    setSent(res.sent || []);
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        Alert.alert("Error", e?.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } catch (e) {
      Alert.alert("Error", e?.message || "Error");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const pickGiftCode = useCallback((gift) => {
    if (!gift?.code) return;

    if (gift.status !== "ACTIVE") {
      Alert.alert("No disponible", "Esta tarjeta ya fue canjeada o cancelada.");
      return;
    }

    setRedeemCode(String(gift.code).trim().toUpperCase());

    // ✅ Baja a la sección Canjear
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, (redeemYRef.current || 0) - 10),
        animated: true,
      });
    }, 60);
  }, []);

  const onPurchase = useCallback(async () => {
    try {
      const email = toEmail.trim();
      if (!email.includes("@")) return Alert.alert("Falta info", "Escribe un email válido.");
      if (!amount || amount <= 0) return Alert.alert("Falta info", "Selecciona un monto.");

      const res = await purchaseGiftCard(token, { toEmail: email, amount, message });
      if (!res?.ok) return Alert.alert("Error", res?.msg || "No se pudo enviar.");

      Alert.alert("Listo", `Tarjeta enviada ✅\nCódigo: ${res.gift.code}`);
      setToEmail("");
      setMessage("");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.message || "Error");
    }
  }, [token, toEmail, amount, message, load]);

  const onRedeem = useCallback(async () => {
    try {
      const code = redeemCode.trim().toUpperCase();
      if (!code) return Alert.alert("Falta info", "Escribe el código.");

      // ✅ (PRO) solo permite canjear si está en tus recibidas activas
      const match = received.find(
        (g) => String(g.code).toUpperCase() === code && g.status === "ACTIVE"
      );
      if (!match) {
        return Alert.alert("No válido", "Ese código no está en tus regalos activos.");
      }

      const res = await redeemGiftCard(token, code);
      if (!res?.ok) return Alert.alert("Error", res?.msg || "No se pudo canjear.");

      Alert.alert("Canjeada ✅", `Se acreditaron: $${res.credited} MXN`);
      setRedeemCode("");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.message || "Error");
    }
  }, [token, redeemCode, received, load]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: UI.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 40, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: UI.text, fontSize: 22, fontWeight: "900", marginBottom: 12 }}>
        Regalos 🎁
      </Text>

      {/* Preview tipo wallet con "De" + avatar */}
      <GiftPreview
        amount={amount}
        toEmail={toEmail}
        message={message}
        fromUser={user}
      />

      {/* Enviar */}
      <Card>
        <SectionTitle>Enviar tarjeta</SectionTitle>

        <Text style={{ color: UI.muted, fontWeight: "800", marginBottom: 6 }}>
          Email del destinatario
        </Text>
        <Input
          value={toEmail}
          onChangeText={setToEmail}
          placeholder="amigo@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={{ height: 12 }} />

        <Text style={{ color: UI.muted, fontWeight: "800", marginBottom: 6 }}>
          Monto
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {moneyPresets.map((m) => (
            <Chip key={m} label={`$${m}`} active={amount === m} onPress={() => setAmount(m)} />
          ))}
        </View>

        <View style={{ height: 12 }} />

        <Text style={{ color: UI.muted, fontWeight: "800", marginBottom: 6 }}>
          Mensaje (opcional)
        </Text>
        <Input
          value={message}
          onChangeText={setMessage}
          placeholder="Disfruta tu café ☕️"
          keyboardType="default"
          autoCapitalize="sentences"
        />

        <View style={{ height: 12 }} />

        <PrimaryButton label="Enviar regalo" onPress={onPurchase} disabled={!token} />
      </Card>

      {/* Canjear */}
      <View
        onLayout={(e) => {
          redeemYRef.current = e.nativeEvent.layout.y;
        }}
      >
        <Card>
          <SectionTitle>Canjear</SectionTitle>

          <Text style={{ color: UI.muted, fontWeight: "800", marginBottom: 6 }}>
            Código
          </Text>
          <Input
            value={redeemCode}
            onChangeText={setRedeemCode}
            placeholder="LCJ-AB12-CD34-EF56"
            keyboardType="default"
            autoCapitalize="characters"
          />

          <View style={{ height: 12 }} />

          <OutlineButton
            label="Canjear"
            onPress={onRedeem}
            disabled={!token || !redeemCode.trim()}
          />
        </Card>
      </View>

      {/* Recibidas */}
      <Card>
        <SectionTitle
          right={
            <Text style={{ color: UI.muted, fontWeight: "900" }}>
              Activas: {activeReceived.length}
            </Text>
          }
        >
          Recibidas
        </SectionTitle>

        {loading ? (
          <Text style={{ color: UI.muted }}>Cargando...</Text>
        ) : received.length === 0 ? (
          <Text style={{ color: UI.muted }}>Aún no tienes regalos.</Text>
        ) : (
          received.map((g) => (
            <GiftPillCard
              key={g._id}
              item={g}
              variant="received"
              onPress={pickGiftCode}
            />
          ))
        )}
      </Card>

      {/* Enviadas */}
      <Card>
        <SectionTitle>Enviadas</SectionTitle>

        {loading ? (
          <Text style={{ color: UI.muted }}>Cargando...</Text>
        ) : sent.length === 0 ? (
          <Text style={{ color: UI.muted }}>Aún no has enviado regalos.</Text>
        ) : (
          sent.map((g) => (
            <GiftPillCard key={g._id} item={g} variant="sent" />
          ))
        )}
      </Card>
    </ScrollView>
  );
}