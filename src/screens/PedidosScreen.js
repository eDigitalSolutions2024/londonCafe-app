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
  bg: "#FFFFFF",
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
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontWeight: "900", fontSize: 16, color: COLORS.ink }}>
                  Pedido #{String(item._id).slice(-6)}
                </Text>

                <Text style={{ marginTop: 6, color: COLORS.muted }}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>

                <Text style={{ marginTop: 8, color: COLORS.ink, fontWeight: "700" }}>
                  Total: {money(item?.totals?.grandTotal || item?.totals?.subtotal || 0)}
                </Text>

                <View
                  style={{
                    marginTop: 10,
                    alignSelf: "flex-start",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: COLORS.wineSoft,
                    borderWidth: 1,
                    borderColor: COLORS.wine,
                  }}
                >
                  <Text style={{ color: COLORS.wine, fontWeight: "900" }}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            )}
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