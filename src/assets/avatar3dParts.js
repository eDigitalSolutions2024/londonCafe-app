// Catálogo de partes del avatar 3D -- DEBE reflejar exacto lo que valida
// AVATAR3D_PART_IDS en londoncafe-api/src/controllers/me.controller.js.
// Actualizar los dos lados juntos si se agrega/quita algo.
//
// Cada parte es geometría 3D generada con código (ver Avatar3DViewer.jsx),
// no un modelo .glb -- por eso el catálogo es solo metadata para el picker
// (id, nombre, emoji para la miniatura), el "cómo se ve" vive en el visor.

export const HAIR_OPTIONS = [
  { id: "hair3d_01", label: "Corto", emoji: "💇" },
  { id: "hair3d_02", label: "Largo", emoji: "👩‍🦱" },
  { id: "hair3d_03", label: "Chongo", emoji: "🎀" },
  { id: "hair3d_04", label: "Rapado", emoji: "👨‍🦲" },
];

export const HEAD_OPTIONS = [
  { id: "head3d_01", label: "Redonda", emoji: "😊" },
  { id: "head3d_02", label: "Ovalada", emoji: "🙂" },
];

export const BODY_OPTIONS = [
  { id: "body3d_01", label: "Delgado", emoji: "🧍" },
  { id: "body3d_02", label: "Robusto", emoji: "🧍‍♂️" },
];

export const OUTFIT_OPTIONS = [
  { id: "outfit3d_01", label: "Playera", emoji: "👕" },
  { id: "outfit3d_02", label: "Hoodie", emoji: "🧥" },
  { id: "outfit3d_03", label: "Chamarra", emoji: "🧥" },
];

export const ACCESSORY_OPTIONS = [
  { id: null, label: "Ninguno", emoji: "✖️" },
  { id: "acc3d_01", label: "Lentes", emoji: "👓" },
  { id: "acc3d_02", label: "Gorra", emoji: "🧢" },
];

export const EYEBROW_OPTIONS = [
  { id: "eyebrow3d_01", label: "Recta", emoji: "➖" },
  { id: "eyebrow3d_02", label: "Arqueada", emoji: "〜" },
  { id: "eyebrow3d_03", label: "Gruesa", emoji: "▬" },
];

export const NOSE_OPTIONS = [
  { id: "nose3d_01", label: "Chica", emoji: "👃" },
  { id: "nose3d_02", label: "Marcada", emoji: "👃" },
];

export const MOUTH_OPTIONS = [
  { id: "mouth3d_01", label: "Sonrisa", emoji: "🙂" },
  { id: "mouth3d_02", label: "Neutral", emoji: "😐" },
  { id: "mouth3d_03", label: "Sonrisón", emoji: "😄" },
];

// Poses/gestos -- variaciones simples de la posición de los brazos (sin
// segundo segmento tipo codo, a propósito: se pidió que esto quedara
// básico). Cada una define rotación en Z (abrir/cerrar hacia el cuerpo)
// y en X (subir/bajar hacia adelante) para cada brazo -- buildBody usa
// los mismos valores para calcular dónde cae la mano, así que cambiar
// la pose no necesita tocar nada más.
export const POSE_OPTIONS = [
  { id: "pose3d_01", label: "Normal", emoji: "🧍" },
  { id: "pose3d_02", label: "Manos en cintura", emoji: "🧍‍♀️" },
  { id: "pose3d_03", label: "Saludo", emoji: "🙋" },
  { id: "pose3d_04", label: "Pulgar arriba", emoji: "👍" },
  { id: "pose3d_05", label: "Paz ✌️", emoji: "✌️" },
  { id: "pose3d_06", label: "Manos atrás", emoji: "🙆" },
];

export const SKIN_COLORS = ["#f2d3b3", "#e0ac69", "#c68642", "#8d5524", "#5a3825"];
export const HAIR_COLORS = ["#1c1c1c", "#4a2c14", "#a35b2c", "#d9a441", "#b33951", "#3c3c8c"];
export const EYE_COLORS = ["#3a2418", "#1a1410", "#3a6ea8", "#3a7a4e", "#8a6a2a"];

// Tono de piel sugerido a partir de la foto: promedio de color de un
// recuadro central de la imagen, mapeado al SKIN_COLORS más cercano.
// Todo esto corre en el cliente -- la foto nunca se sube al backend.
export function nearestSkinColor(rgb) {
  const toRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  let best = SKIN_COLORS[0];
  let bestDist = Infinity;
  for (const hex of SKIN_COLORS) {
    const [r, g, b] = toRgb(hex);
    const d = (r - rgb.r) ** 2 + (g - rgb.g) ** 2 + (b - rgb.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = hex;
    }
  }
  return best;
}
