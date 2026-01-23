import React, { useEffect, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { colors } from "../theme/colors";
import Screen from "../components/Screen";
import { apiFetch } from "../api/client";
import { AuthContext } from "../context/AuthContext";

// Avatar + puntos
import AvatarWidget from "../components/AvatarWidget";
import PointsStepperBar from "../components/PointsStepperBar";

// ✅ Modal avatar grande
import AvatarPreview from "../components/AvatarPreview";

export default function HomeScreen({ navigation }) {
  const { signOut, user, token } = useContext(AuthContext);

  const [showAvatarPeek, setShowAvatarPeek] = useState(false);

  // ✅ puntos reales
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // ✅ AVATAR REAL DEL BACKEND (SIN DEFAULTS)
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);

  const fetchPoints = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingPoints(true);

      // ✅ GET /api/points/me
      const r = await apiFetch("/points/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPoints(Number(r?.points) || 0);
      setLifetimePoints(Number(r?.lifetimePoints) || 0);
    } catch (e) {
      console.log("❌ points/me:", e?.data || e?.message);
    } finally {
      setLoadingPoints(false);
    }
  }, [token]);

  // ✅ Traer /me para obtener avatarConfig real del backend
  const fetchMe = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingMe(true);

      const r = await apiFetch("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Preferimos el backend; si no viene, intentamos con el user del contexto
      const cfg = r?.user?.avatarConfig ?? user?.avatarConfig ?? null;
      setAvatarConfig(cfg);
    } catch (e) {
      console.log("❌ /me:", e?.data || e?.message);

      // fallback: lo que haya en el contexto (si existe)
      setAvatarConfig(user?.avatarConfig ?? null);
    } finally {
      setLoadingMe(false);
    }
  }, [token, user]);

  useEffect(() => {
    apiFetch("/health")
      .then((d) => console.log("✅ HEALTH OK:", d))
      .catch((e) => console.log("❌ HEALTH ERROR:", e?.data || e.message));
  }, []);

  // ✅ cada vez que abres Home, refresca puntos + perfil (avatar)
  useFocusEffect(
    useCallback(() => {
      fetchPoints();
      fetchMe();
    }, [fetchPoints, fetchMe])
  );

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingPoints || loadingMe}
            onRefresh={async () => {
              await fetchPoints();
              await fetchMe();
            }}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextBox}>
              <Text style={styles.subtitle}>Bienvenido a</Text>

              <View style={styles.titleRow}>
                <Text style={styles.title}>LondonCafe</Text>

                <TouchableOpacity
                  onPress={signOut}
                  activeOpacity={0.85}
                  style={styles.logoutBtn}
                >
                  <Text style={styles.logoutText}>Salir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Avatar + Puntos */}
          <View style={styles.avatarSection}>
            {/* ✅ NO mostrar avatar default: solo cuando ya existe avatarConfig real */}
            {avatarConfig ? (
              <AvatarWidget
                name="London Buddy"
                mood="Con energía"
                energy={80}
                avatarConfig={avatarConfig}
                onFeedCoffee={() => console.log("Dar café")}
                onFeedBread={() => console.log("Dar pan")}
                onAvatarPress={() => navigation.navigate("AccountSettings")}
                onAvatarLongPress={() => setShowAvatarPeek(true)}
                onAvatarPressOut={() => setShowAvatarPeek(false)}
              />
            ) : (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.primarySoft,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "800" }}>
                  Cargando avatar...
                </Text>
              </View>
            )}

            <PointsStepperBar
              points={points}
              maxPoints={200}
              steps={[50, 100, 150, 200]}
              title="Puntos"
              subtitle="Rewards"
            />

            {/* opcional: mostrar acumulados de por vida */}
            <Text style={styles.pointsMeta}>Acumulados: {lifetimePoints}</Text>
          </View>
        </View>

        {/* Promociones */}
        <View style={styles.promosSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Promociones</Text>
              <Text style={styles.sectionHint}>Novedades de LondonCafe</Text>
            </View>

            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => navigation.navigate("Promos")}
              activeOpacity={0.9}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {/* Card 1 */}
          <TouchableOpacity
            style={styles.promoCardV}
            onPress={() => navigation.navigate("Promos")}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80",
              }}
              style={styles.promoImageV}
            />

            <View style={styles.promoOverlayV}>
              <View style={styles.promoMetaRow}>
                <Text style={styles.promoBadge}>HOY</Text>
                <Text style={styles.promoTag}>⭐ Puntos x2</Text>
              </View>

              <Text style={styles.promoTitle} numberOfLines={1}>
                Doble puntos en bebidas calientes
              </Text>
              <Text style={styles.promoSubtitle} numberOfLines={1}>
                Válido de 4:00 pm a 8:00 pm
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2 */}
          <TouchableOpacity
            style={styles.promoCardV}
            onPress={() => navigation.navigate("Promos")}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=1200&q=80",
              }}
              style={styles.promoImageV}
            />

            <View style={styles.promoOverlayV}>
              <View style={styles.promoMetaRow}>
                <Text style={styles.promoBadge}>NUEVO</Text>
                <Text style={styles.promoTag}>☕ + 🍪</Text>
              </View>

              <Text style={styles.promoTitle} numberOfLines={1}>
                Combo café + snack
              </Text>
              <Text style={styles.promoSubtitle} numberOfLines={1}>
                Pregunta en barra por el combo
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3 */}
          <TouchableOpacity
            style={styles.promoCardV}
            onPress={() => navigation.navigate("Promos")}
            activeOpacity={0.9}
          >
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=80",
              }}
              style={styles.promoImageV}
            />

            <View style={styles.promoOverlayV}>
              <View style={styles.promoMetaRow}>
                <Text style={styles.promoBadge}>WEEK</Text>
                <Text style={styles.promoTag}>🎉 Evento</Text>
              </View>

              <Text style={styles.promoTitle} numberOfLines={1}>
                Tarde de juegos / comunidad
              </Text>
              <Text style={styles.promoSubtitle} numberOfLines={1}>
                Revisa horarios en Promos
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ✅ MODAL PEEK */}
      <Modal visible={showAvatarPeek} transparent animationType="fade">
        <View style={styles.peekBackdrop}>
          <View style={styles.peekCircle}>
            {avatarConfig ? <AvatarPreview config={avatarConfig} size={260} /> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingVertical: 30 },
  heroHeader: { marginBottom: 16 },
  heroTextBox: { marginBottom: 16 },

  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    marginTop: 4,
    flex: 1,
  },

  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },
  logoutText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  avatarSection: { marginTop: 14 },

  pointsMeta: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
  },

  promosSection: { paddingHorizontal: 20, paddingBottom: 24 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },

  sectionHint: { marginTop: 2, fontSize: 12, color: colors.textMuted },

  seeAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: "transparent",
  },
  seeAllText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },

  promoCardV: {
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.card,

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  promoImageV: { width: "100%", height: "100%" },

  promoOverlayV: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  promoMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  promoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    color: "#111",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  promoTag: { color: "#fff", fontWeight: "900", fontSize: 12 },

  promoTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 2,
  },

  promoSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 12 },

  peekBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  peekCircle: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
});
