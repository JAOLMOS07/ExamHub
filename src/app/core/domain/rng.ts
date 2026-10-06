/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 *
 * Reemplaza a `Math.random` en todo lo que arma formas de examen:
 * con la misma semilla se obtiene exactamente el mismo orden de
 * preguntas y opciones, así que una forma se puede reimprimir o
 * auditar sin guardar la permutación completa.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla nueva (32 bits) para una forma recién creada. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fisher-Yates con el RNG dado. No muta la entrada. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
