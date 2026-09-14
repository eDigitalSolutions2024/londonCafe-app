// Definición de los 10 niveles de "Salto Café" (estilo Doodle Jump) --
// fase inicial, igual que Café Crush: se gana llegando a `targetHeight`
// (unidades subidas) antes de caerse de la pantalla. La dificultad sube
// con una meta más alta, plataformas más angostas (`platformWidth`) y
// más separadas entre sí (`gapMin`/`gapMax`) según el nivel.
export const DOODLE_LEVELS = [
  { level: 1, targetHeight: 1200, platformWidth: 74, gapMin: 70, gapMax: 100 },
  { level: 2, targetHeight: 1500, platformWidth: 70, gapMin: 75, gapMax: 105 },
  { level: 3, targetHeight: 1800, platformWidth: 66, gapMin: 78, gapMax: 110 },
  { level: 4, targetHeight: 2100, platformWidth: 62, gapMin: 80, gapMax: 115 },
  { level: 5, targetHeight: 2400, platformWidth: 60, gapMin: 82, gapMax: 118 },
  { level: 6, targetHeight: 2700, platformWidth: 58, gapMin: 84, gapMax: 120 },
  { level: 7, targetHeight: 3000, platformWidth: 56, gapMin: 86, gapMax: 122 },
  { level: 8, targetHeight: 3300, platformWidth: 54, gapMin: 88, gapMax: 124 },
  { level: 9, targetHeight: 3600, platformWidth: 52, gapMin: 90, gapMax: 126 },
  { level: 10, targetHeight: 4000, platformWidth: 50, gapMin: 92, gapMax: 128 },
];

export const MAX_DOODLE_LEVEL = DOODLE_LEVELS.length;

export function getDoodleLevel(n) {
  const clamped = Math.max(1, Math.min(MAX_DOODLE_LEVEL, Number(n) || 1));
  return DOODLE_LEVELS.find((l) => l.level === clamped) || DOODLE_LEVELS[0];
}
