/**
 * ========================================================================
 *  Layout canónico de la hoja de respuestas para OMR
 * ------------------------------------------------------------------------
 *  Este archivo es la FUENTE ÚNICA DE VERDAD de las posiciones (en pt
 *  del PDF) de:
 *
 *      - Las 4 marcas fiduciales
 *      - El QR
 *      - El título y datos del alumno
 *      - El grid de burbujas (cada burbuja es una coord absoluta)
 *
 *  Lo importa tanto el generador de PDF (para dibujar) como el motor
 *  OMR (para muestrear). Eso evita que las dos partes se desincronicen.
 *  Si cambiás cualquier número de acá, el OMR sigue funcionando — pero
 *  hay que regenerar los exámenes (las hojas viejas usan el layout
 *  anterior).
 *
 *  Sistema de coordenadas:
 *    Página A4 = 595 × 842 pt. Origen en la esquina superior izquierda.
 *    X crece hacia la derecha, Y crece hacia abajo.
 *
 *    La hoja de respuestas ocupa toda la página. Las fiduciales se
 *    colocan en las 4 esquinas DEL CONTENIDO útil (debajo del header
 *    global del documento, encima del margen inferior).
 * ========================================================================
 */

/** Dimensiones de la página A4 en puntos. */
export const PAGE_W_PT = 595;
export const PAGE_H_PT = 842;

/** Tamaño del lado de cada marca fiducial en puntos. */
export const FIDUCIAL_SIZE_PT = 24;

/**
 * Posiciones (esquina superior izquierda) de las 4 marcas fiduciales.
 *
 *   - X: 35pt del borde izquierdo / 535pt del borde izquierdo (= 60pt
 *        del derecho). Quedan dentro del margen útil para impresoras
 *        comunes (~5mm de margen ≈ 14pt) y bien lejos del contenido.
 *   - Y: 142pt (debajo del header global de 130pt + 12pt de aire) y
 *        750pt (encima del margen inferior de 60pt + 32pt para QR/info).
 *
 *  Si cambia FIDUCIAL_SIZE_PT, estas posiciones siguen siendo válidas
 *  porque están en la esquina del cuadrado. La "ubicación lógica" es
 *  el CENTRO, que se calcula con FIDUCIAL_CENTERS.
 */
export const FIDUCIAL_POSITIONS = {
  tl: { x: 35, y: 142 },
  tr: { x: 536, y: 142 },
  bl: { x: 35, y: 750 },
  br: { x: 536, y: 750 },
} as const;

/** Centros de los fiduciales (para targets del warp perspectivo). */
export const FIDUCIAL_CENTERS = {
  tl: {
    x: FIDUCIAL_POSITIONS.tl.x + FIDUCIAL_SIZE_PT / 2,
    y: FIDUCIAL_POSITIONS.tl.y + FIDUCIAL_SIZE_PT / 2,
  },
  tr: {
    x: FIDUCIAL_POSITIONS.tr.x + FIDUCIAL_SIZE_PT / 2,
    y: FIDUCIAL_POSITIONS.tr.y + FIDUCIAL_SIZE_PT / 2,
  },
  bl: {
    x: FIDUCIAL_POSITIONS.bl.x + FIDUCIAL_SIZE_PT / 2,
    y: FIDUCIAL_POSITIONS.bl.y + FIDUCIAL_SIZE_PT / 2,
  },
  br: {
    x: FIDUCIAL_POSITIONS.br.x + FIDUCIAL_SIZE_PT / 2,
    y: FIDUCIAL_POSITIONS.br.y + FIDUCIAL_SIZE_PT / 2,
  },
} as const;

/** Posición y tamaño del QR. Lo ponemos a la derecha del título, bien
 *  separado del fiducial top-right (que llega hasta y=166). */
export const QR_LAYOUT = {
  x: 460,
  y: 185,
  fit: 70,
} as const;

/** Y del título "Hoja de respuestas — Examen X". Centrado horizontalmente. */
export const TITLE_Y_PT = 195;

/** Y de la línea con "Nombre / Código". */
export const STUDENT_INFO_Y_PT = 250;

/** Y del primer renglón de burbujas (de la primer columna). */
export const FIRST_ROW_Y_PT = 295;

/** Alto vertical de cada renglón del grid. */
export const ROW_HEIGHT_PT = 24;

/** Cantidad máxima de renglones por columna (limita a 18 = 36 preguntas total
 *  con 2 columnas, suficiente para la mayoría de los exámenes ICFES). */
export const MAX_ROWS_PER_COLUMN = 18;

/** X donde arranca el LABEL del número de cada columna. */
export const COL_NUMBER_X = [50, 305] as const;

/** X del CENTRO de la primer burbuja (letra A) de cada columna. */
export const COL_FIRST_BUBBLE_CX = [95, 350] as const;

/** Separación horizontal entre centros de burbujas (A → B). */
export const BUBBLE_X_GAP_PT = 22;

/** Radio de cada burbuja en puntos (cuadro visual). El OMR muestrea
 *  un círculo más chico que esto para evitar el contorno. */
export const BUBBLE_RADIUS_PT = 7;

/** Radio interno para muestreo OMR. Menos que el visual para no caer
 *  sobre el contorno gris/negro. */
export const BUBBLE_SAMPLE_RADIUS_PT = 4.5;

/**
 * Devuelve el CENTRO (en pt del PDF) de la burbuja para una pregunta
 * dada y una letra dada.
 *
 * Esto es el punto de unión entre la generación del PDF y el muestreo
 * del OMR: ambos consumen este mismo cálculo.
 */
export function bubbleCenter(
  questionIndex: number,
  letterIndex: number,
  totalQuestions: number
): { x: number; y: number } {
  // Si la cantidad de preguntas es menor o igual al máximo de UNA
  // columna, usamos una sola columna. Si no, dividimos en dos.
  const colBreak = Math.min(
    MAX_ROWS_PER_COLUMN,
    Math.ceil(totalQuestions / 2)
  );
  const col = questionIndex < colBreak ? 0 : 1;
  const rowInCol = col === 0 ? questionIndex : questionIndex - colBreak;
  const x = COL_FIRST_BUBBLE_CX[col] + letterIndex * BUBBLE_X_GAP_PT;
  const y = FIRST_ROW_Y_PT + rowInCol * ROW_HEIGHT_PT;
  return { x, y };
}

/**
 * Devuelve la X del número (label) de una pregunta dada.
 */
export function numberLabelX(
  questionIndex: number,
  totalQuestions: number
): number {
  const colBreak = Math.min(
    MAX_ROWS_PER_COLUMN,
    Math.ceil(totalQuestions / 2)
  );
  const col = questionIndex < colBreak ? 0 : 1;
  return COL_NUMBER_X[col];
}

/**
 * Devuelve la Y del label de número de una pregunta dada. La alineamos
 * un poquito arriba del centro de la burbuja para que el texto quede
 * a la misma altura visual.
 */
export function rowLabelY(
  questionIndex: number,
  totalQuestions: number
): number {
  const colBreak = Math.min(
    MAX_ROWS_PER_COLUMN,
    Math.ceil(totalQuestions / 2)
  );
  const col = questionIndex < colBreak ? 0 : 1;
  const rowInCol = col === 0 ? questionIndex : questionIndex - colBreak;
  return FIRST_ROW_Y_PT + rowInCol * ROW_HEIGHT_PT - 5;
}
