import React from "react";
import { View, Text } from "react-native";
import Screen from "../components/Screen";

export default function ScanScreen() {
  return (
    <Screen>
      <View style={{ padding: 20 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
          Escanear (próximamente)
        </Text>
      </View>
    </Screen>
  );
}
