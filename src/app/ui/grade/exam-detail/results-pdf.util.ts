import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { Assessment, ResponseDoc } from "../../../core/models/assessment.model";
import { getCompetency, getTest, SABER11_TESTS } from "../../../core/domain/taxonomy/saber11";
import {
  GroupStats,
  actionFor,
  atRisk,
  groupStats,
  rankOf,
  recommendations,
  strengthsAndWeaknesses,
} from "../../../core/domain/reportStats";
import { ItemAnalysis } from "../../../core/domain/psychometrics";
import { testBarColor } from "../../shared/test-colors";
import { pdfToBlob, saveFile } from "../../../core/utils/fileShare.util";

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

const TABLE_LAYOUT = {
  fillColor: (rowIndex: number) => (rowIndex === 0 ? "#eef2ff" : rowIndex % 2 === 0 ? "#fafafa" : null),
  hLineColor: () => "#e5e7eb",
  vLineColor: () => "#e5e7eb",
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
};

const DISCLAIMER =
  "Los puntajes por prueba y el global son estimaciones de ExamHub a partir de este simulacro; no son resultados oficiales del ICFES.";

function testsIn(responses: ResponseDoc[]): string[] {
  const present = new Set(responses.flatMap((r) => Object.keys(r.breakdown?.byTest ?? {})));
  return SABER11_TESTS.map((t) => t.id).filter((id) => present.has(id));
}

function levelLabel(testId: string, level: number | null): string {
  if (level === null) return "—";
  return getTest(testId)?.levelLabels[level] ?? String(level + 1);
}

async function download(def: TDocumentDefinitions, name: string): Promise<void> {
  await saveFile(await pdfToBlob((pdfMake as any).createPdf(def)), name);
}

/**
 * Planilla de resultados: una fila por estudiante con nota, aciertos y,
 * si la evaluación está alineada al ICFES, puntaje por prueba y global.
 */
export async function exportResultsPdf(
  assessment: Assessment,
  responses: ResponseDoc[],
  groupName: (groupId?: string) => string,
  subtitle?: string
): Promise<void> {
  const sorted = responses
    .slice()
    .sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "es"));
  const tests = testsIn(sorted);
  const hasGlobal = sorted.some((r) => r.breakdown?.global !== null && r.breakdown?.global !== undefined);
  const scores = sorted.map((r) => r.score ?? 0);
  const avg = scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10 : 0;
  const passMark = assessment.maxScore * 0.6;

  const header = [
    { text: "#", style: "th", alignment: "center" },
    { text: "Estudiante", style: "th" },
    { text: "Grupo", style: "th" },
    { text: "Aciertos", style: "th", alignment: "center" },
    ...tests.map((t) => ({ text: getTest(t)?.shortLabel ?? t, style: "th", alignment: "center" })),
    ...(hasGlobal ? [{ text: "Global", style: "th", alignment: "center" }] : []),
    { text: "Nota", style: "th", alignment: "right" },
  ];
  const body = sorted.map((r, i) => [
    { text: String(i + 1), alignment: "center" },
    { text: r.studentName || "(sin nombre)" },
    { text: groupName(r.groupId) || "—" },
    { text: `${r.breakdown?.correct ?? 0} / ${r.breakdown?.total ?? 0}`, alignment: "center" },
    ...tests.map((t) => ({ text: String(r.breakdown?.byTest?.[t]?.score ?? "—"), alignment: "center" })),
    ...(hasGlobal ? [{ text: String(r.breakdown?.global ?? "—"), alignment: "center", bold: true }] : []),
    { text: (r.score ?? 0).toFixed(1), alignment: "right", bold: true },
  ]);

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: tests.length > 3 ? "landscape" : "portrait",
    pageMargins: [36, 48, 36, 48],
    info: { title: `Resultados — ${assessment.title}`, author: "ExamHub" },
    content: [
      { text: "Planilla de resultados", fontSize: 16, bold: true },
      { text: assessment.title + (subtitle ? ` · ${subtitle}` : ""), fontSize: 12, margin: [0, 2, 0, 8] },
      {
        text: `Calificados: ${sorted.length} · Promedio: ${avg} / ${assessment.maxScore} · Aprobados (≥ ${passMark.toFixed(1)}): ${
          scores.filter((s) => s >= passMark).length
        }`,
        fontSize: 10,
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 50, 50, ...tests.map(() => 34), ...(hasGlobal ? [40] : []), 34],
          body: [header, ...body],
        },
        layout: TABLE_LAYOUT,
        fontSize: 9,
      },
      ...(tests.length ? [{ text: DISCLAIMER, fontSize: 8, italics: true, color: "#6b7280", margin: [0, 12, 0, 0] }] : []),
    ] as any,
    styles: { th: { bold: true, fontSize: 9, color: "#16205A" } },
    defaultStyle: { fontSize: 10 },
  };
  await download(def, `Resultados - ${assessment.title}.pdf`);
}


