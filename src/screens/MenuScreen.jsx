import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function MenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menú LondonCafe</Text>
      <Text style={styles.text}>
        Aquí luego mostraremos las bebidas, postres y comida, llamando al backend.
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
