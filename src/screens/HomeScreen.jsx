import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';

import { colors } from '../theme/colors';
import Screen from '../components/Screen';
import { apiFetch } from '../api/client';
import { AuthContext } from "../context/AuthContext";

//Test
// Avatar + puntos
import AvatarWidget from "../components/AvatarWidget";
import PointsStepperBar from "../components/PointsStepperBar";

export default function HomeScreen({ navigation }) {
  const { signOut } = useContext(AuthContext);

  useEffect(() => {
    apiFetch("/health")
      .then((d) => console.log("✅ HEALTH OK:", d))
      .catch((e) => console.log("❌ HEALTH ERROR:", e?.data || e.message));
  }, []);

  return (
    <Screen>
      <ScrollView style={styles.container}>
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
              avatarConfig={{
                skin: "skin_01",
                hair: "hair_01",
                top: "top_01",
                bottom: "bottom_01",
                shoes: "shoes_01",
                accessory: null,
              }}
              onFeedCoffee={() => console.log("Dar café")}
              onFeedBread={() => console.log("Dar pan")}
              onAvatarDoubleTap={() => navigation.navigate("AccountSettings")}
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

    
        {/* Promociones (default por ahora) */}
          <View style={styles.promosSection}>
            <View style={styles.promosHeader}>
              <Text style={styles.sectionTitle}>Promociones</Text>
              <Text style={styles.sectionHint}>Novedades de LondonCafe</Text>
            </View>

            {/* Card 1 */}
            <TouchableOpacity
              style={styles.promoCard}
              onPress={() => navigation.navigate("Promos")}
              activeOpacity={0.9}
            >
              <View style={styles.promoTopRow}>
                <Text style={styles.promoBadge}>HOY</Text>
                <Text style={styles.promoTag}>⭐ Puntos x2</Text>
              </View>
              <Text style={styles.promoTitle}>Doble puntos en bebidas calientes</Text>
              <Text style={styles.promoDesc}>Acumula más rápido y canjea por productos gratis.</Text>
              <Text style={styles.promoFoot}>Válido de 4:00 pm a 8:00 pm</Text>
            </TouchableOpacity>

            {/* Card 2 */}
            <TouchableOpacity
              style={styles.promoCard}
              onPress={() => navigation.navigate("Promos")}
              activeOpacity={0.9}
            >
              <View style={styles.promoTopRow}>
                <Text style={styles.promoBadge}>NUEVO</Text>
                <Text style={styles.promoTag}>☕ + 🍪</Text>
              </View>
              <Text style={styles.promoTitle}>Combo café + snack</Text>
              <Text style={styles.promoDesc}>Elige cualquier café del día y un snack seleccionado.</Text>
              <Text style={styles.promoFoot}>Pregunta en barra por el combo</Text>
            </TouchableOpacity>

            {/* Card 3 */}
            <TouchableOpacity
              style={styles.promoCard}
              onPress={() => navigation.navigate("Promos")}
              activeOpacity={0.9}
            >
              <View style={styles.promoTopRow}>
                <Text style={styles.promoBadge}>WEEK</Text>
                <Text style={styles.promoTag}>🎉 Evento</Text>
              </View>
              <Text style={styles.promoTitle}>Tarde de juegos / comunidad</Text>
              <Text style={styles.promoDesc}>Ven con amigos, café y buena vibra (cupos limitados).</Text>
              <Text style={styles.promoFoot}>Revisa horarios en Promos</Text>
            </TouchableOpacity>
          </View>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  hero: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  heroTextBox: {
    marginBottom: 16,
  },
  subtitle: {
    color: colors.textMuted,   // 👈 ya no dorado
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
    flex: 1,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  heroButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 16,
  },

  avatarSection: {
    marginTop: 14,
  },

  quickActions: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },

  // ✅ Ajuste importante: wrap + gap + cards con minWidth
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },

  actionCard: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 160,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },

  actionCardSecondary: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 160,
    backgroundColor: '#2a2a33',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a33',
  },

  actionCardDisabled: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 160,
    backgroundColor: '#121218',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a33',
    opacity: 0.6,
  },

  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  }
,
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  promosSection: {
  paddingHorizontal: 20,
  paddingBottom: 24,
},

promosHeader: {
  marginBottom: 12,
},

sectionHint: {
  marginTop: 2,
  fontSize: 12,
  color: colors.textMuted,
},

promoCard: {
  backgroundColor: colors.card,
  borderRadius: 16,
  padding: 14,
  borderWidth: 1,
  borderColor: colors.primarySoft,
  marginBottom: 12,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
},

promoTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
},

promoBadge: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: colors.primarySoft,
  color: colors.primary,
  fontSize: 11,
  fontWeight: "800",
  letterSpacing: 0.4,
},

promoTag: {
  color: colors.primary,
  fontWeight: "700",
  fontSize: 12,
},

promoTitle: {
  color: colors.text,
  fontSize: 16,
  fontWeight: "800",
  marginBottom: 4,
},

promoDesc: {
  color: colors.textMuted,
  fontSize: 12,
  lineHeight: 16,
},

promoFoot: {
  marginTop: 10,
  color: colors.textMuted,
  fontSize: 11,
},

heroHeader: {
  marginBottom: 16,
},

titleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
},

logoutBtn: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.primarySoft,
  backgroundColor: "transparent",
},

logoutText: {
  color: colors.textMuted,
  fontSize: 12,
  fontWeight: "800",
},

});
