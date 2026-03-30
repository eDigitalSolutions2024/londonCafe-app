import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Screen from "../components/Screen";
import { AuthContext } from "../context/AuthContext";
import { apiFetch } from "../api/client";

const COLORS = {
  bg: "#F7F7F7",
  ink: "#1B1B1B",
  muted: "rgba(27,27,27,0.55)",
  border: "rgba(27,27,27,0.10)",
  wine: "#7A1E3A",
  wineSoft: "rgba(122,30,58,0.12)",
};

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function getStatusLabel(status) {
  if (status === "pending") return "Pedido recibido";
  if (status === "sent_to_kitchen") return "En preparación";
  if (status === "ready") return "Listo para recoger";
  if (status === "delivered") return "Entregado";
  return status || "Sin estatus";
}

export default function PedidosScreen() {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function loadOrders() {
    const userId = user?._id || user?.id;
    if (!userId) {
      setOrders([]);
      setError("No se pudo identificar al usuario.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/orders/my/${userId}`);
      if (!data?.ok) {
        throw new Error(data?.error || "No se pudieron cargar los pedidos.");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      console.log(e);
      setOrders([]);
      setError("No se pudieron cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [user?._id, user?.id]);

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <View style={{ marginBottom: 14 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              alignSelf: "flex-start",
              marginBottom: 14,
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

          <Text style={{ fontSize: 24, fontWeight: "900", color: COLORS.ink }}>
            Pedidos
          </Text>
          <Text style={{ marginTop: 8, color: COLORS.muted }}>
            Aquí aparecerán tus pedidos y su estatus.
          </Text>
        </View>

        <Pressable
          onPress={loadOrders}
          style={{
            alignSelf: "flex-start",
            marginBottom: 14,
            backgroundColor: COLORS.wine,
            paddingHorizontal: 14,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            Actualizar
          </Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={{ color: "#B00020", fontWeight: "700" }}>{error}</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => String(item._id)}
            renderItem={({ item }) => {
  const statusConfig = {
    pending: { label: "Pedido recibido", bg: "#F1F1F1", color: "#555" },
    sent_to_kitchen: { label: "En preparación", bg: "#FFF4E5", color: "#B26A00" },
    ready: { label: "Listo para recoger", bg: "#E3F2FD", color: "#1565C0" },
    delivered: { label: "Entregado", bg: "#E8F5E9", color: "#2E7D32" },
  };

  const status = statusConfig[item.status] || {
    label: item.status,
    bg: "#eee",
    color: "#333",
  };

  return (
    <Pressable
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,

        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {/* HEADER */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "900", fontSize: 16, color: COLORS.ink }}>
          Pedido #{String(item._id).slice(-6)}
        </Text>

        {/* STATUS */}
        <View
          style={{
            backgroundColor: status.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: status.color, fontWeight: "700", fontSize: 12 }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* FECHA */}
      <Text style={{ marginTop: 6, color: COLORS.muted, fontSize: 13 }}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>

      {/* DIVIDER */}
      <View
        style={{
          height: 1,
          backgroundColor: COLORS.border,
          marginVertical: 10,
        }}
      />

      {/* TOTAL */}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: COLORS.wine,
        }}
      >
        {money(item?.totals?.grandTotal || item?.totals?.subtotal || 0)}
      </Text>
    </Pressable>
  );
}}
            ListEmptyComponent={
              <Text style={{ color: COLORS.muted }}>
                Aún no tienes pedidos.
              </Text>
            }
          />
        )}
      </View>
    </Screen>
  );
}