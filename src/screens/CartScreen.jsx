import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator, Alert } from "react-native";
import Screen from "../components/Screen";
import { useCart } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useStripe } from "@stripe/stripe-react-native";
import { apiFetch, posFetch } from "../api/client"; // ✅ usa BASE_URL del client.js
import { getAppMenu } from "../api/appMenu";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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

// Mismas CrossSellRule que consume el Kiosk (Fase 1, plan aprobado) --
// matching client-side contra el carrito actual, igual reparto de trabajo
// que KioskOrderPage.tsx (el backend sirve las reglas completas).
function ruleMatchesCart(rule, cartItems) {
  if (rule.triggerType === "any") return cartItems.length > 0;
  if (rule.triggerType === "item") {
    return cartItems.some((l) => (rule.triggerItemIds || []).includes(l.productId));
  }
  if (rule.triggerType === "category") {
    return cartItems.some((l) => l.category === rule.triggerCategory);
  }
  return false;
}

function matchCrossSellSuggestions(cartItems, rules, catalog) {
  const inCart = new Set(cartItems.map((l) => l.productId));
  const byId = new Map((catalog || []).map((c) => [String(c._id), c]));
  const seen = new Set();
  const items = [];
  const ruleIds = [];
  let cap = 3;

  const applicable = (rules || [])
    .filter((r) => r.type === "cross-sell" && ruleMatchesCart(r, cartItems))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of applicable) {
    cap = Math.min(cap, rule.maxSuggestions || 3);
    let used = false;
    for (const id of rule.suggestItemIds || []) {
      if (items.length >= cap) break;
      if (inCart.has(id) || seen.has(id)) continue;
      const catalogItem = byId.get(id);
      if (!catalogItem || catalogItem.soldOut) continue;
      seen.add(id);
      items.push(catalogItem);
      used = true;
    }
    if (used) ruleIds.push(rule._id);
    if (items.length >= cap) break;
  }

  return { items, ruleIds };
}

// Telemetría de cross-sell (Fase 1) -- fire-and-forget vía el proxy de
// londoncafe-api (Commit 9), nunca debe romper el carrito si falla. Solo
// para usuarios con sesión (el proxy exige auth); invitados no se miden.
function postAppEvent(type, token, payload) {
  if (!token) return;
  apiFetch("/events", {
    method: "POST",
    body: JSON.stringify({ type, ...payload }),
  }).catch((e) => console.log(`[events] ${type} falló:`, e?.data || e?.message));
}

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
        source={item.imageUrl ? { uri: item.imageUrl } : require("../assets/promo_placeholder.png")}
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

function SuggestionCard({ item, onAdd }) {
  return (
    <Pressable
      onPress={() => onAdd(item)}
      style={{
        width: 130,
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 10,
        marginRight: 10,
      }}
    >
      <Image
        source={item.imageUrl ? { uri: item.imageUrl } : require("../assets/promo_placeholder.png")}
        style={{ width: "100%", height: 80, borderRadius: 12, backgroundColor: "#eee" }}
      />
      <Text style={{ marginTop: 8, fontWeight: "900", color: COLORS.ink, fontSize: 12 }} numberOfLines={2}>
        {item.title}
      </Text>
      <View
        style={{
          marginTop: 6,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900", color: COLORS.wine, fontSize: 12 }}>
          {money(item.price)}
        </Text>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: COLORS.wine,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>+</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SuggestionsRow({ items, onAdd }) {
  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontWeight: "900", color: COLORS.ink, fontSize: 14, marginBottom: 10 }}>
        También te puede gustar
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(it) => String(it._id)}
        renderItem={({ item }) => <SuggestionCard item={item} onAdd={onAdd} />}
      />
    </View>
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
  const { items, subtotal, inc, dec, remove, clear, add } = useCart();
  const { user, token } = useContext(AuthContext);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paying, setPaying] = useState(false);
const tabBarHeight = useBottomTabBarHeight();

  // ✅ Recomendaciones / cross-sell (Fase 1) -- mismas CrossSellRule que el
  // Kiosk, ruta pública (sin proxy, GET /api/cross-sell-rules/active).
  const [crossSellRules, setCrossSellRules] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const shownRuleIdsRef = useRef("");

  useEffect(() => {
    posFetch("/cross-sell-rules/active?channel=app")
      .then((data) => setCrossSellRules(Array.isArray(data?.rules) ? data.rules : []))
      .catch((e) => console.log("❌ cross-sell-rules:", e?.data || e?.message));

    getAppMenu()
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch((e) => console.log("❌ app-menu (cross-sell):", e?.data || e?.message));
  }, []);

  const suggestions = useMemo(
    () => matchCrossSellSuggestions(items, crossSellRules, catalog),
    [items, crossSellRules, catalog]
  );

  useEffect(() => {
    const key = suggestions.ruleIds.join(",");
    if (!key || key === shownRuleIdsRef.current) return;
    shownRuleIdsRef.current = key;

    postAppEvent("cross_sell_shown", token, {
      ruleId: suggestions.ruleIds[0],
      itemIds: suggestions.items.map((i) => i._id),
    });
  }, [suggestions, token]);

  const onAddSuggestion = useCallback(
    (item) => {
      add({
        ...item,
        basePrice: Number(item.price || 0),
        price: Number(item.price || 0),
        selectedOptions: { milk: null, temp: null, flavors: [] },
      });

      postAppEvent("cross_sell_accepted", token, {
        ruleId: suggestions.ruleIds[0],
        itemIds: [item._id],
        revenueImpact: Number(item.price || 0),
      });
    },
    [add, token, suggestions]
  );



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

  if (!token) {
    Alert.alert(
      "Inicia sesión para pagar",
      "Crea una cuenta gratuita para desbloquear esta función.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar sesión",
          onPress: () => navigation.navigate("AuthModal"),
        },
        {
          text: "Crear cuenta",
          onPress: () => navigation.navigate("AuthModal", { screen: "Register" }),
        },
      ]
    );
    return;
  }

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
      <View
  style={{
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 16,
    paddingBottom: tabBarHeight + 16,
  }}
>
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
          contentContainerStyle={{ paddingBottom: 40 }}
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

        <SuggestionsRow items={suggestions.items} onAdd={onAddSuggestion} />

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