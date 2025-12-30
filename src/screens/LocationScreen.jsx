import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function LocationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ubicación</Text>
      <Text style={styles.text}>
        Aquí podemos poner un mapa o al menos la dirección, horario y un botón para abrir Maps.
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
