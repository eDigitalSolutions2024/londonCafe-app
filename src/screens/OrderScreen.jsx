import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import Screen from "../components/Screen";
import { getAppMenu } from "../api/appMenu";

const COLORS = {
  bg: "#F6F0EA",        // beige LondonBuddy
  card: "#ffffff",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  border: "rgba(27,27,27,0.10)",
  wine: "#7A1E3A",      // guinda
  wineSoft: "rgba(122,30,58,0.12)",
  chip: "rgba(27,27,27,0.06)",
};

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function normalizeCategory(c) {
  const s = String(c || "").trim();
  return s || "General";
}

function CategoryChips({ categories, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      <Pressable
        onPress={() => onChange("")}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: value ? COLORS.chip : COLORS.wineSoft,
          borderWidth: 1,
          borderColor: value ? "transparent" : COLORS.wine,
        }}
      >
        <Text style={{ fontWeight: "800", color: value ? COLORS.ink : COLORS.wine }}>
          Todo
        </Text>
      </Pressable>

      {categories.map((c) => {
        const active = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(active ? "" : c)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? COLORS.wineSoft : COLORS.chip,
              borderWidth: 1,
              borderColor: active ? COLORS.wine : "transparent",
            }}
          >
            <Text style={{ fontWeight: "800", color: active ? COLORS.wine : COLORS.ink }}>
              {c}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MenuCard({ item, onAdd }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      {!!item.imageUrl ? (
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: "100%", height: 165, backgroundColor: "#eee" }}
            resizeMode="cover"
          />

          {/* overlay suave */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 80,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          />

          {/* precio pill */}
          <View
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              backgroundColor: "rgba(255,255,255,0.92)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontWeight: "900", color: COLORS.ink }}>{money(item.price)}</Text>
          </View>
        </View>
      ) : null}

      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.ink, flex: 1 }}>
            {item.title}
          </Text>

          {!item.imageUrl ? (
            <Text style={{ fontSize: 14, fontWeight: "900", color: COLORS.ink }}>
              {money(item.price)}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!!item.category ? (
            <View
              style={{
                backgroundColor: COLORS.chip,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.ink }}>
                {item.category}
              </Text>
            </View>
          ) : null}

          {item.active === false ? (
            <View
              style={{
                backgroundColor: "rgba(255,0,0,0.08)",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#B00020" }}>
                Inactivo
              </Text>
            </View>
          ) : null}
        </View>

        {!!item.description ? (
          <Text style={{ marginTop: 8, color: COLORS.muted, fontSize: 13, lineHeight: 18 }}>
            {item.description}
          </Text>
        ) : null}

        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable
            onPress={() => onAdd(item)}
            style={({ pressed }) => ({
              backgroundColor: COLORS.wine,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Agregar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function OrderScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [cat, setCat] = useState("");

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(items.map((x) => normalizeCategory(x.category)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((x) => {
      if (cat && normalizeCategory(x.category) !== cat) return false;
      if (!t) return true;
      return (
        (x.title || "").toLowerCase().includes(t) ||
        (x.description || "").toLowerCase().includes(t) ||
        (x.category || "").toLowerCase().includes(t)
      );
    });
  }, [items, q, cat]);

  function onAdd(item) {
    // siguiente paso: carrito
    console.log("ADD", item.title);
  }

  return (
    <Screen>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.ink }}>
            Ordena y recoge
          </Text>
          <Text style={{ marginTop: 4, color: COLORS.muted, fontSize: 13 }}>
            Pide desde la app y pasa por tu orden en LondonCafe.
          </Text>

          {/* Search */}
          <View
            style={{
              marginTop: 12,
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar en el menú…"
              placeholderTextColor="rgba(27,27,27,0.35)"
              style={{ color: COLORS.ink, fontWeight: "700" }}
            />
          </View>

          {/* Category chips */}
          <CategoryChips categories={categories} value={cat} onChange={setCat} />

          {/* Actions */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
            <Pressable
              onPress={load}
              style={({ pressed }) => ({
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontWeight: "900", color: COLORS.ink }}>
                {loading ? "Cargando..." : "Actualizar"}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: "rgba(176,0,32,0.08)",
                borderWidth: 1,
                borderColor: "rgba(176,0,32,0.15)",
                padding: 10,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#B00020", fontWeight: "800" }}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* List */}
        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            data={filtered}
            keyExtractor={(it) => it._id}
            renderItem={({ item }) => <MenuCard item={item} onAdd={onAdd} />}
            ListEmptyComponent={
              <View style={{ padding: 18, opacity: 0.75 }}>
                <Text style={{ color: COLORS.ink, fontWeight: "800" }}>
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