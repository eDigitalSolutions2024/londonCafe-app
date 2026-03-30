import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
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


function getStatusConfig(status) {
  if (status === "pending") {
    return { label: "Pedido recibido", bg: "#F1F1F1", color: "#555" };
  }
  if (status === "sent_to_kitchen") {
    return { label: "En preparación", bg: "#FFF4E5", color: "#B26A00" };
  }
  if (status === "ready") {
    return { label: "Listo para recoger", bg: "#E3F2FD", color: "#1565C0" };
  }
  if (status === "delivered") {
    return { label: "Entregado", bg: "#E8F5E9", color: "#2E7D32" };
  }
  return { label: status || "Sin estatus", bg: "#eee", color: "#333" };
}

function formatOrderItems(order) {
  if (Array.isArray(order?.items)) return order.items;
  if (Array.isArray(order?.products)) return order.products;
  return [];
}

export default function PedidosScreen() {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
const [showOrderModal, setShowOrderModal] = useState(false);

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
  const status = getStatusConfig(item.status);

  return (
    <Pressable
  onPress={() => {
    setSelectedOrder(item);
    setShowOrderModal(true);
  }}
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

      <Text
  style={{
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
  }}
>
  Toca para ver el detalle
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



      <Modal
  visible={showOrderModal}
  transparent
  animationType="fade"
  onRequestClose={() => {
    setShowOrderModal(false);
    setSelectedOrder(null);
  }}
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      padding: 18,
    }}
  >
    <View
      style={{
        maxHeight: "82%",
        backgroundColor: "#fff",
        borderRadius: 22,
        padding: 18,
      }}
    >
      {selectedOrder ? (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: COLORS.ink,
                }}
              >
                Pedido #{String(selectedOrder._id).slice(-6)}
              </Text>

              <Text style={{ marginTop: 4, color: COLORS.muted }}>
                {new Date(selectedOrder.createdAt).toLocaleString()}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setShowOrderModal(false);
                setSelectedOrder(null);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#F4F4F4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.ink }}>
                ×
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: getStatusConfig(selectedOrder.status).bg,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                color: getStatusConfig(selectedOrder.status).color,
                fontWeight: "800",
              }}
            >
              {getStatusConfig(selectedOrder.status).label}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 16,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <Text style={{ fontWeight: "900", color: COLORS.ink, marginBottom: 8 }}>
                Resumen
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: COLORS.muted }}>Subtotal</Text>
                <Text style={{ fontWeight: "800", color: COLORS.ink }}>
                  {money(selectedOrder?.totals?.subtotal || 0)}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: COLORS.muted }}>Impuestos</Text>
                <Text style={{ fontWeight: "800", color: COLORS.ink }}>
                  {money(selectedOrder?.totals?.tax || 0)}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.border,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.ink }}>Total</Text>
                <Text style={{ fontWeight: "900", color: COLORS.wine, fontSize: 18 }}>
                  {money(
                    selectedOrder?.totals?.grandTotal ||
                      selectedOrder?.totals?.subtotal ||
                      0
                  )}
                </Text>
              </View>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <Text style={{ fontWeight: "900", color: COLORS.ink, marginBottom: 10 }}>
                Productos
              </Text>

              {formatOrderItems(selectedOrder).length ? (
                formatOrderItems(selectedOrder).map((prod, idx) => {
                  const qty = Number(prod?.qty || prod?.quantity || 1);
                  const name =
                    prod?.nameSnapshot ||
                    prod?.title ||
                    prod?.name ||
                    "Producto";
                  const lineTotal =
                    prod?.lineTotal ??
                    (Number(prod?.unitPrice || prod?.price || 0) * qty);

                  return (
                    <View
                      key={`${name}-${idx}`}
                      style={{
                        paddingVertical: 10,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: COLORS.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text
                            style={{
                              fontWeight: "900",
                              color: COLORS.ink,
                              fontSize: 15,
                            }}
                          >
                            {qty} × {name}
                          </Text>

                          {prod?.milkType ? (
                            <Text style={{ marginTop: 4, color: COLORS.muted, fontSize: 12 }}>
                              Leche: {prod.milkType}
                            </Text>
                          ) : null}

                          {prod?.temp ? (
                            <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
                              Temperatura: {prod.temp}
                            </Text>
                          ) : null}

                          {Array.isArray(prod?.flavors) && prod.flavors.length > 0 ? (
                            <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
                              Sabores: {prod.flavors.join(", ")}
                            </Text>
                          ) : null}

                          {Array.isArray(prod?.modifiersApplied) &&
                          prod.modifiersApplied.length > 0 ? (
                            <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
                              Extras:{" "}
                              {prod.modifiersApplied
                                .map((m) => m?.name)
                                .filter(Boolean)
                                .join(", ")}
                            </Text>
                          ) : null}

                          {prod?.notes ? (
                            <Text style={{ marginTop: 2, color: COLORS.muted, fontSize: 12 }}>
                              Nota: {prod.notes}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={{ fontWeight: "900", color: COLORS.wine }}>
                          {money(lineTotal)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: COLORS.muted }}>
                  No hay detalle de productos disponible.
                </Text>
              )}
            </View>
          </ScrollView>
        </>
      ) : null}
    </View>
  </View>
</Modal>


    </Screen>
  );
}