import React from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import Screen from "../components/Screen";
import { useCart } from "../context/CartContext";

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

export default function CartScreen({ navigation }) {
  const { items, subtotal, inc, dec, remove, clear } = useCart();

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
            disabled={!items.length}
            onPress={() => {
              // aquí luego: ir a checkout/pago
            }}
            style={{
              marginTop: 12,
              height: 48,
              borderRadius: 16,
              backgroundColor: items.length ? COLORS.wine : "rgba(122,30,58,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}