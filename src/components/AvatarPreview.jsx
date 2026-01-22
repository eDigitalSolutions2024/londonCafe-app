import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarAssets } from "../assets/avatarAssets";

function getAsset(id) {
  if (!id) return null;
  return avatarAssets[id] || null;
}

const OFFSETS = {
  skin:      { x: 0, y: 0,  s: 1.15 },
  bottom:    { x: 0, y: 8,  s: 1.15 },
  shoes:     { x: 0, y: 14, s: 1.15 },
  top:       { x: 0, y: 2,  s: 1.15 },

  // 👇 opcional si algún día regresas a "hair" como estilo/forma
  hair:      { x: 0, y: -6, s: 1.15 },

  // ✅ nuevo overlay de color de pelo
  hairColor: { x: 0, y: -6, s: 1.15 },

  acc:       { x: 0, y: -2, s: 1.15 },
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

export default function AvatarPreview({ config = {}, size = 78 }) {
  // ✅ defaults para que siempre se vea algo
  const skinId = config.skin || "skin_01";
  const topId = config.top || "top_01";
  const bottomId = config.bottom || "bottom_01";
  const shoesId = config.shoes || "shoes_01";

  // ✅ color pelo (tu caso actual)
  const hairColorId = config.hairColor || "hairColor_01";

  // 👇 por si en el futuro regresas a peinados por "hair"
  const hairId = config.hair || null;

  // accessory: a veces guardas "acc_01" o null
  const accessoryId = config.accessory || null;

  const skin = getAsset(skinId);
  const bottom = getAsset(bottomId);
  const shoes = getAsset(shoesId);
  const top = getAsset(topId);

  const hairColor = getAsset(hairColorId);
  const hair = getAsset(hairId);

  // si tu asset se llama acc_01, aquí va a jalar
  const accessory = getAsset(accessoryId);

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      {/* ✅ Orden de capas (de atrás hacia adelante) */}
      <Layer source={skin} size={size} kind="skin" />
      <Layer source={bottom} size={size} kind="bottom" />
      <Layer source={shoes} size={size} kind="shoes" />
      <Layer source={top} size={size} kind="top" />

      {/* Si existe "hair" (forma), lo pintas */}
      <Layer source={hair} size={size} kind="hair" />

      {/* ✅ Tu overlay actual: hairColor */}
      <Layer source={hairColor} size={size} kind="hairColor" />

      <Layer source={accessory} size={size} kind="acc" />
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
