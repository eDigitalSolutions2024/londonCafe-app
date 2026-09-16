import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useStripe } from "@stripe/stripe-react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import { apiFetch } from "../api/client";

const money = (cents) => (Number(cents || 0) / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

const VIP_BENEFITS = [
  "Adopta y cuida tu mascota VIP",
  "Personaliza tu avatar 3D",
  "Minijuegos: Café Crush, Salto Café, Atrapa",
  "Acceso a estilos y objetos exclusivos",
];

/**
 * Tienda -- por ahora solo vende el Pase VIP (30 días). Reusa el mismo
 * patrón de pago que CartScreen.jsx: POST .../sheet arma el PaymentIntent
 * en el server (el precio SIEMPRE lo calcula el backend, nunca se confía
 * en un monto mandado por el cliente), initPaymentSheet+presentPaymentSheet
 * de Stripe cobra, y POST .../confirm re-verifica con Stripe antes de
 * activar el pase (ver payments.controller.js).
 */
export default function StoreScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [status, setStatus] = useState(null); // { active, expiresAt, priceCents, normalPriceCents, isLaunchPromo }
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/payments/vip-pass/status")
      .then((r) => setStatus(r))
      .catch((e) => console.log("❌ vip-pass/status:", e?.data || e?.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onBuy = async () => {
    try {
      setBuying(true);

      const sheet = await apiFetch("/payments/vip-pass/sheet", { method: "POST" });
      if (!sheet?.ok) throw new Error(sheet?.error || "No se pudo iniciar el pago.");

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "London Café",
        paymentIntentClientSecret: sheet.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: true,
      });
      if (initError) throw new Error(initError.message);

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        // Cancelado por el usuario -- no es un error real, no hay nada que avisar.
        if (payError.code === "Canceled") return;
        throw new Error(payError.message);
      }

      const confirm = await apiFetch("/payments/vip-pass/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentIntentId: sheet.paymentIntentId }),
      });
      if (!confirm?.ok) throw new Error(confirm?.error || "No se pudo activar el pase.");

      Alert.alert("¡Listo! 🎉", "Tu Pase VIP quedó activo por 30 días.");
      load();
    } catch (e) {
      Alert.alert("Error", e?.data?.error || e?.message || "No se pudo completar la compra.");
    } finally {
      setBuying(false);
    }
  };

  return (
    <Screen safeStyle={styles.safeDark}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Tienda</Text>
        <Text style={styles.sub}>Potencia tu experiencia en London Café</Text>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>⭐ PASE VIP</Text>
              {status?.isLaunchPromo && !status?.active ? (
                <Text style={styles.launchBadge}>Lanzamiento</Text>
              ) : null}
            </View>

            <Text style={styles.cardTitle}>30 días de acceso VIP completo</Text>

            <View style={{ marginTop: 12 }}>
              {VIP_BENEFITS.map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Text style={styles.benefitCheck}>✓</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {status?.active ? (
              <View style={styles.activeBanner}>
                <Text style={styles.activeBannerText}>
                  Ya tienes tu Pase VIP activo hasta el {formatDate(status.expiresAt)}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.priceRow}>
                  {status?.isLaunchPromo ? (
                    <Text style={styles.priceStrike}>{money(status.normalPriceCents)}</Text>
                  ) : null}
                  <Text style={styles.price}>{money(status?.priceCents ?? 4900)}</Text>
                </View>
                {status?.isLaunchPromo ? (
                  <Text style={styles.launchHint}>Precio de lanzamiento para tu 2° mes -- después vuelve a $49.00</Text>
                ) : null}

                <Pressable
                  style={[styles.buyBtn, buying && { opacity: 0.7 }]}
                  onPress={onBuy}
                  disabled={buying}
                >
                  <Text style={styles.buyBtnText}>{buying ? "Procesando..." : "Comprar Pase VIP"}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <Text style={styles.footerNote}>
          También puedes ser VIP acumulando 200 Buddy Coins en tus compras -- el Pase es solo un atajo opcional.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeDark: { backgroundColor: "#0b0709" },
  content: { padding: 20, paddingBottom: 40 },

  title: { color: "#fff", fontSize: 24, fontWeight: "900" },
  sub: { marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700", marginBottom: 18 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  launchBadge: {
    backgroundColor: "#4f9d69",
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "900",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  cardTitle: { marginTop: 10, color: "#111", fontSize: 18, fontWeight: "900" },

  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  benefitCheck: { color: colors.primary, fontWeight: "900", fontSize: 14 },
  benefitText: { color: "#333", fontSize: 13, fontWeight: "700" },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 16 },
  priceStrike: { color: colors.textMuted, fontSize: 16, fontWeight: "800", textDecorationLine: "line-through" },
  price: { color: colors.primary, fontSize: 30, fontWeight: "900" },
  launchHint: { marginTop: 2, color: colors.textMuted, fontSize: 11.5, fontWeight: "700" },

  buyBtn: { marginTop: 14, paddingVertical: 14, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center" },
  buyBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  activeBanner: {
    marginTop: 16,
    backgroundColor: "rgba(79,157,105,0.12)",
    borderRadius: 14,
    padding: 12,
  },
  activeBannerText: { color: "#2f6b45", fontSize: 13, fontWeight: "800", textAlign: "center" },

  footerNote: {
    marginTop: 16,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
});
