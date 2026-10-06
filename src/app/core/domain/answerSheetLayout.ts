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

export const SHEET_LAYOUT_VERSION = 2;

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
}

export interface SheetLayout {
  version: 1 | 2;
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
}

export function columnWidth(letterCount: number): number {
  return SHEET_V2.numberWidth + letterCount * SHEET_V2.bubbleStep + SHEET_V2.colGap;
}

export function computeSheetLayout(spec: SheetLayoutSpec): SheetLayout {
  const letterCount = Math.max(2, spec.letterCount);
  const codeDigits = Math.min(
    SHEET_V2.maxCodeDigits,
    Math.max(0, Math.floor(spec.codeDigits))
  );
  const gridTop = codeDigits > 0 ? SHEET_V2.gridTopWithCode : SHEET_V2.gridTopNoCode;
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
      y: SHEET_V2.codeFirstRowY + digit * SHEET_V2.codeRowStep,
    }))
  );

  const pages: SheetPage[] = [];
  for (let p = 0; p < totalPages; p++) {
    const questions: SheetQuestion[] = [];
    const start = p * perPage;
    const end = Math.min(total, start + perPage);
    for (let index = start; index < end; index++) {
      const local = index - start;
      const col = Math.floor(local / rowsPerColumn);
      const row = local % rowsPerColumn;
      const colX = SHEET_V2.contentLeft + col * colW;
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
    });
  }

  return { version: 2, letterCount, codeDigits, rowsPerColumn, columns, pages };
}

/** Preguntas por página para una configuración dada (para la UI). */
export function questionsPerPage(letterCount: number, codeDigits: number): number {
  const layout = computeSheetLayout({
    questionLetters: [],
    letterCount,
    codeDigits,
  });
  return layout.rowsPerColumn * layout.columns;
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