// =====================================================================
//  Elementos gráficos
// =====================================================================

const MUTED = "#64748b";
const INK = "#0f172a";
const LEVEL_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

function kpi(label: string, value: string, hint?: string): any {
  return {
    stack: [
      { text: label.toUpperCase(), fontSize: 7, color: MUTED, bold: true, characterSpacing: 0.4 },
      { text: value, fontSize: 18, bold: true, color: INK, margin: [0, 2, 0, 0] },
      ...(hint ? [{ text: hint, fontSize: 8, color: MUTED }] : []),
    ],
  };
}

/** Barra 0–100 con marcador opcional (promedio del grupo). */
function scoreBar(score: number, color: string, width: number, marker?: number): any {
  const h = 9;
  const shapes: any[] = [
    { type: "rect", x: 0, y: 0, w: width, h, r: 4, color: "#f1f5f9" },
    { type: "rect", x: 0, y: 0, w: Math.max(3, (width * Math.min(100, score)) / 100), h, r: 4, color },
  ];
  if (marker !== undefined) {
    const x = (width * Math.min(100, marker)) / 100;
    shapes.push({ type: "line", x1: x, y1: -2, x2: x, y2: h + 2, lineWidth: 1.5, lineColor: INK });
  }
  return { canvas: shapes, margin: [0, 3, 0, 0] };
}

/** Barra apilada con la distribución por nivel. */
function levelBar(pcts: number[], width: number): any {
  let x = 0;
  const shapes = pcts
    .map((p, i) => {
      const w = (width * p) / 100;
      const rect = { type: "rect", x, y: 0, w, h: 12, color: LEVEL_COLORS[i] ?? "#94a3b8" };
      x += w;
      return rect;
    })
    .filter((s) => s.w > 0);
  return {
    canvas: shapes.length ? shapes : [{ type: "rect", x: 0, y: 0, w: width, h: 12, color: "#f1f5f9" }],
    margin: [0, 2, 0, 0],
  };
}

function sectionTitle(text: string, margin: number[] = [0, 14, 0, 6]): any {
  return { text, fontSize: 11, bold: true, color: INK, margin };
}

function footer(left: string) {
  return (page: number, pages: number) => ({
    columns: [
      { text: left, fontSize: 7, color: MUTED },
      { text: `${page} / ${pages}`, fontSize: 7, color: MUTED, alignment: "right" },
    ],
    margin: [40, 12, 40, 0],
  });
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function signatureLine(label: string): any {
  return {
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: "#94a3b8" }] },
      { text: label, fontSize: 8, color: MUTED, margin: [0, 3, 0, 0] },
    ],
  };
}

// =====================================================================
//  Boletín por estudiante
// =====================================================================

export interface BulletinOptions {
  institution?: string;
  /** Todas las respuestas de la evaluación (para comparar con el grupo). */
  allResponses: ResponseDoc[];
}

