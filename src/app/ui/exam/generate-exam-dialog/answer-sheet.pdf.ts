import { FormDef, KeyEntry } from "../../../core/models/assessment.model";
import {
  SHEET_V2,
  SHEET_V3,
  SheetPage,
  computeSheetLayout,
  questionLettersFromKey,
  sheetGeometry,
} from "../../../core/domain/answerSheetLayout";
import { ALPHABET } from "../../../core/utils/alphabet.const";
import { encodeQrPayload } from "../../../core/utils/qrPayload.util";

export interface AnswerSheetOptions {
  title: string;
  formLabel: string;
  qrPayload: string;
  /** Clave del docente: rellena la burbuja correcta. */
  key?: KeyEntry[];
  /** Hoja personalizada: datos impresos del estudiante. */
  student?: { name: string; groupName?: string };
}

const BUBBLE_LINE = "#4b5563";
const LETTER_COLOR = "#6b7280";
const LABEL_FONT = 6;

/** Ancho aproximado (pt) de una letra/dígito de Roboto a LABEL_FONT. */
function glyphWidth(label: string): number {
  const em = /[MW]/.test(label) ? 0.85 : /[I1]/.test(label) ? 0.35 : 0.6;
  return label.length * em * LABEL_FONT;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

/**
 * Nodos pdfmake de UNA página de la hoja de respuestas.
 * Todas las posiciones vienen de `answerSheetLayout.ts`, la misma
 * fuente que usa el OMR para muestrear.
 */
export function buildAnswerSheetPage(page: SheetPage, opts: AnswerSheetOptions): any[] {
  const nodes: any[] = [];
  const r = page.bubbleR;

  for (const pos of Object.values(SHEET_V2.fiducials)) {
    nodes.push({
      canvas: [{ type: "rect", x: 0, y: 0, w: SHEET_V2.fiducialSize, h: SHEET_V2.fiducialSize, color: "#000000" }],
      absolutePosition: { x: pos.x, y: pos.y },
    });
  }

  nodes.push(...(page.geometry === 3 ? headerV3(page, opts) : headerV2(page, opts)));

  if (page.codeColumns.length > 0) {
    const G = sheetGeometry(page.geometry);
    nodes.push({
      text: "Código del estudiante",
      fontSize: 8,
      bold: true,
      absolutePosition: { x: SHEET_V2.codeFirstX - r, y: G.codeLabelY },
    });
    for (const column of page.codeColumns) {
      const box = SHEET_V2.codeBoxSize;
      nodes.push({
        canvas: [{ type: "rect", x: 0, y: 0, w: box, h: box, lineWidth: 0.6, lineColor: BUBBLE_LINE }],
        absolutePosition: { x: column[0].x - box / 2, y: G.codeBoxY },
      });
      column.forEach((center, digit) => nodes.push(...bubble(center.x, center.y, r, String(digit), false)));
    }
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
      absolutePosition: { x: 230, y: G.codeLabelY + 4 },
    });
  }

  const forTeacher = !!opts.key;
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

/** Cabecera v2 (hojas generadas antes de las personalizadas). */
function headerV2(page: SheetPage, opts: AnswerSheetOptions): any[] {
  const G = SHEET_V2;
  const pageInfo = page.totalPages > 1 ? ` · Hoja ${page.page} de ${page.totalPages}` : "";
  return [
    {
      text: `${opts.key ? "CLAVE — " : ""}${opts.title} · Forma ${opts.formLabel}${pageInfo}`,
      bold: true,
      fontSize: 11,
      absolutePosition: { x: G.contentLeft, y: G.titleY },
    },
    { qr: opts.qrPayload, fit: G.qr.fit, eccLevel: "M", absolutePosition: { x: G.qr.x, y: G.qr.y } },
    { text: "Nombre: ______________________________________________", fontSize: 10, absolutePosition: { x: G.contentLeft, y: G.nameY } },
    { text: "Grupo: __________   Fecha: ______________", fontSize: 10, absolutePosition: { x: G.contentLeft, y: G.groupY } },
  ];
}

/**
 * Cabecera v3: título, recuadro grande con la forma (para repartir el
 * cuadernillo correcto), nombre del estudiante impreso (o líneas para
 * escribirlo) y QR grande para leer fácil con el celular.
 */
