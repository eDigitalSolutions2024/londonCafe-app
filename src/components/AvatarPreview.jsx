import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarAssets } from "../assets/avatarAssets";

function getAsset(id) {
  if (!id) return null;
  return avatarAssets[id] || null;
}

const OFFSETS = {
  skin:   { x: 0, y: 0, s: 1.15 },
  hair:   { x: 0, y: -6, s: 1.15 },
  top:    { x: 0, y: 2, s: 1.15 },
  bottom: { x: 0, y: 8, s: 1.15 },
  shoes:  { x: 0, y: 14, s: 1.15 },
  acc:    { x: 0, y: -2, s: 1.15 },
};

function Layer({ source, size, kind }) {
  if (!source) return null;
  const o = OFFSETS[kind] || { x: 0, y: 0, s: 1 };

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[
        styles.layer,
        {
          width: size,
          height: size,
          transform: [
            { translateX: o.x },
            { translateY: o.y },
            { scale: o.s },
          ],
        },
      ]}
    />
  );
}

export default function AvatarPreview({ config, size = 78 }) {
  const skin = getAsset(config?.skin);
  const bottom = getAsset(config?.bottom);
  const top = getAsset(config?.top);
  const shoes = getAsset(config?.shoes);
  const hair = getAsset(config?.hair);
  const accessory = getAsset(config?.accessory);

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
 
      <Layer source={top} size={size} kind="top" />
 
 
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: "relative" },
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
