import React, { useContext, useState } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator } from "react-native";
import Screen from "../components/Screen";
import { useCart } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useStripe } from "@stripe/stripe-react-native";
import { apiFetch } from "../api/client"; // ✅ usa BASE_URL del client.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLORS = {
  bg: "#F7F7F7",
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
    <Pressable
      android_ripple={{ color: "#ececec" }}
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/120" }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          backgroundColor: "#f2f2f2",
        }}
      />

      <View style={{ flex: 1 }}>
        <Text
          style={{ fontWeight: "900", color: COLORS.ink, fontSize: 15 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text
          style={{
            marginTop: 4,
            fontWeight: "900",
            color: COLORS.wine,
            fontSize: 14,
          }}
        >
          {money(item.price)}
        </Text>

        {item?.selectedOptions?.milk ? (
          <Text style={{ marginTop: 5, color: COLORS.muted, fontSize: 12 }}>
            Leche: {item.selectedOptions.milk}
          </Text>
        ) : null}

        {item?.selectedOptions?.temp ? (
          <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
            Temp: {item.selectedOptions.temp}
          </Text>
        ) : null}

        {Array.isArray(item?.selectedOptions?.flavors) &&
        item.selectedOptions.flavors.length > 0 ? (
          <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
            Sabores: {item.selectedOptions.flavors.join(", ")}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            gap: 10,
          }}
        >
          <Pressable
            onPress={onDec}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 16, color: COLORS.ink }}>
              −
            </Text>
          </Pressable>

          <Text
            style={{
              fontWeight: "900",
              minWidth: 20,
              textAlign: "center",
              color: COLORS.ink,
            }}
          >
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
            <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>
              +
            </Text>
          </Pressable>

          <Pressable
            onPress={onRemove}
            style={{
              marginLeft: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#FDECEF",
            }}
          >
            <Text style={{ color: "#B00020", fontWeight: "900", fontSize: 12 }}>
              Quitar
            </Text>
          </Pressable>
        </View>
      </View>

      <Text
        style={{
          fontWeight: "900",
          color: COLORS.ink,
          fontSize: 14,
          alignSelf: "flex-start",
        }}
      >
        {money((item.price || 0) * (item.qty || 0))}
      </Text>
    </Pressable>
  );
}



function buildOrderPayload(
  items,
  subtotal,
  paymentIntentId,
  customerName = "",
  customerPhone = "",
  customerEmail = ""
) {
  return {
    source: "app",
    paymentIntentId,
    paymentStatus: "paid",
    total: Number(subtotal || 0),
    currency: "mxn",
    customerName: String(customerName || "").trim(),
    customerPhone: String(customerPhone || "").trim(),
    customerEmail: String(customerEmail || "").trim(),
    items: items.map((it) => ({
      productId: it.productId || it._id || it.id,
      title: it.title,
      imageUrl: it.imageUrl || "",
      qty: Number(it.qty || 1),
      unitPrice: Number(it.price || 0),
      lineTotal: Number(it.price || 0) * Number(it.qty || 0),
      categorySnapshot: it.category || it.categorySnapshot || "General",
      selectedOptions: it.selectedOptions || {},
      notes: it.notes || "",
    })),
  };
}



export default function CartScreen({ navigation }) {
  const { items, subtotal, inc, dec, remove, clear } = useCart();
  const { user } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paying, setPaying] = useState(false);





