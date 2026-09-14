// Definición de los 10 niveles de "Salto Café" (estilo Doodle Jump) --
// fase inicial, igual que Café Crush: se gana llegando a `targetHeight`
// (unidades subidas) antes de caerse de la pantalla. La dificultad sube
// con una meta más alta, plataformas más angostas (`platformWidth`) y
// más separadas entre sí (`gapMin`/`gapMax`) según el nivel, y metiendo
// más plataformas QUEBRADIZAS (`breakableChance`, 0..1) -- se agrietan
// al primer rebote y se rompen (desaparecen) al segundo, así que no se
// pueden reusar para siempre como las normales.
export const DOODLE_LEVELS = [
  { level: 1, targetHeight: 1200, platformWidth: 74, gapMin: 70, gapMax: 100, breakableChance: 0 },
  { level: 2, targetHeight: 1500, platformWidth: 70, gapMin: 75, gapMax: 105, breakableChance: 0.08 },
  { level: 3, targetHeight: 1800, platformWidth: 66, gapMin: 78, gapMax: 110, breakableChance: 0.14 },
  { level: 4, targetHeight: 2100, platformWidth: 62, gapMin: 80, gapMax: 115, breakableChance: 0.18 },
  { level: 5, targetHeight: 2400, platformWidth: 60, gapMin: 82, gapMax: 118, breakableChance: 0.22 },
  { level: 6, targetHeight: 2700, platformWidth: 58, gapMin: 84, gapMax: 120, breakableChance: 0.26 },
  { level: 7, targetHeight: 3000, platformWidth: 56, gapMin: 86, gapMax: 122, breakableChance: 0.3 },
  { level: 8, targetHeight: 3300, platformWidth: 54, gapMin: 88, gapMax: 124, breakableChance: 0.34 },
  { level: 9, targetHeight: 3600, platformWidth: 52, gapMin: 90, gapMax: 126, breakableChance: 0.38 },
  { level: 10, targetHeight: 4000, platformWidth: 50, gapMin: 92, gapMax: 128, breakableChance: 0.42 },
];

export const MAX_DOODLE_LEVEL = DOODLE_LEVELS.length;

export function getDoodleLevel(n) {
  const clamped = Math.max(1, Math.min(MAX_DOODLE_LEVEL, Number(n) || 1));
  return DOODLE_LEVELS.find((l) => l.level === clamped) || DOODLE_LEVELS[0];
}
