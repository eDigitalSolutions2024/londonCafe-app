import React, { useState } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator } from "react-native";
import Screen from "../components/Screen";
import { useCart } from "../context/CartContext";
import { useStripe } from "@stripe/stripe-react-native";
import { apiFetch } from "../api/client"; // ✅ usa BASE_URL del client.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLORS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  border: "rgba(27,27,27,0.10)",
  wine: "#7A1E3A",
  wineSoft: "rgba(122,30,58,0.12)",
};

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function CartItem({ item, onInc, onDec, onRemove }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 12,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      }}
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/120" }}
        style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: "#eee" }}
      />

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", color: COLORS.ink }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ marginTop: 4, fontWeight: "900", color: COLORS.wine }}>
          {money(item.price)}
        </Text>

        {item?.selectedOptions?.milk ? (
  <Text style={{ marginTop: 4, color: COLORS.muted }}>
    Leche: {item.selectedOptions.milk}
  </Text>
) : null}

{item?.selectedOptions?.temp ? (
  <Text style={{ marginTop: 2, color: COLORS.muted }}>
    Temp: {item.selectedOptions.temp}
  </Text>
) : null}

{Array.isArray(item?.selectedOptions?.flavors) && item.selectedOptions.flavors.length > 0 ? (
  <Text style={{ marginTop: 2, color: COLORS.muted }}>
    Sabores: {item.selectedOptions.flavors.join(", ")}
  </Text>
) : null}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
          <Pressable
            onPress={onDec}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "900" }}>−</Text>
          </Pressable>

          <Text style={{ fontWeight: "900", minWidth: 20, textAlign: "center" }}>
            {item.qty}
          </Text>

          <Pressable
            onPress={onInc}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: COLORS.wine,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: "#fff" }}>+</Text>
          </Pressable>

          <Pressable onPress={onRemove} style={{ marginLeft: 10 }}>
            <Text style={{ color: "#B00020", fontWeight: "900" }}>Quitar</Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ fontWeight: "900", color: COLORS.ink }}>
        {money((item.price || 0) * (item.qty || 0))}
      </Text>
    </View>
  );
}


function buildOrderPayload(items, subtotal, paymentIntentId, customerName = "") {
  return {
    source: "app",
    paymentIntentId,
    paymentStatus: "paid",
    total: Number(subtotal || 0),
    currency: "mxn",
    customerName,
    items: items.map((it) => ({
      productId: it.productId || it._id || it.id,
      title: it.title,
      imageUrl: it.imageUrl || "",
      qty: Number(it.qty || 1),
      unitPrice: Number(it.price || 0),
      lineTotal: Number(it.price || 0) * Number(it.qty || 0),
      categorySnapshot: it.category || it.categorySnapshot || "General",
      selectedOptions: it.selectedOptions || {},
    })),
  };
}



export default function CartScreen({ navigation }) {
  const { items, subtotal, inc, dec, remove, clear } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paying, setPaying] = useState(false);


  async function getLoggedUserName() {
  try {
    const raw =
      (await AsyncStorage.getItem("user")) ||
      (await AsyncStorage.getItem("me")) ||
      (await AsyncStorage.getItem("auth_user"));

    if (!raw) return "";

    const parsed = JSON.parse(raw);
    return (
      parsed?.name ||
      parsed?.fullName ||
      parsed?.user?.name ||
      parsed?.user?.fullName ||
      parsed?.username ||
      ""
    );
  } catch {
    return "";
  }
}


 const onContinuar = async () => {
  if (paying) return;

  try {
    if (!items.length) {
      alert("Tu carrito está vacío.");
      return;
    }

    setPaying(true);

    const payloadItems = items.map((it) => ({
      _id: it.productId || it._id || it.id,
      qty: Number(it.qty || 1),
      selectedOptions: it.selectedOptions || {},
    }));

    const data = await apiFetch("/payments/sheet", {
      method: "POST",
      body: JSON.stringify({
        items: payloadItems,
      }),
    });

    if (!data?.ok) {
      throw new Error(data?.error || "No se pudo iniciar el pago.");
    }

    const clientSecret = data.paymentIntentClientSecret;
    const paymentIntentId = data.paymentIntentId;

    if (!clientSecret) throw new Error("Stripe: clientSecret vacío.");
    if (!paymentIntentId) throw new Error("Stripe: paymentIntentId vacío.");

    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: "London Café",
      paymentIntentClientSecret: clientSecret,
      allowsDelayedPaymentMethods: true,
    });

    if (initError) throw new Error(initError.message);

    const { error: payError } = await presentPaymentSheet();
    if (payError) throw new Error(payError.message);

    let customerName = "";

try {
  const me = await apiFetch("/me");
  customerName =
    me?.user?.name ||
    me?.user?.fullName ||
    me?.user?.username ||
    "";
} catch (e) {
  console.log("[APP] no se pudo obtener /me");
}

const orderPayload = buildOrderPayload(
  items,
  subtotal,
  paymentIntentId,
  customerName
);

console.log("[APP] customerName:", customerName);
console.log("[APP] orderPayload:", JSON.stringify(orderPayload, null, 2));



    const orderRes = await apiFetch("/orders/from-app", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes?.ok) {
      throw new Error(orderRes?.error || "El pago pasó, pero no se pudo crear el pedido.");
    }

    alert("Pago realizado ✅ Pedido enviado al café.");
    clear();
  } catch (e) {
    console.log("[CartScreen] ERROR:", e);
    console.log("[CartScreen] STATUS:", e?.status);
    console.log("[CartScreen] DATA:", e?.data);

    alert(
      e?.data?.posData?.error ||
      e?.data?.posData?.details ||
      e?.data?.error ||
      e?.message ||
      "Pago cancelado o falló."
    );
  } finally {
    setPaying(false);
  }
};

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ width: 44 }}>
            <Text style={{ fontSize: 18 }}>‹</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.ink }}>
              Tu carrito
            </Text>
          </View>

          <Pressable onPress={clear} style={{ width: 80, alignItems: "flex-end" }}>
            <Text style={{ color: COLORS.wine, fontWeight: "900" }}>Vaciar</Text>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onInc={() => inc(item.id)}
              onDec={() => dec(item.id)}
              onRemove={() => remove(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={{ padding: 20, opacity: 0.7 }}>
              <Text style={{ fontWeight: "900", color: COLORS.ink }}>
                Tu carrito está vacío.
              </Text>
            </View>
          }
        />

        <View
          style={{
            borderTopWidth: 1,
            borderColor: COLORS.border,
            paddingTop: 12,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: COLORS.muted, fontWeight: "900" }}>Subtotal</Text>
            <Text style={{ color: COLORS.ink, fontWeight: "900" }}>{money(subtotal)}</Text>
          </View>

          <Pressable
            disabled={!items.length || paying}
            onPress={onContinuar}
            style={{
              marginTop: 12,
              height: 48,
              borderRadius: 16,
              backgroundColor:
                items.length && !paying ? COLORS.wine : "rgba(122,30,58,0.35)",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            {paying ? <ActivityIndicator color="#fff" /> : null}
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {paying ? "Procesando..." : "Continuar"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}