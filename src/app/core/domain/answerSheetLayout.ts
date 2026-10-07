/**
 * ========================================================================
 *  Layout de la hoja de respuestas v2 — fuente única de verdad
 * ------------------------------------------------------------------------
 *  Lo consumen el generador de PDF (para dibujar) y el motor OMR (para
 *  muestrear). Coordenadas en pt de una página A4 (595 × 842), origen
 *  arriba a la izquierda.
 *
 *  Novedades frente a v1 (`omrLayout.const.ts`, 36 preguntas máx.):
 *    - Columnas dinámicas según cuántas letras tenga el examen.
 *    - Multipágina: cada página lleva sus fiduciales y su QR con el
 *      número de página, así se escanean en cualquier orden.
 *    - Bloque de código del estudiante en burbujas (0–9) para
 *      identificarlo automáticamente contra el listado del colegio.
 *
 *  Las fiduciales quedan en las MISMAS posiciones que v1, así que el
 *  warp perspectivo del OMR es idéntico para ambas versiones.
 *
 *  Si cambiás un número de acá, las hojas ya impresas dejan de leerse:
 *  en ese caso subí `SHEET_LAYOUT_VERSION` y conservá el layout viejo.
 * ========================================================================
 */

import {
  BUBBLE_RADIUS_PT,
  BUBBLE_SAMPLE_RADIUS_PT,
  FIDUCIAL_POSITIONS,
  FIDUCIAL_SIZE_PT,
  bubbleCenter,
  numberLabelX,
  rowLabelY,
} from "../utils/omrLayout.const";

export const SHEET_LAYOUT_VERSION = 3;

export const SHEET_V2 = {
  pageW: 595,
  pageH: 842,
  fiducialSize: FIDUCIAL_SIZE_PT,
  fiducials: FIDUCIAL_POSITIONS,
  contentLeft: 62,
  contentRight: 530,
  titleY: 174,
  qr: { x: 468, y: 170, fit: 62 },
  nameY: 200,
  groupY: 216,
  codeLabelY: 236,
  codeBoxY: 248,
  codeBoxSize: 12,
  codeFirstRowY: 272,
  codeRowStep: 11.5,
  codeColStep: 14,
  codeFirstX: 72,
  maxCodeDigits: 10,
  gridTopWithCode: 400,
  gridTopNoCode: 250,
  gridBottom: 738,
  rowStep: 16,
  numberWidth: 22,
  bubbleStep: 15,
  colGap: 12,
  bubbleR: 5.5,
  sampleR: 3.5,
} as const;

/**
 * Geometría v3 (hojas personalizadas): QR más grande (más fácil de leer
 * con el celular), cabecera con el nombre del estudiante y el recuadro
 * de la forma. Fiduciales, burbujas y paso de filas son los de v2; solo
 * cambia dónde empieza la grilla y la zona del código.
 */
export const SHEET_V3 = {
  ...SHEET_V2,
  titleY: 172,
  qr: { x: 444, y: 168, fit: 86 },
  formBox: { x: 378, y: 170, w: 56, h: 48 },
  nameLabelY: 194,
  nameY: 204,
  groupY: 226,
  instructionsY: 259,
  codeLabelY: 266,
  codeBoxY: 278,
  codeFirstRowY: 302,
  gridTopWithCode: 428,
  gridTopNoCode: 280,
} as const;

export type SheetGeometry = typeof SHEET_V2 | typeof SHEET_V3;

export function sheetGeometry(version: number | undefined): SheetGeometry {
  return version === 3 ? SHEET_V3 : SHEET_V2;
}

export interface Point {
  x: number;
  y: number;
}

export interface SheetQuestion {
  /** Índice global de la pregunta (0-based). */
  index: number;
  /** Posición del número impreso (esquina superior izquierda del texto). */
  numberPos: Point;
  /** Centros de las burbujas (A, B, C…). Vacío = pregunta sin burbujas. */
  bubbles: Point[];
}

export interface SheetPage {
  /** 1-based. */
  page: number;
  totalPages: number;
  questions: SheetQuestion[];
  /** Una columna por dígito; cada una con 10 burbujas (0..9). */
  codeColumns: Point[][];
  bubbleR: number;
  sampleR: number;
  /** Geometría con la que se dibuja la cabecera (2 o 3). */
  geometry: 2 | 3;
}

export interface SheetLayout {
  version: 1 | 2 | 3;
  letterCount: number;
  codeDigits: number;
  rowsPerColumn: number;
  columns: number;
  pages: SheetPage[];
}

export interface SheetLayoutSpec {
  /** Letras por pregunta (0 = abierta/numérica: sin burbujas). */
  questionLetters: number[];
  /** Máximo de letras del examen (define el ancho de columna). */
  letterCount: number;
  codeDigits: number;
  /**
   * Reparte las preguntas de cada página en columnas parejas (con al
   * menos MIN_BALANCED_ROWS filas) en vez de llenar la primera columna
   * hasta abajo. Las evaluaciones generadas antes de esta opción no la
   * tienen y conservan su geometría (sus hojas impresas se siguen leyendo).
   */
  balanced?: boolean;
  /** Geometría (2 por defecto, para hojas ya impresas). */
  geometry?: 2 | 3;
}

