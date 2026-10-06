/** "Lleno" si la intensidad media está por debajo de este umbral (0 = negro, 255 = blanco). */
export const FILL_THRESHOLD = 130;

/**
 * Decide qué burbuja de una fila está marcada a partir de su
 * intensidad media (0 = negro). Relativo al más oscuro de la fila para
 * tolerar iluminación desigual entre zonas de la foto.
 *
 * Devuelve el índice marcado, null si ninguna, o "MULTI" si hay más de
 * una claramente rellena.
 */
export function pickMarked(values: number[]): number | null | "MULTI" {
  if (values.length === 0) return null;
  const minV = Math.min(...values);
  const filled = values
    .map((v, idx) => ({ v, idx }))
    .filter((f) => f.v < FILL_THRESHOLD || f.v < minV + 25)
    .filter((f) => f.v < 180);
  if (filled.length === 0) return null;
  if (filled.length === 1) return filled[0].idx;
  const sorted = filled.slice().sort((a, b) => a.v - b.v);
  return sorted[1].v - sorted[0].v > 20 ? sorted[0].idx : "MULTI";
}
