import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { colors } from '../theme/colors';
import AvatarWidget from "../components/AvatarWidget";
import PointsStepperBar from "../components/PointsStepperBar";


export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTextBox}>
          <Text style={styles.subtitle}>Bienvenido a</Text>
          <Text style={styles.title}>LondonCafe</Text>
          <Text style={styles.description}>
            Café de especialidad, postres y el mejor ambiente para relajarte o trabajar.
          </Text>
        </View>
        <View style={{ marginTop: 14 }}>
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
          />
          <PointsStepperBar
            points={68}
            maxPoints={200}
            steps={[50, 100, 150, 200]}
            title="Puntos"
            subtitle="Rewards"
          />


        </View>

        {/* Si luego quieres, aquí va el logo o una imagen de café */}
        {/* <Image source={require('../../assets/coffee.png')} style={styles.heroImage} /> */}
      </View>

      {/* Sección rápida de accesos */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>¿Qué quieres hacer hoy?</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.actionTitle}>Menú</Text>
            <Text style={styles.actionSubtitle}>Bebidas & postres</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Promos')}
          >
            <Text style={styles.actionTitle}>Promos</Text>
            <Text style={styles.actionSubtitle}>Ofertas del día</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Ubicación')}
          >
            <Text style={styles.actionTitle}>Ubicación</Text>
            <Text style={styles.actionSubtitle}>¿Cómo llegar?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCardDisabled}
            disabled
          >
            <Text style={styles.actionTitle}>Ordenar</Text>
            <Text style={styles.actionSubtitle}>Próximamente</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
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
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  actionCardDisabled: {
    flex: 1,
    backgroundColor: '#121218',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a33',
    opacity: 0.6,
  },
  actionTitle: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