function headerV3(page: SheetPage, opts: AnswerSheetOptions): any[] {
  const G = SHEET_V3;
  const nodes: any[] = [];
  const pageInfo = page.totalPages > 1 ? `Hoja ${page.page} de ${page.totalPages}` : "Hoja de respuestas";
  nodes.push(
    {
      text: truncate(`${opts.key ? "CLAVE · " : ""}${opts.title}`, 52),
      bold: true,
      fontSize: 11,
      absolutePosition: { x: G.contentLeft, y: G.titleY },
    },
    {
      text: pageInfo,
      fontSize: 8,
      color: LETTER_COLOR,
      absolutePosition: { x: G.contentLeft, y: G.titleY + 13 },
    },
    // Recuadro de la forma
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: G.formBox.w, h: G.formBox.h, r: 4, lineWidth: 1.2, lineColor: "#111827" },
      ],
      absolutePosition: { x: G.formBox.x, y: G.formBox.y },
    },
    {
      text: "FORMA",
      fontSize: 6.5,
      bold: true,
      color: LETTER_COLOR,
      absolutePosition: { x: G.formBox.x + G.formBox.w / 2 - 11, y: G.formBox.y + 4 },
    },
    {
      text: opts.formLabel,
      fontSize: 24,
      bold: true,
      absolutePosition: {
        x: G.formBox.x + G.formBox.w / 2 - opts.formLabel.length * 7.5,
        y: G.formBox.y + 13,
      },
    },
    { qr: opts.qrPayload, fit: G.qr.fit, eccLevel: "M", absolutePosition: { x: G.qr.x, y: G.qr.y } }
  );

  if (opts.student) {
    const name = opts.student.name;
    nodes.push(
      { text: "ESTUDIANTE", fontSize: 6.5, bold: true, color: LETTER_COLOR, absolutePosition: { x: G.contentLeft, y: G.nameLabelY } },
      {
        text: truncate(name, 44),
        fontSize: name.length > 30 ? 12 : 14,
        bold: true,
        absolutePosition: { x: G.contentLeft, y: G.nameY },
      },
      {
        text: [opts.student.groupName ? `Grupo ${opts.student.groupName}` : "", "Firma: ____________________"]
          .filter(Boolean)
          .join("     "),
        fontSize: 9,
        color: "#374151",
        absolutePosition: { x: G.contentLeft, y: G.groupY },
      }
    );
  } else {
    nodes.push(
      { text: "Nombre: ______________________________________", fontSize: 10, absolutePosition: { x: G.contentLeft, y: G.nameY } },
      { text: "Grupo: __________   Fecha: ______________", fontSize: 10, absolutePosition: { x: G.contentLeft, y: G.groupY } }
    );
  }

  if (page.codeColumns.length === 0) {
    nodes.push({
      text: "Rellena completamente un solo círculo por pregunta, con lápiz N° 2 o esfero negro. No escribas cerca de los cuadros negros.",
      fontSize: 7.5,
      color: "#374151",
      absolutePosition: { x: G.contentLeft, y: G.instructionsY },
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
            // pdfmake ignora width/alignment en texto con posición
            // absoluta: centramos estimando el ancho del glifo.
            text: label,
            fontSize: LABEL_FONT,
            color: LETTER_COLOR,
            absolutePosition: { x: cx - glyphWidth(label) / 2, y: cy - LABEL_FONT * 0.6 },
          },
        ]),
  ];
}

// ---------------------------------------------------------------------
//  Documentos de hojas (generación, reimpresión, hojas de reserva)
// ---------------------------------------------------------------------

export interface SheetsContext {
  orgId: string;
  assessmentId: string;
  title: string;
  forms: FormDef[];
  letterCount: number;
  codeDigits: number;
  geometry: 2 | 3;
  balanced: boolean;
}

export interface SheetRequest {
  formId: string;
  /** Hoja personalizada (si falta, hoja genérica). */
  studentId?: string;
  name?: string;
  groupName?: string;
  /** Hoja del docente con la clave. */
  withKey?: boolean;
}

/**
 * Contenido pdfmake con todas las páginas de las hojas pedidas, cada
 * una en su propia página. Comparte la geometría con el OMR.
 */
