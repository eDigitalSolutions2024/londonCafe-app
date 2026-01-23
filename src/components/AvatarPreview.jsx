import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarAssets } from "../assets/avatarAssets";

function getAsset(id) {
  if (!id) return null;
  return avatarAssets[id] || null;
}

export default function AvatarPreview({ config = {}, size = 78 }) {
  // ✅ Lo único que importa ahorita:
  // Mongo guarda: avatarConfig.hair = "hair_05"
  const hairId = config?.hair || "hair_01";

  const avatarFull = getAsset(hairId);

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      {avatarFull ? (
        <Image
          source={avatarFull}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: "center", justifyContent: "center" },
});
