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

export interface SquareCandidate {
  cx: number;
  cy: number;
  area: number;
}

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Respaldo para ubicar las 4 fiduciales cuando la hoja no llena la
 * foto o está girada: toma los cuadrados sólidos más extremos en cada
 * diagonal y valida que formen un cuadrilátero con la proporción
 * esperada (ancho/alto entre centros de fiduciales) y tamaños parecidos.
 *
 * Devuelve null si la geometría no es creíble.
 */
export function pickCornerSquares(
  candidates: SquareCandidate[],
  expectedAspect: number,
  tolerance = 0.18
): Record<Corner, SquareCandidate> | null {
  // A baja resolución un cuadro relleno puede aparecer dos veces (borde
  // exterior e interior, mismo centro): se conserva el más grande.
  const merged: SquareCandidate[] = [];
  for (const c of [...candidates].sort((a, b) => b.area - a.area)) {
    if (!merged.some((m) => Math.hypot(m.cx - c.cx, m.cy - c.cy) < 4)) merged.push(c);
  }
  if (merged.length < 4) return null;
  const pick = (score: (c: SquareCandidate) => number) =>
    merged.reduce((best, c) => (score(c) > score(best) ? c : best));
  const corners = {
    tl: pick((c) => -(c.cx + c.cy)),
    br: pick((c) => c.cx + c.cy),
    tr: pick((c) => c.cx - c.cy),
    bl: pick((c) => c.cy - c.cx),
  };
  const list = Object.values(corners);
  if (new Set(list).size !== 4) return null;

  const areas = list.map((c) => c.area);
  if (Math.max(...areas) / Math.min(...areas) > 3) return null;

  const { tl, tr, bl, br } = corners;
  if (!(tr.cx > tl.cx && br.cx > bl.cx && bl.cy > tl.cy && br.cy > tr.cy)) return null;

  const dist = (a: SquareCandidate, b: SquareCandidate) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const w = (dist(tl, tr) + dist(bl, br)) / 2;
  const h = (dist(tl, bl) + dist(tr, br)) / 2;
  if (h === 0 || Math.abs(w / h - expectedAspect) > tolerance * expectedAspect) return null;
  return corners;
}
