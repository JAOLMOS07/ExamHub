import { KeyEntry } from "../../../core/models/assessment.model";
import { SheetPage, SHEET_V2 } from "../../../core/domain/answerSheetLayout";
import { ALPHABET } from "../../../core/utils/alphabet.const";

export interface AnswerSheetOptions {
  title: string;
  formLabel: string;
  qrPayload: string;
  /** Clave del docente: rellena la burbuja correcta. */
  key?: KeyEntry[];
  /** Texto impreso en el bloque de datos (grupo, fecha). */
  subtitle?: string;
}

const BUBBLE_LINE = "#4b5563";
const LETTER_COLOR = "#6b7280";

/**
 * Nodos pdfmake de UNA página de la hoja de respuestas v2.
 * Todas las posiciones vienen de `answerSheetLayout.ts`, la misma
 * fuente que usa el OMR para muestrear.
 */
export function buildAnswerSheetPage(page: SheetPage, opts: AnswerSheetOptions): any[] {
  const nodes: any[] = [];
  const forTeacher = !!opts.key;
  const r = page.bubbleR;

  for (const pos of Object.values(SHEET_V2.fiducials)) {
    nodes.push({
      canvas: [{ type: "rect", x: 0, y: 0, w: SHEET_V2.fiducialSize, h: SHEET_V2.fiducialSize, color: "#000000" }],
      absolutePosition: { x: pos.x, y: pos.y },
    });
  }

  const pageInfo = page.totalPages > 1 ? ` · Hoja ${page.page} de ${page.totalPages}` : "";
  nodes.push({
    text: `${forTeacher ? "CLAVE — " : ""}${opts.title} · Forma ${opts.formLabel}${pageInfo}`,
    bold: true,
    fontSize: 11,
    alignment: "center",
    width: SHEET_V2.qr.x - SHEET_V2.contentLeft - 8,
    absolutePosition: { x: SHEET_V2.contentLeft, y: SHEET_V2.titleY },
  });
  nodes.push({
    qr: opts.qrPayload,
    fit: SHEET_V2.qr.fit,
    eccLevel: "M",
    absolutePosition: { x: SHEET_V2.qr.x, y: SHEET_V2.qr.y },
  });
  nodes.push({
    text: "Nombre: ______________________________________________",
    fontSize: 10,
    absolutePosition: { x: SHEET_V2.contentLeft, y: SHEET_V2.nameY },
  });
  nodes.push({
    text: opts.subtitle ?? "Grupo: __________   Fecha: ______________",
    fontSize: 10,
    absolutePosition: { x: SHEET_V2.contentLeft, y: SHEET_V2.groupY },
  });

  if (page.codeColumns.length > 0) {
    nodes.push({
      text: "Código del estudiante",
      fontSize: 8,
      bold: true,
      absolutePosition: { x: SHEET_V2.codeFirstX - r, y: SHEET_V2.codeLabelY },
    });
    page.codeColumns.forEach((column) => {
      const box = SHEET_V2.codeBoxSize;
      nodes.push({
        canvas: [{ type: "rect", x: 0, y: 0, w: box, h: box, lineWidth: 0.6, lineColor: BUBBLE_LINE }],
        absolutePosition: { x: column[0].x - box / 2, y: SHEET_V2.codeBoxY },
      });
      column.forEach((center, digit) => {
        nodes.push(...bubble(center.x, center.y, r, String(digit), false));
      });
    });
    nodes.push({
      stack: [
        { text: "Instrucciones", bold: true, fontSize: 9, margin: [0, 0, 0, 3] },
        {
          ul: [
            "Usa lápiz negro N° 2 o esfero negro.",
            "Rellena completamente un solo círculo por pregunta.",
            "Escribe tu código en las casillas y rellena el dígito de cada columna.",
            "No dobles ni manches la hoja; no escribas cerca de los cuadros negros.",
          ],
          fontSize: 8,
          color: "#374151",
        },
      ],
      width: SHEET_V2.contentRight - 230,
      absolutePosition: { x: 230, y: SHEET_V2.codeLabelY + 4 },
    });
  }

  for (const q of page.questions) {
    nodes.push({
      text: `${q.index + 1}`.padStart(2, "0"),
      fontSize: 8,
      bold: true,
      absolutePosition: { x: q.numberPos.x, y: q.numberPos.y },
    });
    if (q.bubbles.length === 0) {
      nodes.push({
        text: forTeacher ? "(manual)" : "(abierta)",
        fontSize: 7,
        italics: true,
        color: LETTER_COLOR,
        absolutePosition: { x: q.numberPos.x + SHEET_V2.numberWidth, y: q.numberPos.y + 0.5 },
      });
      continue;
    }
    const correct = opts.key?.[q.index]?.letter ?? null;
    q.bubbles.forEach((b, l) => {
      nodes.push(...bubble(b.x, b.y, r, ALPHABET[l], forTeacher && ALPHABET[l] === correct));
    });
  }
  return nodes;
}

/** Círculo con la letra/dígito en gris claro (no cuenta como marca). */
function bubble(cx: number, cy: number, r: number, label: string, filled: boolean): any[] {
  return [
    {
      canvas: [
        {
          type: "ellipse",
          x: r,
          y: r,
          r1: r,
          r2: r,
          lineWidth: 0.6,
          lineColor: BUBBLE_LINE,
          ...(filled ? { color: "#000000" } : {}),
        },
      ],
      absolutePosition: { x: cx - r, y: cy - r },
    },
    ...(filled
      ? []
      : [
          {
            text: label,
            fontSize: 6,
            color: LETTER_COLOR,
            alignment: "center",
            width: r * 2,
            absolutePosition: { x: cx - r, y: cy - 3.6 },
          },
        ]),
  ];
}
