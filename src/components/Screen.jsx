import React from "react";
import { SafeAreaView, View, StyleSheet } from "react-native";

export default function Screen({ children, style }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b0b0f", // pon el mismo fondo que usas
  },
  container: {
    flex: 1,
    paddingTop: 14, // 👈 aquí bajas TODO globalmente
    paddingHorizontal: 20,
  },
});
