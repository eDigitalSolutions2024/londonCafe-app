import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useStripe } from "@stripe/stripe-react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
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

// Próximamente en la Tienda -- adelanto de lo que se va a poder comprar
// después del Pase VIP (gorras/lentes/props para el avatar, ver
// investigación de categorías tipo Bitmoji/Roblox que sí pegan bien con
// el rig de Kenney). Todavía no se vende nada de esto, es solo el teaser.
const COMING_SOON = [
  { emoji: "🎩", label: "Gorras y sombreros" },
  { emoji: "☕", label: "Props para sostener" },
  { emoji: "✨", label: "Efectos de partículas" },
];

// Glow radial detrás de la corona -- mismo recurso visual que ya usa
// RegisterScreen.jsx (Glow), para que la Tienda se sienta parte de la
// misma familia visual en vez de una pantalla plana aparte.
function CrownGlow({ size = 130 }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="storeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffd977" stopOpacity="0.85" />
            <Stop offset="55%" stopColor="#ffd977" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#ffd977" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.46} fill="url(#storeGlow)" />
      </Svg>
    </View>
  );
}

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
  const tabBarHeight = useBottomTabBarHeight();
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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + tabBarHeight }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Tienda</Text>
        <Text style={styles.sub}>Potencia tu experiencia en London Café</Text>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.banner}>
              <CrownGlow />
              <Text style={styles.crown}>👑</Text>
              {status?.isLaunchPromo && !status?.active ? (
                <View style={styles.launchBadge}>
                  <Text style={styles.launchBadgeText}>🔥 Precio de lanzamiento</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.body}>
              <Text style={styles.badge}>PASE VIP</Text>
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
                    ✅ Ya tienes tu Pase VIP activo hasta el {formatDate(status.expiresAt)}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.priceRow}>
                    {status?.isLaunchPromo ? (
                      <Text style={styles.priceStrike}>{money(status.normalPriceCents)}</Text>
                    ) : null}
                    <Text style={styles.price}>{money(status?.priceCents ?? 4900)}</Text>
                    <Text style={styles.pricePeriod}>/ 30 días</Text>
                  </View>
                  {status?.isLaunchPromo ? (
                    <Text style={styles.launchHint}>Precio especial de tu 2° mes -- después vuelve a $49.00</Text>
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }, buying && { opacity: 0.7 }]}
                    onPress={onBuy}
                    disabled={buying}
                  >
                    <Text style={styles.buyBtnText}>{buying ? "Procesando..." : "✨ Comprar Pase VIP"}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>Próximamente</Text>
        <View style={styles.comingRow}>
          {COMING_SOON.map((c) => (
            <View key={c.label} style={styles.comingCard}>
              <Text style={styles.comingEmoji}>{c.emoji}</Text>
              <Text style={styles.comingLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

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
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.card,
    shadowColor: "#ffd977",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  banner: {
    height: 110,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  crown: { fontSize: 44 },
  launchBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#4f9d69",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  launchBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },

  body: { padding: 18 },
  badge: {
    alignSelf: "flex-start",
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardTitle: { marginTop: 4, color: "#111", fontSize: 19, fontWeight: "900" },

  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  benefitCheck: { color: colors.primary, fontWeight: "900", fontSize: 14 },
  benefitText: { color: "#333", fontSize: 13, fontWeight: "700" },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 18 },
  priceStrike: { color: colors.textMuted, fontSize: 16, fontWeight: "800", textDecorationLine: "line-through" },
  price: { color: colors.primary, fontSize: 34, fontWeight: "900" },
  pricePeriod: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  launchHint: { marginTop: 2, color: colors.textMuted, fontSize: 11.5, fontWeight: "700" },

  buyBtn: {
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buyBtnText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },

  activeBanner: {
    marginTop: 16,
    backgroundColor: "rgba(79,157,105,0.12)",
    borderRadius: 14,
    padding: 12,
  },
  activeBannerText: { color: "#2f6b45", fontSize: 13, fontWeight: "800", textAlign: "center" },

  sectionLabel: {
    marginTop: 26,
    marginBottom: 10,
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  comingRow: { flexDirection: "row", gap: 10 },
  comingCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  comingEmoji: { fontSize: 26, opacity: 0.7 },
  comingLabel: { marginTop: 6, color: "rgba(255,255,255,0.55)", fontSize: 10.5, fontWeight: "800", textAlign: "center" },

  footerNote: {
    marginTop: 20,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
});
