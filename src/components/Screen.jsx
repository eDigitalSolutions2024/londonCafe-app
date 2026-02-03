import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export default function Screen({
  children,
  style,
  safeStyle,
  edges = ["top", "left", "right"], // ✅ recomendado con tab bar abajo
}) {
  const { top } = useSafeAreaInsets();

  // ✅ Ajuste fino: mínimo 6, máximo 12 (para que NO se vea exagerado)
  const padTop = Math.min(12, Math.max(6, Math.round(top * 0)));

  return (
    <SafeAreaView style={[styles.safe, safeStyle]} edges={edges}>
      <View style={[styles.container, { paddingTop: padTop }, style]}>
        {children}
      </View>
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
    paddingHorizontal: 20,
  },
});
