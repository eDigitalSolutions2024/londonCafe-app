// Definición de los 10 niveles de "Barista Ninja" (estilo Fruit Ninja).
// Cada nivel tiene una meta de cortes (`targetSlices`) para ganar.
// La dificultad progresa aumentando la velocidad de lanzamiento,
// reduciendo el tiempo entre oleadas (`spawnIntervalMs`), lanzando más ítems
// a la vez (`maxSimultaneous`) e introduciendo bombas de vapor (`bombChance`)
// a partir del nivel 2.
export const NINJA_LEVELS = [
  { level: 1, targetSlices: 15, spawnIntervalMs: 1400, maxSimultaneous: 2, bombChance: 0, speedMult: 1.0 },
  { level: 2, targetSlices: 20, spawnIntervalMs: 1300, maxSimultaneous: 2, bombChance: 0.06, speedMult: 1.03 },
  { level: 3, targetSlices: 25, spawnIntervalMs: 1200, maxSimultaneous: 3, bombChance: 0.10, speedMult: 1.06 },
  { level: 4, targetSlices: 30, spawnIntervalMs: 1100, maxSimultaneous: 3, bombChance: 0.13, speedMult: 1.10 },
  { level: 5, targetSlices: 35, spawnIntervalMs: 1000, maxSimultaneous: 3, bombChance: 0.16, speedMult: 1.14 },
  { level: 6, targetSlices: 40, spawnIntervalMs: 950, maxSimultaneous: 4, bombChance: 0.19, speedMult: 1.18 },
  { level: 7, targetSlices: 45, spawnIntervalMs: 900, maxSimultaneous: 4, bombChance: 0.22, speedMult: 1.22 },
  { level: 8, targetSlices: 50, spawnIntervalMs: 850, maxSimultaneous: 4, bombChance: 0.25, speedMult: 1.26 },
  { level: 9, targetSlices: 55, spawnIntervalMs: 800, maxSimultaneous: 5, bombChance: 0.28, speedMult: 1.30 },
  { level: 10, targetSlices: 65, spawnIntervalMs: 750, maxSimultaneous: 5, bombChance: 0.32, speedMult: 1.35 },
];

export const MAX_NINJA_LEVEL = NINJA_LEVELS.length;

export function getNinjaLevel(n) {
  const clamped = Math.max(1, Math.min(MAX_NINJA_LEVEL, Number(n) || 1));
  return NINJA_LEVELS.find((l) => l.level === clamped) || NINJA_LEVELS[0];
}