/**
 * Boletín individual: una página por estudiante con nota, puesto en el
 * grupo, puntaje por prueba frente al promedio del grupo, fortalezas,
 * aspectos por mejorar y preguntas para repasar. Pensado para familias.
 */
export async function exportStudentReports(
  assessment: Assessment,
  responses: ResponseDoc[],
  groupName: (groupId?: string) => string,
  opts: BulletinOptions
): Promise<void> {
  const single = responses.length === 1 ? ` - ${responses[0].studentName ?? ""}` : "";
  await download(
    studentReportsDoc(assessment, responses, groupName, opts),
    `Boletines - ${assessment.title}${single}.pdf`
  );
}

export function studentReportsDoc(
  assessment: Assessment,
  responses: ResponseDoc[],
  groupName: (groupId?: string) => string,
  opts: BulletinOptions
): TDocumentDefinitions {
  const sorted = responses
    .slice()
    .sort(
      (a, b) =>
        groupName(a.groupId).localeCompare(groupName(b.groupId), "es", { numeric: true }) ||
        (a.studentName ?? "").localeCompare(b.studentName ?? "", "es")
    );
  const formById = new Map(assessment.forms.map((f) => [f.id, f]));
  const statsByGroup = new Map<string, GroupStats>();
  const scoresByGroup = new Map<string, number[]>();
  for (const r of opts.allResponses) {
    const k = r.groupId ?? "";
    if (!scoresByGroup.has(k)) scoresByGroup.set(k, []);
    scoresByGroup.get(k)!.push(r.score ?? 0);
  }
  const statsFor = (groupId?: string) => {
    const k = groupId ?? "";
    if (!statsByGroup.has(k)) {
      statsByGroup.set(k, groupStats(opts.allResponses.filter((r) => (r.groupId ?? "") === k)));
    }
    return statsByGroup.get(k)!;
  };

  const content: any[] = [];
  sorted.forEach((r, idx) => {
    const b = r.breakdown;
    const form = formById.get(r.formId);
    const g = statsFor(r.groupId);
    const gName = groupName(r.groupId);
    const peers = scoresByGroup.get(r.groupId ?? "") ?? [];
    const tests = SABER11_TESTS.map((t) => t.id).filter((t) => b?.byTest?.[t]);
    const { strengths, weaknesses } = strengthsAndWeaknesses(b);

    // Encabezado
    content.push({
      table: {
        widths: ["*", "auto"],
        body: [
          [
            {
              stack: [
                { text: (opts.institution || "ExamHub").toUpperCase(), fontSize: 8, bold: true, color: "#c7d2fe", characterSpacing: 0.5 },
                { text: assessment.title, fontSize: 15, bold: true, color: "#ffffff", margin: [0, 2, 0, 0] },
                { text: `Informe de resultados · ${formatDay(assessment.createdAt)}`, fontSize: 8, color: "#c7d2fe", margin: [0, 2, 0, 0] },
              ],
              margin: [12, 10, 12, 10],
            },
            {
              stack: [
                { text: r.studentName ?? "Estudiante", fontSize: 12, bold: true, color: "#ffffff", alignment: "right" },
                {
                  text: [gName, r.studentCode ? `Código ${r.studentCode}` : "", form ? `Forma ${form.label}` : ""]
                    .filter(Boolean)
                    .join(" · "),
                  fontSize: 8,
                  color: "#c7d2fe",
                  alignment: "right",
                  margin: [0, 2, 0, 0],
                },
              ],
              margin: [12, 12, 12, 10],
            },
          ],
        ],
      },
      layout: { fillColor: () => "#16205A", hLineWidth: () => 0, vLineWidth: () => 0 },
      margin: [0, 0, 0, 14],
    });

    // Indicadores
    const kpis: any[] = [
      kpi("Nota", `${(r.score ?? 0).toFixed(1)} / ${assessment.maxScore}`, `Promedio del grupo: ${g.score.toFixed(1)}`),
      kpi("Aciertos", `${b?.correct ?? 0} / ${b?.total ?? 0}`),
    ];
    if (b?.global !== null && b?.global !== undefined) {
      kpis.push(kpi("Global estimado", `${b.global}`, g.global !== null ? `Grupo: ${g.global} · máx. 500` : "Máximo 500"));
    }
    if (peers.length > 1) {
      kpis.push(kpi("Puesto", `${rankOf(r.score ?? 0, peers)} de ${peers.length}`, gName ? `en ${gName}` : "en la evaluación"));
    }
    content.push({ columns: kpis, columnGap: 12, margin: [0, 0, 0, 6] });

    // Pruebas
    if (tests.length) {
      content.push(sectionTitle("Resultados por prueba"));
      content.push({
        table: {
          widths: [110, "*", 42, 40],
          body: [
            [
              { text: "Prueba", style: "th" },
              { text: "Puntaje (la línea es el promedio del grupo)", style: "th" },
              { text: "0–100", style: "th", alignment: "center" },
              { text: "Nivel", style: "th", alignment: "center" },
            ],
            ...tests.map((t) => {
              const s = b!.byTest[t];
              return [
                { text: getTest(t)?.label ?? t, fontSize: 9 },
                scoreBar(s.score, testBarColor(t), 230, g.byTest[t]),
                { text: String(s.score), alignment: "center", bold: true },
                { text: levelLabel(t, s.level), alignment: "center" },
              ];
            }),
          ],
        },
        layout: "lightHorizontalLines",
      });
    }

    // Fortalezas y por mejorar
    if (strengths.length || weaknesses.length) {
      const list = (items: typeof strengths, color: string, empty: string) =>
        items.length
          ? {
              ul: items.map((c) => ({
                text: [
                  { text: `${getTest(c.test)?.shortLabel ?? c.test} · ${c.label}: `, fontSize: 9 },
                  { text: `${c.pct} %`, bold: true, color, fontSize: 9 },
                  {
                    text: g.byCompetency[c.key] !== undefined ? `  (grupo ${g.byCompetency[c.key]} %)` : "",
                    fontSize: 8,
                    color: MUTED,
                  },
                ],
                margin: [0, 1, 0, 1],
              })),
            }
          : { text: empty, fontSize: 9, color: MUTED };
      content.push({
        columns: [
          { stack: [sectionTitle("Fortalezas"), list(strengths, "#15803d", "Aún sin fortalezas claras en esta evaluación.")] },
          { stack: [sectionTitle("Por mejorar"), list(weaknesses, "#b91c1c", "Sin competencias por debajo del 60 %.")] },
        ],
        columnGap: 16,
      });
      if (weaknesses[0]) {
        content.push({
          text: [{ text: "Recomendación: ", bold: true }, actionFor(weaknesses[0].test, weaknesses[0].competency)],
          fontSize: 9,
          color: "#334155",
          margin: [0, 8, 0, 0],
        });
      }
    }

    // Preguntas para repasar
    const wrongByTest = new Map<string, number[]>();
    (form?.key ?? []).forEach((k, i) => {
      if (k.letter === null || r.answers[i] === k.letter) return;
      const label = getTest(k.test)?.label ?? "Preguntas";
      if (!wrongByTest.has(label)) wrongByTest.set(label, []);
      wrongByTest.get(label)!.push(i + 1);
    });
    content.push(sectionTitle(`Preguntas para repasar${form ? ` (forma ${form.label})` : ""}`));
    content.push(
      wrongByTest.size
        ? {
            stack: [...wrongByTest].map(([label, nums]) => ({
              text: [{ text: `${label}: `, bold: true }, nums.join(", ")],
              fontSize: 9,
              margin: [0, 1, 0, 1],
            })),
          }
        : { text: "¡Respondió correctamente todas las preguntas de selección!", fontSize: 9 }
    );

    content.push({
      columns: [signatureLine("Docente / Director de grupo"), signatureLine("Firma del acudiente")],
      margin: [0, 36, 0, 0],
    });
    if (tests.length) {
      content.push({ text: DISCLAIMER, fontSize: 7, italics: true, color: MUTED, margin: [0, 14, 0, 0] });
    }
    if (idx < sorted.length - 1) content.push({ text: "", pageBreak: "after" });
  });

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 44],
    info: { title: `Boletines — ${assessment.title}`, author: "ExamHub" },
    content,
    footer: footer(`${opts.institution ? opts.institution + " · " : ""}${assessment.title}`) as any,
    styles: { th: { bold: true, fontSize: 8, color: MUTED } },
    defaultStyle: { fontSize: 10, color: INK },
  };
  return def;
}