async function getLoggedUserData() {
  try {
    const raw =
      (await AsyncStorage.getItem("user")) ||
      (await AsyncStorage.getItem("me")) ||
      (await AsyncStorage.getItem("auth_user"));

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return parsed?.user || parsed || null;
  } catch {
    return null;
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

   
let customerName = user?.name || user?.fullName || user?.username || "";
let customerPhone = user?.phone || "";
let customerEmail = user?.email || "";

const localUser = await getLoggedUserData();

if (!customerName || !customerPhone || !customerEmail) {
  customerName =
    customerName ||
    localUser?.name ||
    localUser?.fullName ||
    localUser?.username ||
    localUser?.user?.name ||
    localUser?.user?.fullName ||
    localUser?.user?.username ||
    "";

  customerPhone =
    customerPhone ||
    localUser?.phone ||
    localUser?.user?.phone ||
    "";

  customerEmail =
    customerEmail ||
    localUser?.email ||
    localUser?.user?.email ||
    "";
}

const finalUserId =
  user?._id ||
  user?.id ||
  localUser?._id ||
  localUser?.id ||
  localUser?.user?._id ||
  localUser?.user?.id ||
  null;

const orderPayload = buildOrderPayload(
  items,
  subtotal,
  paymentIntentId,
  customerName,
  customerPhone,
  customerEmail
);

orderPayload.userId = finalUserId;


/*console.log("[APP] userId:", finalUserId);
console.log("[APP] orderPayload:", JSON.stringify(orderPayload, null, 2));
console.log("[APP] customerName:", customerName);
console.log("[APP] customerPhone:", customerPhone);
console.log("[APP] customerEmail:", customerEmail);
console.log("[APP] orderPayload:", JSON.stringify(orderPayload, null, 2));
*/

    const orderRes = await apiFetch("/orders/from-app", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes?.ok) {
      throw new Error(orderRes?.error || "El pago pasó, pero no se pudo crear el pedido.");
    }

   
    clear();

navigation.navigate("Order", {
  playOrderBubble: true,
});
  } catch (e) {
   /* console.log("[CartScreen] ERROR:", e);
    console.log("[CartScreen] STATUS:", e?.status);
    console.log("[CartScreen] DATA:", e?.data);
*/
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
        <View style={{ marginBottom: 16 }}>
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    }}
  >
    <Pressable
      onPress={() => navigation.goBack()}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ color: COLORS.ink, fontWeight: "900" }}>
        ← Regresar
      </Text>
    </Pressable>

    {items.length ? (
      <Pressable
        onPress={clear}
        style={{
          paddingHorizontal: 12,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.wineSoft,
        }}
      >
        <Text style={{ color: COLORS.wine, fontWeight: "900" }}>Vaciar</Text>
      </Pressable>
    ) : (
      <View style={{ width: 82 }} />
    )}
  </View>

  <Text style={{ fontSize: 24, fontWeight: "900", color: COLORS.ink }}>
    Tu carrito
  </Text>
  <Text style={{ marginTop: 6, color: COLORS.muted }}>
    Revisa tus productos antes de continuar.
  </Text>
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
          contentContainerStyle={{ paddingBottom: 18 }}
showsVerticalScrollIndicator={false}
          ListEmptyComponent={
  <View
    style={{
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      paddingHorizontal: 20,
    }}
  >
    <View
      style={{
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: COLORS.wineSoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 30 }}>🛒</Text>
    </View>

    <Text
      style={{
        fontWeight: "900",
        color: COLORS.ink,
        fontSize: 18,
        textAlign: "center",
      }}
    >
      Tu carrito está vacío
    </Text>

    <Text
      style={{
        marginTop: 8,
        color: COLORS.muted,
        textAlign: "center",
        lineHeight: 20,
      }}
    >
      Agrega productos para continuar con tu pedido.
    </Text>
  </View>
}
        />

        <View
  style={{
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 14,
    marginTop: 8,
    backgroundColor: COLORS.bg,
  }}
>
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    }}
  >
    <View>
      <Text style={{ color: COLORS.muted, fontWeight: "700" }}>Subtotal</Text>
      <Text style={{ color: COLORS.ink, fontWeight: "900", fontSize: 22 }}>
        {money(subtotal)}
      </Text>
    </View>

    {!!items.length && (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: COLORS.wineSoft,
        }}
      >
        <Text style={{ color: COLORS.wine, fontWeight: "900", fontSize: 12 }}>
          {items.length} producto{items.length > 1 ? "s" : ""}
        </Text>
      </View>
    )}
  </View>

  <Pressable
    disabled={!items.length || paying}
    onPress={onContinuar}
    style={{
      height: 52,
      borderRadius: 18,
      backgroundColor:
        items.length && !paying ? COLORS.wine : "rgba(122,30,58,0.35)",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    }}
  >
    {paying ? <ActivityIndicator color="#fff" /> : null}
    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
      {paying ? "Procesando..." : "Continuar al pago"}
    </Text>
  </Pressable>
</View>
      </View>
    </Screen>
  );
}