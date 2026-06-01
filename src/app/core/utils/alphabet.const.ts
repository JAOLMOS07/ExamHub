/**
 * Alfabeto canónico para etiquetar opciones de respuesta.
 *
 * Usado por:
 *   - El generador de PDF para imprimir las letras junto a las burbujas.
 *   - El modelo GradedExam.letters para validar las letras de un examen.
 *   - El motor OMR para mapear índices de columna → letra.
 *
 * Aunque ICFES estándar usa A-D (4 opciones), dejamos hasta Z por si
 * algún docente necesita más (raro pero posible). La hoja de respuestas
 * solo imprimirá las letras hasta `maxOptions`.
 */
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Devuelve la letra correspondiente al índice (0 → "A", 1 → "B", ...).
 * Tira si se pasa de Z.
 */
export function indexToLetter(index: number): string {
  if (index < 0 || index >= ALPHABET.length) {
    throw new RangeError(
      `Índice de opción fuera de rango (0..${ALPHABET.length - 1}): ${index}`
    );
  }
  return ALPHABET[index];
}

/**
 * Devuelve el índice de la letra ("A" → 0, "B" → 1, ...).
 * `null` si la letra no es válida.
 */
export function letterToIndex(letter: string): number | null {
  const idx = ALPHABET.indexOf(letter.toUpperCase());
  return idx === -1 ? null : idx;
}