// =====================================================================
//  Informe institucional (rector / coordinación)
// =====================================================================

export interface InstitutionalReportInput {
  assessment: Assessment;
  responses: ResponseDoc[];
  groupName: (groupId?: string) => string;
  institution?: string;
  /** Subtítulo del filtro activo (ej. "11-A"). */
  scope?: string;
  /** Estudiantes esperados (listado), si la evaluación lo tiene. */
  expected?: number;
  items: ItemAnalysis[];
  stemOf: (itemId: string) => string;
}

export async function exportInstitutionalReport(input: InstitutionalReportInput): Promise<void> {
  await download(
    institutionalReportDoc(input),
    `Informe institucional - ${input.assessment.title}${input.scope ? " - " + input.scope : ""}.pdf`
  );
}

export function institutionalReportDoc(input: InstitutionalReportInput): TDocumentDefinitions {
  const { assessment, responses, groupName } = input;
  const stats = groupStats(responses);
  const tests = SABER11_TESTS.filter((t) => stats.byTest[t.id] !== undefined);
  const passMark = assessment.maxScore * 0.6;
  const passed = responses.filter((r) => (r.score ?? 0) >= passMark).length;
  const content: any[] = [];

  content.push(
    { text: (input.institution || "ExamHub").toUpperCase(), fontSize: 9, bold: true, color: "#16205A", characterSpacing: 0.6 },
    { text: "Informe institucional de resultados", fontSize: 20, bold: true, margin: [0, 4, 0, 2] },
    {
      text: `${assessment.title}${input.scope ? ` · ${input.scope}` : ""} · ${formatDay(assessment.createdAt)}`,
      fontSize: 10,
      color: MUTED,
      margin: [0, 0, 0, 14],
    }
  );

  const kpis: any[] = [
    kpi("Evaluados", String(responses.length), input.expected ? `de ${input.expected} en el listado` : undefined),
    kpi("Nota promedio", `${stats.score.toFixed(1)} / ${assessment.maxScore}`),
    kpi(
      "Aprobados",
      `${responses.length ? Math.round((passed / responses.length) * 100) : 0} %`,
      `nota ≥ ${passMark.toFixed(1)}`
    ),
  ];
  if (stats.global !== null) kpis.push(kpi("Global estimado", String(stats.global), "promedio, máx. 500"));
  content.push({
    table: { widths: kpis.map(() => "*"), body: [kpis] },
    layout: {
      fillColor: () => "#f8fafc",
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  });

  // Por grupo
  const byGroup = new Map<string, ResponseDoc[]>();
  for (const r of responses) {
    const k = r.groupId ?? "";
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k)!.push(r);
  }
  if (byGroup.size > 0) {
    const rows = [...byGroup]
      .map(([gid, rs]) => ({ name: groupName(gid || undefined) || "Sin grupo", s: groupStats(rs) }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
    const all = [...rows, ...(rows.length > 1 ? [{ name: "Total", s: stats }] : [])];
    content.push(sectionTitle("Resultados por grupo", [0, 18, 0, 6]));
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 30, ...tests.map(() => 36), ...(stats.global !== null ? [42] : []), 36],
        body: [
          [
            { text: "Grupo", style: "th" },
            { text: "N", style: "th", alignment: "center" },
            ...tests.map((t) => ({ text: t.shortLabel, style: "th", alignment: "center" })),
            ...(stats.global !== null ? [{ text: "Global", style: "th", alignment: "center" }] : []),
            { text: "Nota", style: "th", alignment: "right" },
          ],
          ...all.map(({ name, s }) => [
            { text: name, bold: name === "Total" },
            { text: String(s.n), alignment: "center" },
            ...tests.map((t) => ({ text: String(s.byTest[t.id] ?? "—"), alignment: "center", bold: name === "Total" })),
            ...(stats.global !== null ? [{ text: String(s.global ?? "—"), alignment: "center", bold: true }] : []),
            { text: s.score.toFixed(1), alignment: "right", bold: true },
          ]),
        ],
      },
      layout: TABLE_LAYOUT,
      fontSize: 9,
    });
  }

  // Niveles de desempeño
  if (tests.length) {
    content.push(sectionTitle("Distribución por nivel de desempeño", [0, 18, 0, 6]));
    content.push({
      table: {
        widths: [100, "*", 40],
        body: tests.map((t) => {
          const levels = responses
            .map((r) => r.breakdown?.byTest?.[t.id]?.level)
            .filter((l): l is number => typeof l === "number");
          const pcts = t.levelLabels.map((_, i) =>
            levels.length ? Math.round((levels.filter((l) => l === i).length / levels.length) * 100) : 0
          );
          return [
            { text: t.label, fontSize: 9 },
            {
              stack: [
                levelBar(pcts, 300),
                {
                  text: pcts
                    .map((p, i) => `${/^\d/.test(t.levelLabels[i]) ? "Nivel " : ""}${t.levelLabels[i]}: ${p} %`)
                    .join("   "),
                  fontSize: 7,
                  color: MUTED,
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            { text: String(stats.byTest[t.id]), alignment: "center", bold: true },
          ];
        }),
      },
      layout: "lightHorizontalLines",
    });
    content.push({
      text: "Rojo: nivel 1 · Ámbar: nivel 2 · Azul: nivel 3 · Verde: nivel 4 (en Inglés: A-, A1, A2, B1). La última columna es el promedio 0–100.",
      fontSize: 7,
      color: MUTED,
      margin: [0, 4, 0, 0],
    });
  }

  // Competencias
  const comps = Object.entries(stats.byCompetency)
    .map(([key, pct]) => {
      const [test, comp] = key.split(":");
      return { test, comp, pct };
    })
    .sort((a, b) => a.pct - b.pct);
  if (comps.length) {
    content.push(sectionTitle("Competencias, de la más débil a la más fuerte", [0, 18, 0, 6]));
    content.push({
      table: {
        widths: [34, "*", 150, 30],
        body: comps.map((c) => [
          { text: getTest(c.test)?.shortLabel ?? c.test, fontSize: 8, color: MUTED },
          { text: getCompetency(c.test, c.comp)?.label ?? c.comp, fontSize: 9 },
          scoreBar(c.pct, c.pct < 50 ? "#ef4444" : c.pct < 65 ? "#f59e0b" : "#10b981", 150),
          { text: `${c.pct} %`, alignment: "right", fontSize: 9, bold: true },
        ]),
      },
      layout: "lightHorizontalLines",
    });
  }

  // Plan de mejora
  const recs = recommendations(stats, input.items);
  if (recs.length) {
    content.push({
      unbreakable: true,
      stack: [
        sectionTitle("Plan de mejora sugerido", [0, 18, 0, 6]),
        {
          ol: recs.map((r) => ({
            stack: [
              { text: r.title, bold: true, fontSize: 9 },
              { text: r.detail, fontSize: 9, color: "#334155", margin: [0, 1, 0, 5] },
            ],
          })),
        },
      ],
    });
  }

  // Preguntas más difíciles
  const hardest = input.items
    .filter((i) => i.correctOption !== null && i.n > 0)
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, 10);
  if (hardest.length) {
    content.push(sectionTitle("Las 10 preguntas con menos aciertos", [0, 18, 0, 6]));
    content.push({
      table: {
        dontBreakRows: true,
        headerRows: 1,
        widths: [22, 34, "*", 42, 90],
        body: [
          [
            { text: "#", style: "th" },
            { text: "Prueba", style: "th" },
            { text: "Pregunta", style: "th" },
            { text: "Acierto", style: "th", alignment: "center" },
            { text: "Respuesta más elegida", style: "th" },
          ],
          ...hardest.map((it) => {
            let top = 0;
            it.optionShare.forEach((s, i) => {
              if (s > it.optionShare[top]) top = i;
            });
            const topWrong = top !== it.correctOption;
            return [
              { text: String(it.position + 1), fontSize: 8 },
              { text: getTest(it.test)?.shortLabel ?? "—", fontSize: 8, color: MUTED },
              {
                stack: [
                  { text: input.stemOf(it.itemId) || "(sin enunciado)", fontSize: 8 },
                  ...(it.competency
                    ? [{ text: getCompetency(it.test, it.competency)?.label ?? "", fontSize: 7, color: MUTED }]
                    : []),
                ],
              },
              {
                text: `${Math.round(it.pValue * 100)} %`,
                alignment: "center",
                bold: true,
                fontSize: 9,
                color: it.pValue < 0.3 ? "#b91c1c" : INK,
              },
              {
                text: topWrong
                  ? `Opción ${String.fromCharCode(65 + top)} del banco (${Math.round(it.optionShare[top] * 100)} %): distractor`
                  : `La clave (${Math.round(it.optionShare[top] * 100)} %)`,
                fontSize: 8,
                color: topWrong ? "#b45309" : MUTED,
              },
            ];
          }),
        ],
      },
      layout: TABLE_LAYOUT,
    });
    content.push({
      text: "El número es la posición en la forma A; la letra de la opción es la del banco de preguntas (antes de barajar). Un distractor muy elegido señala un error de concepto común que vale la pena trabajar en clase.",
      fontSize: 7,
      color: MUTED,
      margin: [0, 4, 0, 0],
    });
  }

  // Estudiantes que requieren acompañamiento
  const risk = atRisk(responses, assessment.maxScore).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  if (risk.length) {
    content.push(sectionTitle(`Estudiantes que requieren acompañamiento (${risk.length})`, [0, 18, 0, 6]));
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 60, ...tests.map(() => 32), 34],
        body: [
          [
            { text: "Estudiante", style: "th" },
            { text: "Grupo", style: "th" },
            ...tests.map((t) => ({ text: t.shortLabel, style: "th", alignment: "center" })),
            { text: "Nota", style: "th", alignment: "right" },
          ],
          ...risk.map((r) => [
            { text: r.studentName ?? "—", fontSize: 9 },
            { text: groupName(r.groupId) || "—", fontSize: 8 },
            ...tests.map((t) => {
              const s = r.breakdown?.byTest?.[t.id];
              return {
                text: s ? String(s.score) : "—",
                alignment: "center",
                fontSize: 9,
                color: s?.level === 0 ? "#b91c1c" : INK,
              };
            }),
            { text: (r.score ?? 0).toFixed(1), alignment: "right", bold: true, fontSize: 9 },
          ]),
        ],
      },
      layout: TABLE_LAYOUT,
    });
    content.push({
      text: "Criterio: nivel 1 en al menos dos pruebas (o nota menor al 60 % si la evaluación no está alineada al ICFES).",
      fontSize: 7,
      color: MUTED,
      margin: [0, 4, 0, 0],
    });
  }

  if (tests.length) {
    content.push({ text: DISCLAIMER, fontSize: 7, italics: true, color: MUTED, margin: [0, 16, 0, 0] });
  }

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 44],
    info: { title: `Informe institucional — ${assessment.title}`, author: "ExamHub" },
    content,
    footer: footer(`Informe institucional · ${assessment.title}`) as any,
    styles: { th: { bold: true, fontSize: 8, color: "#16205A" } },
    defaultStyle: { fontSize: 10, color: INK },
  };
  return def;
}
