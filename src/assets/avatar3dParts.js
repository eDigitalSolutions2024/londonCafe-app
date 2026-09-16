// Catálogo de partes del avatar 3D -- DEBE reflejar exacto lo que valida
// AVATAR3D_PART_IDS en londoncafe-api/src/controllers/me.controller.js.
// Actualizar los dos lados juntos si se agrega/quita algo.
//
// v2 (cambio grande): el cuerpo/cabeza/pelo ya NO es geometría generada
// por código (primitivas de three.js) -- se veía "gordo"/artificial sin
// importar cuánto se ajustara. Ahora es un modelo .glb real (Kenney "Mini
// Characters", CC0, ver londoncafe-api/public/avatar3d-assets/kenney/
// License.txt) cargado con GLTFLoader dentro del visor. A cambio de la
// personalización fina de antes (cejas/nariz/boca/tono de piel/pose por
// separado), ahora se elige UN personaje completo entre 12 variantes ya
// diseñadas por un artista -- mejor calidad visual, menos perillas.
export const API_STATIC_URL = "https://app.londoncafejrz.com";
const KENNEY_BASE = `${API_STATIC_URL}/avatar3d-assets/kenney`;

// Logo de London Café (mismo PNG que assets/icon.png, con transparencia)
// para estampar en el pecho del avatar -- ver Avatar3DViewer.jsx applyBrand().
export const BRAND_LOGO_URL = `${API_STATIC_URL}/avatar3d-assets/branding/logo.png`;

export const CHARACTER_OPTIONS = [
  { id: "kenney_male_a", label: "Chico A", glb: `${KENNEY_BASE}/character-male-a.glb`, preview: `${KENNEY_BASE}/Previews/character-male-a.png` },
  { id: "kenney_male_b", label: "Chico B", glb: `${KENNEY_BASE}/character-male-b.glb`, preview: `${KENNEY_BASE}/Previews/character-male-b.png` },
  { id: "kenney_male_c", label: "Chico C", glb: `${KENNEY_BASE}/character-male-c.glb`, preview: `${KENNEY_BASE}/Previews/character-male-c.png` },
  { id: "kenney_male_d", label: "Chico D", glb: `${KENNEY_BASE}/character-male-d.glb`, preview: `${KENNEY_BASE}/Previews/character-male-d.png` },
  { id: "kenney_male_e", label: "Chico E", glb: `${KENNEY_BASE}/character-male-e.glb`, preview: `${KENNEY_BASE}/Previews/character-male-e.png` },
  { id: "kenney_male_f", label: "Chico F", glb: `${KENNEY_BASE}/character-male-f.glb`, preview: `${KENNEY_BASE}/Previews/character-male-f.png` },
  { id: "kenney_female_a", label: "Chica A", glb: `${KENNEY_BASE}/character-female-a.glb`, preview: `${KENNEY_BASE}/Previews/character-female-a.png` },
  { id: "kenney_female_b", label: "Chica B", glb: `${KENNEY_BASE}/character-female-b.glb`, preview: `${KENNEY_BASE}/Previews/character-female-b.png` },
  { id: "kenney_female_c", label: "Chica C", glb: `${KENNEY_BASE}/character-female-c.glb`, preview: `${KENNEY_BASE}/Previews/character-female-c.png` },
  { id: "kenney_female_d", label: "Chica D", glb: `${KENNEY_BASE}/character-female-d.glb`, preview: `${KENNEY_BASE}/Previews/character-female-d.png` },
  { id: "kenney_female_e", label: "Chica E", glb: `${KENNEY_BASE}/character-female-e.glb`, preview: `${KENNEY_BASE}/Previews/character-female-e.png` },
  { id: "kenney_female_f", label: "Chica F", glb: `${KENNEY_BASE}/character-female-f.glb`, preview: `${KENNEY_BASE}/Previews/character-female-f.png` },
];

export const ACCESSORY_OPTIONS = [
  { id: null, label: "Ninguno", emoji: "✖️" },
  { id: "acc3d_01", label: "Lentes", emoji: "👓" },
  { id: "acc3d_02", label: "Gorra", emoji: "🧢" },
];

// Tono de piel REAL, independiente del personaje/outfit elegido en
// "Personaje" -- ver applySkinTint() en Avatar3DViewer.jsx. `color` es el
// tono objetivo (se le copian tono/saturación a los píxeles de piel de la
// textura, conservando su luminosidad original para no perder el
// sombreado). id=null significa "el tono de fábrica del personaje", sin
// recoloreo.
export const SKIN_TONE_OPTIONS = [
  { id: "a", label: "Claro", color: "#f5d7b5" },
  { id: "b", label: "Medio claro", color: "#e8be91" },
  { id: "c", label: "Apiñonado", color: "#d29b67" },
  { id: "d", label: "Moreno", color: "#a5683b" },
  { id: "e", label: "Moreno oscuro", color: "#6e3f1e" },
  { id: "f", label: "Tostado", color: "#dfab82" },
];
