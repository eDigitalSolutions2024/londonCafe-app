import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Image, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import Screen from "../components/Screen";
import { useCart } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useStripe } from "@stripe/stripe-react-native";
import { apiFetch, posFetch } from "../api/client"; // ✅ usa BASE_URL del client.js
import { getAppMenu } from "../api/appMenu";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLORS = {
  bg: "#0b0709",
  card: "#FFFFFF",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  // ✅ ink/muted arriba siguen siendo para texto DENTRO de tarjetas blancas
  // (CartItem, SuggestionCard) -- no tocarlos ahí. pageText/pageMuted son
  // solo para texto que vive directo sobre el fondo de página (ahora
  // oscuro), como el título "Tu carrito" o el subtotal.
  pageText: "#ffffff",
  pageMuted: "rgba(255,255,255,0.6)",
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
  // Antes era un techo fijo de 3 -- Math.min() de abajo solo puede BAJAR
  // este número, nunca subirlo, así que aunque una regla configurara
  // maxSuggestions más alto (ej. 6), nunca se mostraban más de 3. Se sube
  // el techo para que las reglas sí puedan mostrar más si así se
  // configuraron.
  let cap = 6;

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

        {item?.selectedOptions?.eggStyle ? (
          <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
            Huevo: {item.selectedOptions.eggStyle}
          </Text>
        ) : null}

        {item?.selectedOptions?.salsa ? (
          <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
            Salsa: {item.selectedOptions.salsa}
          </Text>
        ) : null}

        {Array.isArray(item?.selectedOptions?.toppings) &&
        item.selectedOptions.toppings.length > 0 ? (
          <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
            {/* ✅ agrupa duplicados: "Huevo, Huevo" -> "Huevo x2" */}
            Extras: {Object.entries(
              item.selectedOptions.toppings.reduce((acc, label) => {
                acc[label] = (acc[label] || 0) + 1;
                return acc;
              }, {})
            )
              .map(([label, qty]) => (qty > 1 ? `${label} x${qty}` : label))
              .join(", ")}
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
        width: 82,
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 6,
        marginRight: 7,
      }}
    >
      <Image
        source={item.imageUrl ? { uri: item.imageUrl } : require("../assets/promo_placeholder.png")}
        style={{ width: "100%", height: 46, borderRadius: 8, backgroundColor: "#eee" }}
      />
      <Text style={{ marginTop: 5, fontWeight: "900", color: COLORS.ink, fontSize: 9.5 }} numberOfLines={2}>
        {item.title}
      </Text>
      <View
        style={{
          marginTop: 4,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900", color: COLORS.wine, fontSize: 9.5 }}>
          {money(item.price)}
        </Text>
        <View
          style={{
            width: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: COLORS.wine,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>+</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SuggestionsRow({ items, onAdd }) {
  if (!items.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontWeight: "900", color: COLORS.pageText, fontSize: 14, marginBottom: 10 }}>
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

  // ✅ Cupón -- se valida directo contra el POS (posFetch, mismo patrón que
  // promos/cross-sell-rules) para mostrar el descuento de una vez, pero el
  // cobro real SIEMPRE lo recalcula el server en /payments/sheet (ver
  // payments.controller.js validateCouponServerSide) -- nunca se confía en
  // este preview para lo que de verdad se cobra.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountType, discountValue }
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [myCoupons, setMyCoupons] = useState([]); // cupones PERSONALES (ver GET /coupons/mine) -- se muestran solos, sin escribir código

  // ✅ Buddy Coins -- ANTES Ordena no tenía esto (solo Kiosk/Cobro sí).
  // Misma tasa (2 coins = $1 MXN) y mismo tope (nunca más de lo que
  // cubre el total ni más de lo que la cuenta tiene) que esos dos
  // canales -- el cálculo real/autoritativo lo hace el server en
  // /payments/sheet (payments.controller.js), esto es solo preview.
  const [useBuddyCoins, setUseBuddyCoins] = useState(false);
  const [buddyCoinsToRedeem, setBuddyCoinsToRedeem] = useState("");

  const loyaltyUserId = user?._id || user?.id || "";

  // RewardRule activa de Wallet V2: única fuente de la tasa de canje y del %
  // máximo del total que se puede pagar con BuddyCoins. Mientras carga se usa
  // el valor actual (50 centavos por coin, 30%); el server siempre decide.
  const [redeemRate, setRedeemRate] = useState({ centavosPerCoin: 50, maxRedeemPercent: 0.3 });
  useEffect(() => {
    if (!token) return;
    let alive = true;
    apiFetch("/points/reward-rule", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        const rr = r?.rewardRule?.redeemRate;
        if (alive && rr?.centavosPerCoin > 0) setRedeemRate({ centavosPerCoin: rr.centavosPerCoin, maxRedeemPercent: rr.maxRedeemPercent ?? 0.3 });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  const pesosPerCoin = redeemRate.centavosPerCoin / 100;

  useEffect(() => {
    if (!loyaltyUserId) {
      setMyCoupons([]);
      return;
    }
    let alive = true;
    posFetch(`/coupons/mine?loyaltyUserId=${encodeURIComponent(loyaltyUserId)}`)
      .then((r) => alive && setMyCoupons(r?.ok ? (r.coupons || []).filter((c) => c.status === "available") : []))
      .catch(() => alive && setMyCoupons([]));
    return () => {
      alive = false;
    };
  }, [loyaltyUserId]);

  // "free_beverage" (check-in de visitas): preview aproximado -- toma el
  // precio de la primera línea "Bebidas" del carrito tal cual (que ya
  // trae la leche horneada adentro, ver CartContext.js). El cobro real
  // SIEMPRE lo recalcula el server (payments.controller.js), que sí
  // separa la leche y la deja cobrándose aparte -- esto es solo estimado.
  const couponDiscountPreview = appliedCoupon
    ? appliedCoupon.discountType === "free_beverage"
      ? Number(items.find((it) => it.category === "Bebidas")?.price || 0)
      : appliedCoupon.discountType === "percent"
      ? (subtotal * Number(appliedCoupon.discountValue)) / 100
      : Number(appliedCoupon.discountValue)
    : 0;
  const estimatedTotalAfterCoupon = Math.max(0, subtotal - couponDiscountPreview);

  const availableBuddyCoins = Number(user?.points || 0);
  const maxBuddyCoinsByTotal = Math.floor((estimatedTotalAfterCoupon * redeemRate.maxRedeemPercent) / pesosPerCoin);
  const maxBuddyCoinsUsable = Math.max(0, Math.min(availableBuddyCoins, maxBuddyCoinsByTotal));
  const safeBuddyCoinsToRedeem = useMemo(() => {
    if (!useBuddyCoins) return 0;
    const raw = Number(buddyCoinsToRedeem || 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(Math.floor(raw), maxBuddyCoinsUsable);
  }, [buddyCoinsToRedeem, useBuddyCoins, maxBuddyCoinsUsable]);
  const buddyDiscountPreview = safeBuddyCoinsToRedeem * pesosPerCoin;

  const estimatedTotal = Math.max(0, estimatedTotalAfterCoupon - buddyDiscountPreview);

  const onApplyCoupon = async (codeOverride) => {
    const code = (codeOverride || couponInput).trim().toUpperCase();
    if (!code) return;
    try {
      setCouponBusy(true);
      setCouponError("");
      const r = await posFetch(`/coupons/${encodeURIComponent(code)}/validate?loyaltyUserId=${encodeURIComponent(loyaltyUserId)}`);
      if (!r?.ok) throw new Error(r?.error || "INVALID");

      // ✅ Aviso temprano si el cupón exige cierta cantidad de un producto
      // (ej. CREPAS2X1) -- el chequeo real/autoritativo sigue viviendo en
      // el servidor (/payments/sheet), esto es solo para no dejar que la
      // persona llegue hasta el botón de pagar sin saber por qué falla.
      const { requiresProductId, requiresQty, requiresProductName } = r.coupon || {};
      if (requiresProductId && requiresQty) {
        const qtyInCart = (items || []).reduce((sum, it) => {
          const id = String(it.productId || it._id || it.id || "");
          return id === String(requiresProductId) ? sum + Number(it.qty || 0) : sum;
        }, 0);
        if (qtyInCart < requiresQty) {
          setAppliedCoupon(null);
          setCouponError(
            requiresProductName
              ? `Necesitas ${requiresQty} ${requiresProductName} en tu carrito para usar este cupón.`
              : `Necesitas ${requiresQty} unidades del producto para usar este cupón.`
          );
          return;
        }
      }

      setAppliedCoupon(r.coupon);
    } catch (e) {
      const map = {
        NOT_FOUND: "Ese código no existe.",
        INACTIVE: "Ese cupón ya no está activo.",
        EXPIRED: "Ese cupón ya venció.",
        USAGE_LIMIT_REACHED: "Ese cupón ya se agotó.",
        ALREADY_USED_BY_USER: "Ya usaste ese cupón antes.",
        LOYALTY_ACCOUNT_REQUIRED: "Inicia sesión con tu cuenta para usar cupones.",
        NOT_YOUR_COUPON: "Ese cupón es para otra cuenta.",
      };
      setAppliedCoupon(null);
      setCouponError(map[e?.data?.error || e?.message] || "No se pudo aplicar el cupón.");
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

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
        selectedOptions: { milk: null, temp: null, flavors: [], toppings: [], eggStyle: null, salsa: null },
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
        couponCode: appliedCoupon?.code || undefined,
        loyaltyUserId: loyaltyUserId || undefined,
        buddyCoinsRedeemed: safeBuddyCoinsToRedeem || undefined,
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

// El total del pedido refleja lo que Stripe REALMENTE cobró (data.amount,
// en centavos, ya con el descuento del cupón aplicado por el server) en
// vez del subtotal crudo del cliente -- si no, el pedido quedaría
// registrado con el precio de ANTES del cupón.
const chargedTotal = Number.isFinite(data.amount) ? data.amount / 100 : subtotal;

const orderPayload = buildOrderPayload(
  items,
  chargedTotal,
  paymentIntentId,
  customerName,
  customerPhone,
  customerEmail
);

orderPayload.userId = finalUserId;

// Cupón usado -- se marca canjeado AHORA, ya que el pago de verdad se
// completó (antes de esto solo era un preview que no consumía nada). Si
// esto falla no se revierte el pago -- el cliente ya recibió su
// descuento, solo no queda registrado el canje (aceptable, no crítico).
if (appliedCoupon?.code) {
  posFetch(`/coupons/${encodeURIComponent(appliedCoupon.code)}/redeem`, {
    method: "POST",
    body: JSON.stringify({ loyaltyUserId: finalUserId, source: "app" }),
  }).catch((e) => console.log("⚠️ coupon redeem:", e?.data || e?.message));
}


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
    removeCoupon();
    setUseBuddyCoins(false);
    setBuddyCoinsToRedeem("");

navigation.navigate("Order", {
  playOrderBubble: true,
});
  } catch (e) {
   /* console.log("[CartScreen] ERROR:", e);
    console.log("[CartScreen] STATUS:", e?.status);
    console.log("[CartScreen] DATA:", e?.data);
*/
    // ✅ Cupón "2x1"-like que exige cierta cantidad de un producto (ej.
    // CREPAS2X1) -- mensaje claro en vez del código crudo del servidor.
    if (e?.data?.error === "COUPON_REQUIRES_PRODUCT_QTY") {
      const need = e?.data?.requiresQty;
      const name = e?.data?.requiresProductName;
      alert(
        need && name
          ? `Ese cupón necesita ${need} ${name} en tu carrito.`
          : "Ese cupón necesita más cantidad del producto en tu carrito."
      );
      return;
    }
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
    <Screen safeStyle={{ backgroundColor: COLORS.bg }}>
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
          backgroundColor: "rgba(122,30,58,0.35)",
        }}
      >
        <Text style={{ color: COLORS.pageText, fontWeight: "900" }}>Vaciar</Text>
      </Pressable>
    ) : (
      <View style={{ width: 82 }} />
    )}
  </View>

  <Text style={{ fontSize: 24, fontWeight: "900", color: COLORS.pageText }}>
    Tu carrito
  </Text>
  <Text style={{ marginTop: 6, color: COLORS.pageMuted }}>
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
        color: COLORS.pageText,
        fontSize: 18,
        textAlign: "center",
      }}
    >
      Tu carrito está vacío
    </Text>

    <Text
      style={{
        marginTop: 8,
        color: COLORS.pageMuted,
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
  {/* ✅ Cupones personales -- ver GET /coupons/mine, mismo patrón que el
      Kiosk (KioskOrderPage.tsx): si tienes alguno asignado, aparece solo
      aquí para tocar y aplicar, sin tener que copiar/escribir el código. */}
  {!appliedCoupon && myCoupons.length > 0 ? (
    <View style={{ marginBottom: 10 }}>
      {myCoupons.map((c) => (
        <Pressable
          key={c.code}
          onPress={() => onApplyCoupon(c.code)}
          disabled={couponBusy}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            // ✅ wineSoft (12% opacity) + texto wine oscuro se diseñó para
            // una tarjeta BLANCA -- sobre el fondo oscuro de la pantalla
            // (COLORS.bg) quedaba casi invisible ("casi no se ve"). Mismo
            // tratamiento que ya usa el botón "Aplicar": tinte más fuerte +
            // texto blanco, legible sobre negro.
            backgroundColor: "rgba(122,30,58,0.35)",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 12.5 }} numberOfLines={1}>
              🎟️ {c.title || c.code}
            </Text>
            <Text style={{ color: COLORS.pageMuted, fontWeight: "700", fontSize: 11, marginTop: 2 }}>
              {c.discountType === "free_beverage"
                ? "Bebida gratis"
                : `${c.discountType === "percent" ? `${c.discountValue}%` : money(c.discountValue)} de descuento`}
            </Text>
          </View>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11.5, backgroundColor: COLORS.wine, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
            Usar
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null}

  {/* ✅ Cupón */}
  {appliedCoupon ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(122,30,58,0.35)",
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 12.5, flex: 1 }} numberOfLines={1}>
        🎟️ {appliedCoupon.code}{appliedCoupon.title ? ` · ${appliedCoupon.title}` : ""}
      </Text>
      <Pressable onPress={removeCoupon} hitSlop={8}>
        <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 12.5 }}>Quitar</Text>
      </Pressable>
    </View>
  ) : (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
      <TextInput
        value={couponInput}
        onChangeText={(v) => { setCouponInput(v); setCouponError(""); }}
        placeholder="¿Tienes un cupón?"
        placeholderTextColor={COLORS.pageMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: COLORS.pageText,
          fontWeight: "700",
        }}
      />
      <Pressable
        onPress={() => onApplyCoupon()}
        disabled={!couponInput.trim() || couponBusy}
        style={{
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: couponInput.trim() && !couponBusy ? COLORS.wine : "rgba(122,30,58,0.35)",
        }}
      >
        {couponBusy ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12.5 }}>Aplicar</Text>
        )}
      </Pressable>
    </View>
  )}
  {couponError ? (
    <Text style={{ color: "#d9534f", fontWeight: "700", fontSize: 11.5, marginTop: -4, marginBottom: 10 }}>
      {couponError}
    </Text>
  ) : null}

  {/* ✅ Buddy Coins -- mismo patrón visual que Kiosk/Cobro */}
  {availableBuddyCoins > 0 ? (
    <View style={{ marginBottom: 10 }}>
      <Pressable
        onPress={() => setUseBuddyCoins((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: useBuddyCoins ? "rgba(122,30,58,0.35)" : "transparent",
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ color: COLORS.pageText, fontWeight: "800", fontSize: 12.5 }}>
          🪙 Usar mis Buddy Coins ({availableBuddyCoins} disponibles)
        </Text>
        <View
          style={{
            width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.wine,
            alignItems: "center", justifyContent: "center",
            backgroundColor: useBuddyCoins ? COLORS.wine : "transparent",
          }}
        >
          {useBuddyCoins ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>✓</Text> : null}
        </View>
      </Pressable>

      {useBuddyCoins ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <TextInput
            value={buddyCoinsToRedeem}
            onChangeText={(v) => setBuddyCoinsToRedeem(v.replace(/[^0-9]/g, ""))}
            placeholder={`Hasta ${maxBuddyCoinsUsable}`}
            placeholderTextColor={COLORS.pageMuted}
            keyboardType="number-pad"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: COLORS.pageText,
              fontWeight: "700",
            }}
          />
          <Pressable
            onPress={() => setBuddyCoinsToRedeem(String(maxBuddyCoinsUsable))}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(122,30,58,0.35)" }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>Máximo</Text>
          </Pressable>
        </View>
      ) : null}
      {safeBuddyCoinsToRedeem > 0 ? (
        <Text style={{ color: COLORS.pageMuted, fontWeight: "700", fontSize: 11.5, marginTop: 6 }}>
          {safeBuddyCoinsToRedeem} coins = {money(buddyDiscountPreview)} de descuento
        </Text>
      ) : null}
    </View>
  ) : null}

  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    }}
  >
    <View>
      {appliedCoupon || safeBuddyCoinsToRedeem > 0 ? (
        <>
          <Text style={{ color: COLORS.pageMuted, fontWeight: "700", fontSize: 12, textDecorationLine: "line-through" }}>
            {money(subtotal)}
          </Text>
          <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 22 }}>
            {money(estimatedTotal)}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: COLORS.pageMuted, fontWeight: "700" }}>Subtotal</Text>
          <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 22 }}>
            {money(subtotal)}
          </Text>
        </>
      )}
    </View>

    {!!items.length && (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: "rgba(122,30,58,0.35)",
        }}
      >
        <Text style={{ color: COLORS.pageText, fontWeight: "900", fontSize: 12 }}>
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