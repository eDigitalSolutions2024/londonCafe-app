import React, { useEffect, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
} from "react-native";

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
  // ✅ IMPORTANTE: tomar user del contexto
  const { signOut, user } = useContext(AuthContext);

  // ✅ Modal peek (mantener presionado)
  const [showAvatarPeek, setShowAvatarPeek] = useState(false);

  // ✅ Defaults + merge con lo guardado en user.avatarConfig
  const avatarConfig = useMemo(() => {
    const defaults = {
      skin: "skin_01",
      eyes: "eyes_01",
      hair: null, // por si después lo usas como "forma"
      hairColor: "hairColor_01", // ✅ tu caso actual
      top: "top_01",
      bottom: "bottom_01",
      shoes: "shoes_01",
      accessory: null,
    };

    return { ...defaults, ...(user?.avatarConfig || {}) };
  }, [user]);

  useEffect(() => {
    apiFetch("/health")
      .then((d) => console.log("✅ HEALTH OK:", d))
      .catch((e) => console.log("❌ HEALTH ERROR:", e?.data || e.message));
  }, []);

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
            <AvatarWidget
              name="London Buddy"
              mood="Con energía"
              energy={80}
              avatarConfig={avatarConfig}
              onFeedCoffee={() => console.log("Dar café")}
              onFeedBread={() => console.log("Dar pan")}
              // ✅ 1 tap -> settings
              onAvatarPress={() => navigation.navigate("AccountSettings")}
              // ✅ mantener presionado -> mostrar modal (peek)
              onAvatarLongPress={() => setShowAvatarPeek(true)}
              // ✅ soltar -> cerrar modal
              onAvatarPressOut={() => setShowAvatarPeek(false)}
            />

            <PointsStepperBar
              points={68}
              maxPoints={200}
              steps={[50, 100, 150, 200]}
              title="Puntos"
              subtitle="Rewards"
            />
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

      {/* ✅ MODAL PEEK (solo avatar; se cierra al soltar) */}
      <Modal visible={showAvatarPeek} transparent animationType="fade">
        <View style={styles.peekBackdrop}>
          <View style={styles.peekCircle}>
            <AvatarPreview config={avatarConfig} size={260} />
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

  // ✅ Peek modal styles
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