/** Filas mínimas por columna en el modo balanceado. */
export const MIN_BALANCED_ROWS = 10;

export function columnWidth(letterCount: number): number {
  return SHEET_V2.numberWidth + letterCount * SHEET_V2.bubbleStep + SHEET_V2.colGap;
}

export function computeSheetLayout(spec: SheetLayoutSpec): SheetLayout {
  const geometry = spec.geometry === 3 ? 3 : 2;
  const G = sheetGeometry(geometry);
  const letterCount = Math.max(2, spec.letterCount);
  const codeDigits = Math.min(
    SHEET_V2.maxCodeDigits,
    Math.max(0, Math.floor(spec.codeDigits))
  );
  const gridTop = codeDigits > 0 ? G.gridTopWithCode : G.gridTopNoCode;
  const rowsPerColumn =
    Math.floor((SHEET_V2.gridBottom - gridTop) / SHEET_V2.rowStep) + 1;
  const colW = columnWidth(letterCount);
  const usable = SHEET_V2.contentRight - SHEET_V2.contentLeft;
  const columns = Math.max(1, Math.floor((usable + SHEET_V2.colGap) / colW));
  const perPage = rowsPerColumn * columns;
  const total = spec.questionLetters.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const codeColumns: Point[][] = Array.from({ length: codeDigits }, (_, d) =>
    Array.from({ length: 10 }, (_, digit) => ({
      x: SHEET_V2.codeFirstX + d * SHEET_V2.codeColStep,
      y: G.codeFirstRowY + digit * SHEET_V2.codeRowStep,
    }))
  );

  const pages: SheetPage[] = [];
  for (let p = 0; p < totalPages; p++) {
    const questions: SheetQuestion[] = [];
    const start = p * perPage;
    const end = Math.min(total, start + perPage);
    const onPage = end - start;
    const rowsUsed = spec.balanced
      ? Math.min(
          rowsPerColumn,
          Math.ceil(onPage / Math.max(1, Math.min(columns, Math.ceil(onPage / MIN_BALANCED_ROWS))))
        )
      : rowsPerColumn;
    // Columnas centradas en el ancho útil cuando no se usan todas.
    const colsUsed = Math.ceil(onPage / rowsUsed);
    const offsetX = spec.balanced
      ? Math.max(0, (usable - (colsUsed * colW - SHEET_V2.colGap)) / 2)
      : 0;
    for (let index = start; index < end; index++) {
      const local = index - start;
      const col = Math.floor(local / rowsUsed);
      const row = local % rowsUsed;
      const colX = SHEET_V2.contentLeft + offsetX + col * colW;
      const cy = gridTop + row * SHEET_V2.rowStep;
      const letters = spec.questionLetters[index];
      questions.push({
        index,
        numberPos: { x: colX, y: cy - 4 },
        bubbles: Array.from({ length: letters }, (_, l) => ({
          x: colX + SHEET_V2.numberWidth + SHEET_V2.bubbleR + l * SHEET_V2.bubbleStep,
          y: cy,
        })),
      });
    }
    pages.push({
      page: p + 1,
      totalPages,
      questions,
      codeColumns,
      bubbleR: SHEET_V2.bubbleR,
      sampleR: SHEET_V2.sampleR,
      geometry,
    });
  }

  return { version: geometry, letterCount, codeDigits, rowsPerColumn, columns, pages };
}

/** Preguntas por página para una configuración dada (para la UI). */
export function questionsPerPage(
  letterCount: number,
  codeDigits: number,
  geometry: 2 | 3 = 3
): number {
  const layout = computeSheetLayout({
    questionLetters: [],
    letterCount,
    codeDigits,
    geometry,
  });
  return layout.rowsPerColumn * layout.columns;
}

/**
 * Burbujas de cada posición de una forma, a partir de su clave (debe
 * coincidir con lo que imprimió el generador).
 */
export function questionLettersFromKey(
  key: { kind: string; perm?: string }[],
  letterCount: number
): number[] {
  return key.map((k) =>
    k.kind === "true-false"
      ? 2
      : k.kind === "multiple-choice-single"
      ? k.perm?.length ?? letterCount
      : 0
  );
}

/**
 * Página única con la geometría de la hoja v1 (exámenes viejos).
 * v1 muestreaba todas las letras del examen en cada fila calificable.
 */
export function legacySheetPage(
  totalQuestions: number,
  letterCount: number
): SheetPage {
  return {
    page: 1,
    totalPages: 1,
    codeColumns: [],
    geometry: 2,
    bubbleR: BUBBLE_RADIUS_PT,
    sampleR: BUBBLE_SAMPLE_RADIUS_PT,
    questions: Array.from({ length: totalQuestions }, (_, index) => ({
      index,
      numberPos: {
        x: numberLabelX(index, totalQuestions),
        y: rowLabelY(index, totalQuestions),
      },
      bubbles: Array.from({ length: letterCount }, (_, l) =>
        bubbleCenter(index, l, totalQuestions)
      ),
    })),
  };
}
