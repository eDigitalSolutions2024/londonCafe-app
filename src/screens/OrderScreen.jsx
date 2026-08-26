import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Animated,
  TextInput,
  ScrollView,
} from "react-native";
import Screen from "../components/Screen";
import { getAppMenu } from "../api/appMenu";
import ReorderSection from "../components/ReorderSection";

import { useCart } from "../context/CartContext";
import { apiFetch } from "../api/client";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";


const COLORS = {
  bg: "#F7F7F7",
  card: "#FFFFFF",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  border: "rgba(27,27,27,0.10)",
  wine: "#7A1E3A",
  wineSoft: "rgba(122,30,58,0.12)",
  green: "#7A1E3A",
};

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function normalizeCategory(c) {
  const s = String(c || "").trim();
  return s || "General";
}


function hasChoices(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function getEnabledOptions(item) {
  const milk =
    item?.options?.milk?.enabled && hasChoices(item?.options?.milk?.choices);

  const temp =
    item?.options?.temp?.enabled && hasChoices(item?.options?.temp?.choices);

  const flavors =
    item?.options?.flavors?.enabled && hasChoices(item?.options?.flavors?.choices);

  return {
    milk,
    temp,
    flavors,
    hasAny: milk || temp || flavors,
  };
}

function getChoiceLabel(choice) {
  if (typeof choice === "string") return choice;
  return choice?.label || choice?.name || "";
}

function getChoiceExtra(choice) {
  if (typeof choice === "string") return 0;
  return Number(
    choice?.extraPrice ??
    choice?.price ??
    choice?.extra ??
    choice?.delta ??
    0
  );
}

function findSelectedChoice(choices = [], selectedValue) {
  return choices.find((choice) => getChoiceLabel(choice) === selectedValue) || null;
}

function calcConfiguredPrice(item, selectedOptions) {
  const base = Number(item?.price || 0);

  const milkChoice = findSelectedChoice(item?.options?.milk?.choices || [], selectedOptions?.milk);
  const tempChoice = findSelectedChoice(item?.options?.temp?.choices || [], selectedOptions?.temp);

  const flavorChoices = (item?.options?.flavors?.choices || []).filter((choice) =>
    (selectedOptions?.flavors || []).includes(getChoiceLabel(choice))
  );

  const milkExtra = getChoiceExtra(milkChoice);
  const tempExtra = getChoiceExtra(tempChoice);
  const flavorsExtra = flavorChoices.reduce((acc, choice) => acc + getChoiceExtra(choice), 0);

  return base + milkExtra + tempExtra + flavorsExtra;
}

/** ✅ Chips de categorías horizontal */
function CategoryPillsHorizontal({ categories, value, onChange }) {
  const data = useMemo(() => ["__ALL__", ...categories], [categories]);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(it) => String(it)}
      contentContainerStyle={{ paddingRight: 16 }}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => {
        const isAll = item === "__ALL__";
        const label = isAll ? "Todo" : item;
        const active = isAll ? !value : value === item;

        return (
          <Pressable
            onPress={() => onChange(isAll ? "" : active ? "" : item)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? COLORS.wineSoft : "#fff",
              borderWidth: 1,
              borderColor: active ? COLORS.wine : COLORS.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontWeight: "900", color: active ? COLORS.wine : COLORS.ink }}>
              {label}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

/** ✅ Card compacta tipo Caffenio (grid) -- toda la tarjeta agrega al
    carrito (o abre selección de leche/opciones si aplica), no solo el
    ícono "+", para que sea más fácil de tocar en una pantalla chica. */
function ProductTile({ item, onAdd }) {
  return (
    <Pressable
      onPress={(e) => onAdd(item, e)}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 10,
        minHeight: 210,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={item.imageUrl ? { uri: item.imageUrl } : require("../assets/promo_placeholder.png")}
          style={{
            width: "100%",
            height: 120,
            borderRadius: 16,
            backgroundColor: "#eee",
          }}
          resizeMode="cover"
        />

        <Pressable
          onPress={(e) => onAdd(item, e)}
          style={({ pressed }) => ({
            position: "absolute",
            right: 10,
            bottom: 10,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.wine }}>+</Text>
        </Pressable>
      </View>

      <Text
  numberOfLines={2}
  style={{
    marginTop: 10,
    fontWeight: "900",
    color: COLORS.ink,
    fontSize: 13,
  }}
>
  {(item.title || "").toUpperCase()}
</Text>

{item.description ? (
  <Text
    numberOfLines={2}
    style={{
      marginTop: 4,
      fontSize: 12,
      color: COLORS.muted,
      lineHeight: 16,
    }}
  >
    {item.description}
  </Text>
) : null}

<Text style={{ marginTop: 6, fontWeight: "900", color: COLORS.wine }}>
  {money(item.price)}
</Text>
    </Pressable>
  );
}

/** ✅ Card tipo lista (list) -- toda la fila agrega al carrito, no solo el
    círculo "+". */
function ProductRow({ item, onAdd }) {
  return (
    <Pressable
      onPress={(e) => onAdd(item, e)}
      style={({ pressed }) => ({
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 12,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Image
        source={item.imageUrl ? { uri: item.imageUrl } : require("../assets/promo_placeholder.png")}
        style={{ width: 70, height: 70, borderRadius: 14, backgroundColor: "#eee" }}
      />

      <View style={{ flex: 1 }}>
  <Text style={{ fontWeight: "900", color: COLORS.ink }} numberOfLines={2}>
    {(item.title || "").toUpperCase()}
  </Text>

  {item.description ? (
    <Text
      numberOfLines={2}
      style={{
        marginTop: 4,
        fontSize: 12,
        color: COLORS.muted,
        lineHeight: 16,
      }}
    >
      {item.description}
    </Text>
  ) : null}

  <Text style={{ marginTop: 6, fontWeight: "900", color: COLORS.wine }}>
    {money(item.price)}
  </Text>
</View>

      <Pressable
        onPress={(e) => onAdd(item, e)}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: COLORS.wine,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>+</Text>
      </Pressable>
    </Pressable>
  );
}

export default function OrderScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
    const [selectedItem, setSelectedItem] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  const [selectedMilk, setSelectedMilk] = useState(null);
const [selectedTemp, setSelectedTemp] = useState(null);
const [selectedFlavors, setSelectedFlavors] = useState([]);
const [activeOrdersCount, setActiveOrdersCount] = useState(0);
const [badgeScale] = useState(new Animated.Value(1));

const [showOrderBubble, setShowOrderBubble] = useState(false);
const [bubbleX] = useState(new Animated.Value(0));
const [bubbleY] = useState(new Animated.Value(0));
const [bubbleScale] = useState(new Animated.Value(1));
const [bubbleOpacity] = useState(new Animated.Value(0));

// ✅ Animación "se agregó al carrito": un bubble 🛒 que vuela desde donde
// tocaste (el producto, o el botón "Agregar" del modal de opciones) hasta
// el ícono del carrito -- confirmación visual de que sí se agregó, ya que
// ahora toda la tarjeta agrega (antes solo el ícono "+").
const cartIconRef = React.useRef(null);
const [addBubbleVisible, setAddBubbleVisible] = useState(false);
const [addBubbleOrigin, setAddBubbleOrigin] = useState({ x: 0, y: 0 });
const [addBubbleX] = useState(new Animated.Value(0));
const [addBubbleY] = useState(new Animated.Value(0));
const [addBubbleScale] = useState(new Animated.Value(1));
const [addBubbleOpacity] = useState(new Animated.Value(0));
const [cartBadgeScale] = useState(new Animated.Value(1));

const triggerAddBubble = useCallback((originX, originY) => {
  if (typeof originX !== "number" || typeof originY !== "number") return;
  if (!cartIconRef.current?.measureInWindow) return;

  cartIconRef.current.measureInWindow((cx, cy, cw, ch) => {
    setAddBubbleOrigin({ x: originX - 14, y: originY - 14 });
    setAddBubbleVisible(true);
    addBubbleX.setValue(0);
    addBubbleY.setValue(0);
    addBubbleScale.setValue(1);
    addBubbleOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(addBubbleX, {
        toValue: cx + cw / 2 - originX,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(addBubbleY, {
        toValue: cy + ch / 2 - originY,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(addBubbleScale, {
          toValue: 1.15,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(addBubbleScale, {
          toValue: 0.4,
          duration: 430,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(addBubbleOpacity, {
        toValue: 0,
        duration: 550,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAddBubbleVisible(false);
      cartBadgeScale.setValue(1);
      Animated.sequence([
        Animated.timing(cartBadgeScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.timing(cartBadgeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    });
  });
}, [addBubbleX, addBubbleY, addBubbleScale, addBubbleOpacity, cartBadgeScale]);

  // si ya tienes carrito real, conecta esto a tu store/context
 const { cartCount, add } = useCart();
 const { user } = useContext(AuthContext);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAppMenu({ active: true });
        //console.log("APP MENU FULL:", JSON.stringify(data, null, 2));
       /* console.log(
  "MILK OPTIONS:",
  JSON.stringify(data?.[0]?.options?.milk, null, 2)
);*/


      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log(e);
      setItems([]);
      setError("No se pudo cargar el menú.");
    } finally {
      setLoading(false);
    }
  }, []);




  const loadActiveOrdersCount = useCallback(async () => {
  try {
    const userId = user?._id || user?.id;

    if (!userId) {
      setActiveOrdersCount(0);
      return;
    }

    const data = await apiFetch(`/orders/my/${userId}`);

    if (!data?.ok) {
      setActiveOrdersCount(0);
      return;
    }

    const orders = Array.isArray(data.orders) ? data.orders : [];

    const count = orders.filter((o) =>
      ["pending", "sent_to_kitchen", "ready"].includes(o?.status)
    ).length;

    setActiveOrdersCount(count);
  } catch (e) {
    console.log("activeOrders error:", e);
    setActiveOrdersCount(0);
  }
}, [user]);

const playOrderBubbleAnimation = useCallback(() => {
  setShowOrderBubble(true);

  bubbleX.setValue(0);
  bubbleY.setValue(0);
  bubbleScale.setValue(1);
  bubbleOpacity.setValue(1);

  Animated.parallel([
    Animated.timing(bubbleX, {
      toValue: -150,
      duration: 850,
      useNativeDriver: true,
    }),
    Animated.timing(bubbleY, {
      toValue: -690,
      duration: 850,
      useNativeDriver: true,
    }),
    Animated.sequence([
      Animated.timing(bubbleScale, {
        toValue: 1.12,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleScale, {
        toValue: 0.72,
        duration: 670,
        useNativeDriver: true,
      }),
    ]),
  ]).start(() => {
    setShowOrderBubble(false);
    loadActiveOrdersCount();
  });
}, [bubbleOpacity, bubbleScale, bubbleX, bubbleY, loadActiveOrdersCount]);


  useEffect(() => {
  load();
  loadActiveOrdersCount();
}, [load, loadActiveOrdersCount]);

// 🔄 refrescar pedidos al volver
useEffect(() => {
  const unsub = navigation.addListener("focus", () => {
    loadActiveOrdersCount();
  });

  return unsub;
}, [navigation, loadActiveOrdersCount]);


useEffect(() => {
  if (route?.params?.playOrderBubble) {
    const timer = setTimeout(() => {
      playOrderBubbleAnimation();

      navigation.setParams({
        playOrderBubble: false,
      });
    }, 250);

    return () => clearTimeout(timer);
  }
}, [route?.params?.playOrderBubble, playOrderBubbleAnimation, navigation]);

// 🎬 animación del badge
useEffect(() => {
  if (activeOrdersCount > 0) {
    Animated.sequence([
      Animated.timing(badgeScale, {
        toValue: 1.25,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(badgeScale, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }
}, [activeOrdersCount, badgeScale]);

  const categories = useMemo(() => {
    const set = new Set(items.map((x) => normalizeCategory(x.category)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

 const filtered = useMemo(() => {
  const q = (search || "").trim().toLowerCase();

  return items
    .filter((x) => {
      if (cat && normalizeCategory(x.category) !== cat) return false;

      if (!q) return true;

      const title = String(x.title || "").toLowerCase();
      const description = String(x.description || "").toLowerCase();
      const category = String(x.category || "").toLowerCase();

      return (
        title.includes(q) ||
        description.includes(q) ||
        category.includes(q)
      );
    })
    .sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", "es", {
        sensitivity: "base",
      })
    );
}, [items, cat, search]);

  function onAdd(item, tapEvent) {
  const opts = getEnabledOptions(item);
  const origin = tapEvent?.nativeEvent
    ? { x: tapEvent.nativeEvent.pageX, y: tapEvent.nativeEvent.pageY }
    : null;

  if (!opts.hasAny) {
  add({
    ...item,
    basePrice: Number(item.price || 0),
    price: Number(item.price || 0),
    selectedOptions: {
      milk: null,
      temp: null,
      flavors: [],
    },
  });
  if (origin) triggerAddBubble(origin.x, origin.y);
  return;
}
  setSelectedMilk(null);
  setSelectedTemp(null);
  setSelectedFlavors([]);
  setSelectedItem(item);
  setShowOptions(true);
}


function closeOptionsModal() {
  setShowOptions(false);
  setSelectedItem(null);
  setSelectedMilk(null);
  setSelectedTemp(null);
  setSelectedFlavors([]);
}

function toggleFlavor(flavor) {
  const multiple = !!selectedItem?.options?.flavors?.multiple;

  if (!multiple) {
    setSelectedFlavors([flavor]);
    return;
  }

  setSelectedFlavors((prev) =>
    prev.includes(flavor)
      ? prev.filter((x) => x !== flavor)
      : [...prev, flavor]
  );
}
  const isGrid = viewMode === "grid";

  const configuredPrice = useMemo(() => {
  if (!selectedItem) return 0;

  return calcConfiguredPrice(selectedItem, {
    milk: selectedMilk,
    temp: selectedTemp,
    flavors: selectedFlavors,
  });
}, [selectedItem, selectedMilk, selectedTemp, selectedFlavors]);

  return (
    <Screen>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header -- compacto a propósito: lo que importa en esta pantalla
            es el catálogo y el carrito, no el encabezado. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          {/* Top bar: titulo centrado + carrito (el carrito es el botón más
              grande de la barra para que se encuentre de un vistazo). */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
  <View style={{ width: 56 }}>
  <Pressable
    onPress={() => navigation?.navigate?.("Pedidos")}
    style={({ pressed }) => ({
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      opacity: pressed ? 0.85 : 1,
      position: "relative",
    })}
  >
    <Text style={{ fontSize: 14 }}>📦</Text>

    {activeOrdersCount > 0 ? (
  <Animated.View
    style={{
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#B00020",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
      transform: [{ scale: badgeScale }],
    }}
  >
    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>
      {activeOrdersCount > 99 ? "99+" : activeOrdersCount}
    </Text>
  </Animated.View>
) : null}
  </Pressable>
</View>

  <View style={{ flex: 1, alignItems: "center" }}>
    <Text style={{ fontSize: 17, fontWeight: "900", color: COLORS.ink }}>
      Ordena y recoge
    </Text>

    <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
      Pide desde la app y recoge sin filas
    </Text>
  </View>

  <View style={{ width: 76, alignItems: "flex-end" }}>
    <Pressable
      ref={cartIconRef}
      onPress={() => navigation?.navigate?.("Cart")}
      style={({ pressed }) => ({
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.wine,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
        shadowColor: COLORS.wine,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      })}
    >
      <Text style={{ fontSize: 28 }}>🛒</Text>

      {cartCount > 0 ? (
        <Animated.View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#fff",
            borderWidth: 2,
            borderColor: COLORS.wine,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 5,
            transform: [{ scale: cartBadgeScale }],
          }}
        >
          <Text style={{ color: COLORS.wine, fontSize: 12, fontWeight: "900" }}>
            {cartCount > 99 ? "99+" : String(cartCount)}
          </Text>
        </Animated.View>
      ) : null}
    </Pressable>
  </View>
</View>

          {/* ✅ Vuelve a pedir -- movido de Home a esta pestaña */}
          <ReorderSection />

          {/* ✅ FILA A: Categorías horizontal (full width) */}
          <View style={{ marginTop: 8 }}>
            <CategoryPillsHorizontal categories={categories} value={cat} onChange={setCat} />
          </View>


          <View style={{ marginTop: 10 }}>
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      height: 46,
    }}
  >
    <Text style={{ fontSize: 16, marginRight: 8 }}>🔎</Text>

    <TextInput
      value={search}
      onChangeText={setSearch}
      placeholder="Buscar producto..."
      placeholderTextColor="rgba(27,27,27,0.45)"
      style={{
        flex: 1,
        color: COLORS.ink,
        fontSize: 14,
      }}
    />

    {search ? (
      <Pressable onPress={() => setSearch("")}>
        <Text style={{ fontSize: 16, color: COLORS.muted }}>✕</Text>
      </Pressable>
    ) : null}
  </View>
</View>

          {/* ✅ FILA B: Toggle + Actualizar (a la derecha) */}

          
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row" }}>
              <Pressable
                onPress={() => setViewMode("grid")}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: viewMode === "grid" ? COLORS.green : "#fff",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 15, color: viewMode === "grid" ? "#fff" : COLORS.ink }}>
                  ▦
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setViewMode("list")}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: viewMode === "list" ? COLORS.green : "#fff",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 15, color: viewMode === "list" ? "#fff" : COLORS.ink }}>
                  ≡
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={load}
              style={({ pressed }) => ({
                backgroundColor: COLORS.wine,
                paddingHorizontal: 14,
                height: 40,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontWeight: "900", color: "#fff" }}>
                {loading ? "..." : "Actualizar"}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View
              style={{
                marginTop: 12,
                backgroundColor: "rgba(176,0,32,0.08)",
                borderWidth: 1,
                borderColor: "rgba(176,0,32,0.15)",
                padding: 10,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#B00020", fontWeight: "900" }}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            key={isGrid ? "grid" : "list"}
            data={filtered}
            keyExtractor={(it) => String(it._id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            numColumns={isGrid ? 2 : 1}
            columnWrapperStyle={isGrid ? { gap: 12 } : undefined}
            renderItem={({ item }) =>
              isGrid ? (
                <View style={{ marginBottom: 12, flex: 1 }}>
                  <ProductTile item={item} onAdd={onAdd} />
                </View>
              ) : (
                <ProductRow item={item} onAdd={onAdd} />
              )
            }
            ListEmptyComponent={
              <View style={{ padding: 18, opacity: 0.75 }}>
                <Text style={{ color: COLORS.ink, fontWeight: "900" }}>
                  No hay items en el menú.
                </Text>
              </View>
            }
          />
        )}

               {showOptions && selectedItem ? (
  <View
     style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 95, // 👈 deja espacio para la barra inferior
    justifyContent: "flex-start",
  }}
  >
    <View
      style={{
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        maxHeight: "98%",
        backgroundColor: "#fff",
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.ink }}>
          Configurar producto
        </Text>

        <Text style={{ marginTop: 8, fontWeight: "700", color: COLORS.wine }}>
          {selectedItem.title}
        </Text>

        <Text style={{ marginTop: 4, color: COLORS.muted }}>
          Base: {money(selectedItem.price)}
        </Text>

        <Text style={{ marginTop: 6, fontWeight: "900", color: COLORS.wine, fontSize: 16 }}>
          Total: {money(configuredPrice || selectedItem.price)}
        </Text>

        {selectedItem?.options?.milk?.enabled &&
        Array.isArray(selectedItem?.options?.milk?.choices) &&
        selectedItem.options.milk.choices.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: "900", color: COLORS.ink, marginBottom: 8 }}>
              Tipo de leche
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedItem.options.milk.choices.map((choice, idx) => {
                const label = getChoiceLabel(choice);
                const extra = getChoiceExtra(choice);
                const active = selectedMilk === label;

                return (
                  <Pressable
                    key={`milk-${label}-${idx}`}
                    onPress={() => setSelectedMilk(label)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? COLORS.wine : COLORS.border,
                      backgroundColor: active ? COLORS.wineSoft : "#fff",
                    }}
                  >
                    <Text style={{ color: active ? COLORS.wine : COLORS.ink, fontWeight: "700" }}>
                      {label} {extra > 0 ? `(+${money(extra)})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {selectedItem?.options?.temp?.enabled &&
        Array.isArray(selectedItem?.options?.temp?.choices) &&
        selectedItem.options.temp.choices.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: "900", color: COLORS.ink, marginBottom: 8 }}>
              Temperatura
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedItem.options.temp.choices.map((choice, idx) => {
                const label = getChoiceLabel(choice);
                const extra = getChoiceExtra(choice);
                const active = selectedTemp === label;

                return (
                  <Pressable
                    key={`temp-${label}-${idx}`}
                    onPress={() => setSelectedTemp(label)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? COLORS.wine : COLORS.border,
                      backgroundColor: active ? COLORS.wineSoft : "#fff",
                    }}
                  >
                    <Text style={{ color: active ? COLORS.wine : COLORS.ink, fontWeight: "700" }}>
                      {label} {extra > 0 ? `(+${money(extra)})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {selectedItem?.options?.flavors?.enabled &&
        Array.isArray(selectedItem?.options?.flavors?.choices) &&
        selectedItem.options.flavors.choices.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: "900", color: COLORS.ink, marginBottom: 8 }}>
              Sabores
              {selectedItem?.options?.flavors?.multiple ? " (puedes elegir varios)" : ""}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedItem.options.flavors.choices.map((choice, idx) => {
                const label = getChoiceLabel(choice);
                const extra = getChoiceExtra(choice);
                const active = selectedFlavors.includes(label);

                return (
                  <Pressable
                    key={`flavor-${label}-${idx}`}
                    onPress={() => toggleFlavor(label)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? COLORS.wine : COLORS.border,
                      backgroundColor: active ? COLORS.wineSoft : "#fff",
                    }}
                  >
                    <Text style={{ color: active ? COLORS.wine : COLORS.ink, fontWeight: "700" }}>
                      {label} {extra > 0 ? `(+${money(extra)})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: 18,
            gap: 10,
          }}
        >
          <Pressable
            onPress={closeOptionsModal}
            style={{
              paddingHorizontal: 14,
              height: 40,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: COLORS.ink }}>Cancelar</Text>
          </Pressable>

          <Pressable
            onPress={(e) => {
              const originX = e?.nativeEvent?.pageX;
              const originY = e?.nativeEvent?.pageY;
              const needsMilk =
                selectedItem?.options?.milk?.enabled &&
                Array.isArray(selectedItem?.options?.milk?.choices) &&
                selectedItem.options.milk.choices.length > 0;

              const needsTemp =
                selectedItem?.options?.temp?.enabled &&
                Array.isArray(selectedItem?.options?.temp?.choices) &&
                selectedItem.options.temp.choices.length > 0;

              if (needsMilk && !selectedMilk) {
                alert("Selecciona el tipo de leche");
                return;
              }

              if (needsTemp && !selectedTemp) {
                alert("Selecciona la temperatura");
                return;
              }

              const finalPrice = calcConfiguredPrice(selectedItem, {
                milk: selectedMilk,
                temp: selectedTemp,
                flavors: selectedFlavors,
              });

              add({
                ...selectedItem,
                basePrice: Number(selectedItem.price || 0),
                price: finalPrice,
                selectedOptions: {
                  milk: selectedMilk,
                  temp: selectedTemp,
                  flavors: selectedFlavors,
                },
              });

              closeOptionsModal();
              if (typeof originX === "number") triggerAddBubble(originX, originY);
            }}
            style={{
              paddingHorizontal: 14,
              height: 40,
              borderRadius: 12,
              backgroundColor: COLORS.wine,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "900", color: "#fff" }}>Agregar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  </View>
) : null}



        {showOrderBubble ? (
  <Animated.View
    pointerEvents="none"
    style={{
      position: "absolute",
      bottom: 110,
      left: "50%",
      marginLeft: -26,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: COLORS.wine,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 5,
      opacity: bubbleOpacity,
      transform: [
        { translateX: bubbleX },
        { translateY: bubbleY },
        { scale: bubbleScale },
      ],
    }}
  >
    <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
      📦
    </Text>
  </Animated.View>
) : null}

{addBubbleVisible ? (
  <Animated.View
    pointerEvents="none"
    style={{
      position: "absolute",
      left: addBubbleOrigin.x,
      top: addBubbleOrigin.y,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.wine,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6,
      opacity: addBubbleOpacity,
      transform: [
        { translateX: addBubbleX },
        { translateY: addBubbleY },
        { scale: addBubbleScale },
      ],
    }}
  >
    <Text style={{ fontSize: 14 }}>🛒</Text>
  </Animated.View>
) : null}

      </View>
    </Screen>
  );
}