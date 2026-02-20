import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Image, Pressable, ActivityIndicator } from "react-native";
import Screen from "../components/Screen";
import { getAppMenu } from "../api/appMenu";

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function Card({ item, onAdd }) {
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#111",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        marginBottom: 12,
      }}
    >
      {!!item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: "100%", height: 150, backgroundColor: "#222" }}
          resizeMode="cover"
        />
      )}

      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 }}>
            {item.title}
          </Text>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
            {money(item.price)}
          </Text>
        </View>

        {!!item.category && (
          <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
            {item.category}
          </Text>
        )}

        {!!item.description && (
          <Text style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
            {item.description}
          </Text>
        )}

        <Pressable
          onPress={() => onAdd(item)}
          style={{
            marginTop: 10,
            alignSelf: "flex-start",
            backgroundColor: "#fff",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontWeight: "800" }}>Agregar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function OrderScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      // trae solo activos
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

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((x) => {
      return (
        (x.title || "").toLowerCase().includes(t) ||
        (x.description || "").toLowerCase().includes(t) ||
        (x.category || "").toLowerCase().includes(t)
      );
    });
  }, [items, q]);

  function onAdd(item) {
    // siguiente paso: carrito
    console.log("ADD", item.title);
  }

  return (
    <Screen>
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>Ordena</Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar…"
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={{
            marginTop: 12,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            color: "#fff",
          }}
        />

        {error ? (
          <Text style={{ marginTop: 12, color: "#ffb4b4" }}>{error}</Text>
        ) : null}

        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={filtered}
            keyExtractor={(it) => it._id}
            renderItem={({ item }) => <Card item={item} onAdd={onAdd} />}
            ListEmptyComponent={
              <View style={{ padding: 18, opacity: 0.75 }}>
                <Text style={{ color: "#fff" }}>No hay items en el menú.</Text>
              </View>
            }
          />
        )}
      </View>
    </Screen>
  );
}
