import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export default function Screen({
  children,
  style,
  safeStyle,
  edges = ["top"], // ✅ SOLO top, para no duplicar laterales
}) {
  return (
    <SafeAreaView style={[styles.safe, safeStyle]} edges={edges}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16, // ✅ estándar más estable que 20
  },
});