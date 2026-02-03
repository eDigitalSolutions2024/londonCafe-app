import React from "react";
import { SafeAreaView, View, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

export default function Screen({ children, style, safeStyle }) {
  return (
    <SafeAreaView style={[styles.safe, safeStyle]}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background, // ✅ usa el mismo fondo que Home
  },
  container: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
});
