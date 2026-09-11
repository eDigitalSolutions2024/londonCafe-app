import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarAssets } from "../assets/avatarAssets";

function getAsset(id) {
  if (!id) return null;
  return avatarAssets[id] || null;
}

// Mantiene el MISMO contrato (config/size) desde siempre -- lo que cambió
// es de DÓNDE sale la imagen: si `config.avatar3dSnapshotUrl` viene (el
// PNG plano capturado del avatar 3D real, ver Avatar3DViewer.jsx +
// POST /me/avatar3d/snapshot), se usa esa. Si no (cuenta vieja que
// todavía no migró -- ventana corta durante el rollout, la migración es
// obligatoria), cae al PNG plano de `hair` de siempre como fallback
// transitorio, para no dejar espacios en blanco mientras se despliega.
export default function AvatarPreview({ config = {}, size = 78 }) {
  const snapshotUrl = config?.avatar3dSnapshotUrl;
  if (snapshotUrl) {
    return (
      <View style={[styles.stage, { width: size, height: size }]}>
        <Image source={{ uri: snapshotUrl }} resizeMode="contain" style={{ width: size, height: size }} />
      </View>
    );
  }

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
