// Definición de los 10 niveles de Café Crush -- fase inicial. Cada nivel
// pide juntar `target` fichas usando como máximo `moves` movimientos
// (un movimiento = un intercambio que sí arma una combinación; los
// intercambios que no logran nada y regresan a su lugar no cuentan) Y
// dentro de `timeLimit` segundos -- lo que se acabe primero corta el
// nivel (doble presión, como algunos niveles de Candy Crush). `kinds`
// recorta cuántos sabores del set completo (KINDS en PetMatch3.jsx) están
// en juego -- menos sabores = más fácil encontrar combinaciones, más
// sabores = tablero más difícil de leer. La dificultad sube subiendo la
// meta, apretando movimientos Y tiempo relativo a esa meta, y metiendo
// más sabores según avanza.
export const MATCH3_LEVELS = [
  { level: 1, target: 15, moves: 20, timeLimit: 90, kinds: 4 },
  { level: 2, target: 20, moves: 19, timeLimit: 85, kinds: 4 },
  { level: 3, target: 25, moves: 18, timeLimit: 80, kinds: 5 },
  { level: 4, target: 30, moves: 18, timeLimit: 75, kinds: 5 },
  { level: 5, target: 35, moves: 17, timeLimit: 70, kinds: 5 },
  { level: 6, target: 42, moves: 17, timeLimit: 65, kinds: 6 },
  { level: 7, target: 48, moves: 16, timeLimit: 62, kinds: 6 },
  { level: 8, target: 55, moves: 16, timeLimit: 58, kinds: 6 },
  { level: 9, target: 62, moves: 15, timeLimit: 55, kinds: 6 },
  { level: 10, target: 70, moves: 15, timeLimit: 50, kinds: 6 },
];

export const MAX_MATCH3_LEVEL = MATCH3_LEVELS.length;

export function getMatch3Level(n) {
  const clamped = Math.max(1, Math.min(MAX_MATCH3_LEVEL, Number(n) || 1));
  return MATCH3_LEVELS.find((l) => l.level === clamped) || MATCH3_LEVELS[0];
}
