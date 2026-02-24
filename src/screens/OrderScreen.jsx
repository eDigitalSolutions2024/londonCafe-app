import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import Screen from "../components/Screen";
import { getAppMenu } from "../api/appMenu";

import { useCart } from "../context/CartContext";

const COLORS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  border: "rgba(27,27,27,0.10)",
  wine: "#7A1E3A",
  wineSoft: "rgba(122,30,58,0.12)",
  green: "#3BAA35",
};

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function normalizeCategory(c) {
  const s = String(c || "").trim();
  return s || "General";
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

/** ✅ Card compacta tipo Caffenio (grid) */
function ProductTile({ item, onAdd }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 10,
        minHeight: 210,
      }}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={{ uri: item.imageUrl || "https://via.placeholder.com/300" }}
          style={{
            width: "100%",
            height: 120,
            borderRadius: 16,
            backgroundColor: "#eee",
          }}
          resizeMode="cover"
        />

        <Pressable
          onPress={() => onAdd(item)}
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
        {item.title}
      </Text>

      <Text style={{ marginTop: 6, fontWeight: "900", color: COLORS.wine }}>
        {money(item.price)}
      </Text>
    </View>
  );
}

/** ✅ Card tipo lista (list) */
function ProductRow({ item, onAdd }) {
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
        style={{ width: 70, height: 70, borderRadius: 14, backgroundColor: "#eee" }}
      />

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "900", color: COLORS.ink }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ marginTop: 4, fontWeight: "900", color: COLORS.wine }}>
          {money(item.price)}
        </Text>
      </View>

      <Pressable
        onPress={() => onAdd(item)}
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
    </View>
  );
}

export default function OrderScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  // si ya tienes carrito real, conecta esto a tu store/context
 const { cartCount, add } = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAppMenu({ active: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log(e);
      setItems([]);
      setError("No se pudo cargar el menú.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(items.map((x) => normalizeCategory(x.category)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((x) => {
      if (cat && normalizeCategory(x.category) !== cat) return false;
      return true;
    });
  }, [items, cat]);

  function onAdd(item) {
  add(item);
}

  const isGrid = viewMode === "grid";

  return (
    <Screen>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          {/* Top bar: titulo centrado + carrito */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ width: 44 }} />

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: COLORS.ink }}>
                Ordena y recoge
              </Text>

              <View
                style={{
                  marginTop: 6,
                  height: 3,
                  width: 76,
                  borderRadius: 999,
                  backgroundColor: COLORS.wine,
                }}
              />

              <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                Pide desde la app y recoge sin filas
              </Text>
            </View>

            <Pressable
              onPress={() => navigation?.navigate?.("Cart")}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 18 }}>🛒</Text>

              {cartCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: COLORS.wine,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 5,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
                    {cartCount > 99 ? "99+" : String(cartCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* ✅ FILA A: Categorías horizontal (full width) */}
          <View style={{ marginTop: 8 }}>
            <CategoryPillsHorizontal categories={categories} value={cat} onChange={setCat} />
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
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
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
      </View>
    </Screen>
  );
}