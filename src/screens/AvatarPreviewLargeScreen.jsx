import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Screen from "../components/Screen";
import AvatarPreview from "../components/AvatarPreview";
import { colors } from "../theme/colors";

export default function AvatarPreviewLargeScreen({ route, navigation }) {
  const avatarConfig = route?.params?.avatarConfig || {
    skin: "skin_01",
    hair: "hair_01",
    top: "top_01",
    bottom: "bottom_01",
    shoes: "shoes_01",
    accessory: null,
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Botón cerrar */}
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>

        {/* Avatar grande */}
        <View style={styles.center}>
          <View style={styles.avatarCircle}>
            <AvatarPreview config={avatarConfig} size={260} />
          </View>

          <Text style={styles.hint}>
            Mantén presionado el avatar para verlo en grande
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },

  closeBtn: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },

  closeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  hint: {
    marginTop: 16,
    fontSize: 12,
    color: colors.textMuted,
  },
});
