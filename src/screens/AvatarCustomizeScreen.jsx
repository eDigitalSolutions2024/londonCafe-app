import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Screen from "../components/Screen";
import { colors } from "../theme/colors";
import AvatarPreview from "../components/AvatarPreview";

const OPTIONS = {
  hair: ["hair_01", "hair_02", "hair_03"],
  top: ["top_01", "top_02", "top_03"],
  bottom: ["bottom_01", "bottom_02"],
  shoes: ["shoes_01", "shoes_02"],
};

export default function AvatarCustomizeScreen({ navigation }) {
  const [avatarConfig, setAvatarConfig] = useState({
    skin: "skin_01",
    hair: "hair_01",
    top: "top_01",
    bottom: "bottom_01",
    shoes: "shoes_01",
    accessory: null,
  });

  const setPart = (key, value) => {
    setAvatarConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Personalizar personaje</Text>
        <Text style={styles.subtitle}>
          Toca una opción para ver los cambios en tiempo real
        </Text>

        {/* Preview grande */}
        <View style={styles.previewBox}>
          <AvatarPreview config={avatarConfig} size={140} />
        </View>

        {/* Selectores */}
        {Object.entries(OPTIONS).map(([key, values]) => (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{labelMap[key]}</Text>

            <View style={styles.optionsRow}>
              {values.map((v) => {
                const active = avatarConfig[key] === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setPart(key, v)}
                    style={[
                      styles.optionBtn,
                      active && styles.optionBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {v.replace("_", " ")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Guardar */}
        <Pressable
          style={styles.saveBtn}
          onPress={() => {
            // ⛔ luego aquí mandaremos al backend
            navigation.goBack();
          }}
        >
          <Text style={styles.saveText}>Guardar cambios</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const labelMap = {
  hair: "Cabello",
  top: "Ropa",
  bottom: "Pantalón",
  shoes: "Zapatos",
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },

  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },

  previewBox: {
    alignItems: "center",
    marginBottom: 20,
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 8,
  },

  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  optionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  optionBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  optionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },

  optionTextActive: {
    color: "#fff",
  },

  saveBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
