import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from "react-native";
import PromoPlaceholder from "../assets/promo_placeholder.png";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { apiFetch } from "../api/client";
import { getAppMenu } from "../api/appMenu";

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function getChoiceLabel(choice) {
  if (typeof choice === "string") return choice;
  return choice?.label || choice?.name || "";
}

function getChoiceExtra(choice) {
  if (typeof choice === "string") return 0;
  return Number(choice?.extraPrice ?? choice?.price ?? choice?.extra ?? choice?.delta ?? 0);
}

function findSelectedChoice(choices = [], selectedValue) {
  return choices.find((c) => getChoiceLabel(c) === selectedValue) || null;
}

// Mismo cálculo que OrderScreen.jsx (options.milk/temp/flavors -> extra) --
// se duplica aquí en vez de importar porque OrderScreen.jsx no lo exporta;
// se necesita para recalcular el precio configurado del pedido histórico
// contra el catálogo vivo, por si los precios cambiaron desde entonces.
function calcConfiguredPrice(item, selectedOptions) {
  const base = Number(item?.price || 0);
  const milkChoice = findSelectedChoice(item?.options?.milk?.choices || [], selectedOptions?.milk);
  const tempChoice = findSelectedChoice(item?.options?.temp?.choices || [], selectedOptions?.temp);
  const flavorChoices = (item?.options?.flavors?.choices || []).filter((c) =>
    (selectedOptions?.flavors || []).includes(getChoiceLabel(c))
  );
  const milkExtra = getChoiceExtra(milkChoice);
  const tempExtra = getChoiceExtra(tempChoice);
  const flavorsExtra = flavorChoices.reduce((acc, c) => acc + getChoiceExtra(c), 0);
  return base + milkExtra + tempExtra + flavorsExtra;
}

// Order.items históricos no guardan un link a AppMenuItem (no existe
// appMenuItemId) -- se reconstruye por coincidencia de nameSnapshot contra
// el catálogo vivo (Fase 1, plan aprobado). Items sin match o agotados se
// omiten, nunca rompen la sección.
function matchOrderItemsToCatalog(orderItems, catalog) {
  const byTitle = new Map(catalog.map((c) => [String(c.title || "").trim().toLowerCase(), c]));
  const matched = [];
  const skippedNames = [];

  for (const it of orderItems || []) {
    const name = String(it?.nameSnapshot || it?.title || it?.name || "").trim();
    const catalogItem = byTitle.get(name.toLowerCase());

    if (!catalogItem || catalogItem.soldOut) {
      skippedNames.push(name || "Producto");
      continue;
    }

    matched.push({
      catalogItem,
      qty: Math.max(1, Number(it?.qty || 1)),
      selectedOptions: it?.selectedOptions || {},
    });
  }

  return { matched, skippedNames };
}

export default function ReorderSection() {
  const navigation = useNavigation();
  const { user, token } = useContext(AuthContext);
  const { add } = useCart();

  const [loading, setLoading] = useState(false);
  const [reorder, setReorder] = useState(null); // { matched, skippedNames } | null
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const userId = user?._id || user?.id;
    if (!token || !userId) {
      setReorder(null);
      return;
    }

    try {
      setLoading(true);

      const [ordersRes, catalog] = await Promise.all([
        apiFetch(`/orders/my/${userId}`),
        getAppMenu(),
      ]);

      const orders = Array.isArray(ordersRes?.orders) ? ordersRes.orders : [];
      const lastOrder = orders[0];
      const orderItems = Array.isArray(lastOrder?.items) ? lastOrder.items : [];

      if (!orderItems.length) {
        setReorder(null);
        return;
      }

      const { matched, skippedNames } = matchOrderItemsToCatalog(
        orderItems,
        Array.isArray(catalog) ? catalog : []
      );

      setReorder(matched.length ? { matched, skippedNames } : null);
    } catch (e) {
      console.log("❌ ReorderSection:", e?.data || e?.message);
      setReorder(null);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  const summaryLabel = useMemo(() => {
    if (!reorder) return "";
    return reorder.matched.map((m) => `${m.qty}× ${m.catalogItem.title}`).join(", ");
  }, [reorder]);

  const total = useMemo(() => {
    if (!reorder) return 0;
    return reorder.matched.reduce(
      (acc, m) => acc + m.qty * calcConfiguredPrice(m.catalogItem, m.selectedOptions),
      0
    );
  }, [reorder]);

  const onReorder = useCallback(() => {
    if (!reorder || adding) return;

    setAdding(true);
    try {
      for (const m of reorder.matched) {
        const price = calcConfiguredPrice(m.catalogItem, m.selectedOptions);
        for (let i = 0; i < m.qty; i++) {
          add({
            ...m.catalogItem,
            basePrice: Number(m.catalogItem.price || 0),
            price,
            selectedOptions: {
              milk: m.selectedOptions?.milk || null,
              temp: m.selectedOptions?.temp || null,
              flavors: Array.isArray(m.selectedOptions?.flavors) ? m.selectedOptions.flavors : [],
            },
          });
        }
      }

      if (reorder.skippedNames.length) {
        Alert.alert(
          "Algunos productos ya no están disponibles",
          `Agregamos el resto de tu pedido. No pudimos incluir: ${reorder.skippedNames.join(", ")}.`
        );
      }

      // "Cart" vive dentro del stack del tab "Ordena" (OrderStackNav, ver
      // App.js) -- ReorderSection corre dentro del stack de "Inicio", un tab
      // hermano, así que hay que navegar al tab y pasarle la pantalla
      // anidada, no solo el nombre de la pantalla.
      navigation.navigate("Ordena", { screen: "Cart" });
    } finally {
      setAdding(false);
    }
  }, [reorder, adding, add, navigation]);

  if (!token || loading || !reorder) return null;

  const thumbItem = reorder.matched[0]?.catalogItem;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Vuelve a pedir</Text>

      <View style={styles.card}>
        <Image
          source={thumbItem?.imageUrl ? { uri: thumbItem.imageUrl } : PromoPlaceholder}
          style={styles.thumb}
        />

        <View style={styles.info}>
          <Text style={styles.itemsLine} numberOfLines={1}>
            {summaryLabel}
          </Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>

        <TouchableOpacity
          onPress={onReorder}
          disabled={adding}
          activeOpacity={0.85}
          style={[styles.btn, adding && { opacity: 0.7 }]}
        >
          <Text style={styles.btnText}>{adding ? "..." : "Pedir de nuevo"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin padding horizontal propio -- vive dentro del header de OrderScreen.jsx,
  // que ya trae su paddingHorizontal:16.
  wrap: { marginTop: 4, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: "900", color: colors.text, marginBottom: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,
    padding: 8,
  },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f2f2f2" },
  info: { flex: 1 },
  itemsLine: { color: colors.text, fontWeight: "700", fontSize: 12 },
  total: { color: colors.primary, fontWeight: "900", fontSize: 13, marginTop: 1 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 11 },
});