export function buildSheetsContent(ctx: SheetsContext, requests: SheetRequest[]): any[] {
  const layouts = new Map(
    ctx.forms.map((f) => [
      f.id,
      computeSheetLayout({
        questionLetters: questionLettersFromKey(f.key, ctx.letterCount),
        letterCount: ctx.letterCount,
        codeDigits: ctx.codeDigits,
        balanced: ctx.balanced,
        geometry: ctx.geometry,
      }),
    ])
  );
  const content: any[] = [];
  for (const req of requests) {
    const form = ctx.forms.find((f) => f.id === req.formId);
    const layout = layouts.get(req.formId);
    if (!form || !layout) continue;
    for (const page of layout.pages) {
      if (content.length > 0) content.push({ text: "", pageBreak: "before" });
      content.push(
        ...buildAnswerSheetPage(page, {
          title: ctx.title,
          formLabel: form.label,
          key: req.withKey ? form.key : undefined,
          student: req.studentId && req.name ? { name: req.name, groupName: req.groupName } : undefined,
          qrPayload: encodeQrPayload({
            orgId: ctx.orgId,
            examId: ctx.assessmentId,
            versionId: form.id,
            page: page.page,
            totalPages: page.totalPages,
            ...(req.studentId ? { studentId: req.studentId } : {}),
          }),
        })
      );
    }
  }
  return content;
}

/** Documento pdfmake solo con hojas (márgenes neutros, sin encabezado). */
export function sheetsDocument(ctx: SheetsContext, requests: SheetRequest[], intro: any[] = []): any {
  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    info: { title: `Hojas de respuesta — ${ctx.title}`, author: "ExamHub" },
    content: intro.length
      ? [...intro, { text: "", pageBreak: "before" }, ...buildSheetsContent(ctx, requests)]
      : buildSheetsContent(ctx, requests),
    styles: { th: { bold: true, fontSize: 9, color: "#3730a3" } },
  };
}

export interface DeliveryGroup {
  groupName: string;
  students: { name: string; formLabel: string }[];
}

/**
 * Lista de entrega: una tabla por grupo (orden de lista → forma) y el
 * total de cuadernillos a imprimir por forma. Va al inicio del PDF de
 * hojas para repartir rápido en el salón.
 */
export function deliveryListContent(
  title: string,
  groups: DeliveryGroup[],
  copies: { formLabel: string; count: number }[]
): any[] {
  const content: any[] = [
    { text: "Lista de entrega", fontSize: 16, bold: true },
    { text: title, fontSize: 11, color: "#475569", margin: [0, 2, 0, 10] },
    {
      table: {
        widths: copies.map(() => "*"),
        body: [
          copies.map((c) => ({ text: `Forma ${c.formLabel}`, bold: true, fontSize: 9, color: "#3730a3", alignment: "center" })),
          copies.map((c) => ({ text: `${c.count} cuadernillos`, fontSize: 11, bold: true, alignment: "center" })),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 6],
    },
    {
      text: "Incluye las hojas de reserva. Entrega a cada estudiante su hoja y el cuadernillo de la forma indicada.",
      fontSize: 8,
      color: "#64748b",
      margin: [0, 0, 0, 12],
    },
  ];
  for (const g of groups) {
    content.push(
      { text: `Grupo ${g.groupName} · ${g.students.length} estudiantes`, fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [22, "*", 50, 40],
          body: [
            [
              { text: "#", style: "th" },
              { text: "Estudiante", style: "th" },
              { text: "Forma", style: "th", alignment: "center" },
              { text: "Entregó", style: "th", alignment: "center" },
            ],
            ...g.students.map((st, i) => [
              { text: String(i + 1), fontSize: 9, color: "#64748b" },
              { text: st.name, fontSize: 9.5 },
              { text: st.formLabel, fontSize: 11, bold: true, alignment: "center" },
              { text: "" },
            ]),
          ],
        },
        layout: {
          fillColor: (row: number) => (row === 0 ? "#eef2ff" : row % 2 === 0 ? "#fafafa" : null),
          hLineColor: () => "#e5e7eb",
          vLineColor: () => "#e5e7eb",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      }
    );
  }
  return content;
}
