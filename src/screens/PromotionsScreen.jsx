import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function PromotionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Promociones</Text>
      <Text style={styles.text}>
        Aquí mostraremos las promos del día / temporada de LondonCafe.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  text: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
