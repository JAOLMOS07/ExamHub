import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { Assessment, ResponseDoc } from "../../../core/models/assessment.model";
import { getCompetency, getTest, SABER11_TESTS } from "../../../core/domain/taxonomy/saber11";

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
  const fileName = name.replace(/[/\\?%*:|"<>]/g, "-");
  await new Promise<void>((resolve) => {
    (pdfMake as any).createPdf(def).download(fileName, resolve);
  });
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
    styles: { th: { bold: true, fontSize: 9, color: "#3730a3" } },
    defaultStyle: { fontSize: 10 },
  };
  await download(def, `Resultados - ${assessment.title}.pdf`);
}

/**
 * Boletín individual: una página por estudiante con su nota, puntaje
 * por prueba y nivel de desempeño, aciertos por competencia y las
 * preguntas que falló. Pensado para entregar a familias.
 */
export async function exportStudentReports(
  assessment: Assessment,
  responses: ResponseDoc[],
  groupName: (groupId?: string) => string,
  institution?: string
): Promise<void> {
  const sorted = responses
    .slice()
    .sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "es"));
  const formById = new Map(assessment.forms.map((f) => [f.id, f]));
  const content: any[] = [];

  sorted.forEach((r, idx) => {
    const b = r.breakdown;
    const form = formById.get(r.formId);
    const tests = Object.keys(b?.byTest ?? {});
    const wrong = (form?.key ?? [])
      .map((k, i) => ({ k, i }))
      .filter(({ k, i }) => k.letter !== null && r.answers[i] !== k.letter)
      .map(({ i }) => i + 1);

    content.push(
      ...(institution ? [{ text: institution, fontSize: 10, color: "#6b7280" }] : []),
      { text: assessment.title, fontSize: 15, bold: true, margin: [0, 2, 0, 2] },
      {
        text: `${r.studentName ?? "Estudiante"}${r.studentCode ? ` · Código ${r.studentCode}` : ""}${
          groupName(r.groupId) ? ` · ${groupName(r.groupId)}` : ""
        }`,
        fontSize: 11,
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          { stack: [{ text: "Nota", fontSize: 9, color: "#6b7280" }, { text: `${(r.score ?? 0).toFixed(1)} / ${assessment.maxScore}`, fontSize: 20, bold: true }] },
          { stack: [{ text: "Aciertos", fontSize: 9, color: "#6b7280" }, { text: `${b?.correct ?? 0} / ${b?.total ?? 0}`, fontSize: 20, bold: true }] },
          ...(b?.global !== null && b?.global !== undefined
            ? [{ stack: [{ text: "Global estimado", fontSize: 9, color: "#6b7280" }, { text: `${b.global} / 500`, fontSize: 20, bold: true }] }]
            : []),
        ],
        margin: [0, 0, 0, 12],
      }
    );

    if (tests.length) {
      content.push({
        table: {
          headerRows: 1,
          widths: ["*", 60, 60, 70],
          body: [
            [
              { text: "Prueba", style: "th" },
              { text: "Aciertos", style: "th", alignment: "center" },
              { text: "Puntaje", style: "th", alignment: "center" },
              { text: "Nivel", style: "th", alignment: "center" },
            ],
            ...tests.map((t) => {
              const s = b!.byTest[t];
              return [
                getTest(t)?.label ?? t,
                { text: `${s.correct} / ${s.total}`, alignment: "center" },
                { text: `${s.score} / 100`, alignment: "center", bold: true },
                { text: levelLabel(t, s.level), alignment: "center" },
              ];
            }),
          ],
        },
        layout: TABLE_LAYOUT,
        margin: [0, 0, 0, 10],
      });
    }

    const comps = Object.entries(b?.byCompetency ?? {});
    if (comps.length) {
      content.push(
        { text: "Competencias", bold: true, margin: [0, 4, 0, 4] },
        {
          table: {
            widths: ["*", 70],
            body: comps.map(([k, c]) => {
              const [t, comp] = k.split(":");
              const pct = c.total ? Math.round((c.correct / c.total) * 100) : 0;
              return [
                { text: `${getTest(t)?.shortLabel ?? t} · ${getCompetency(t, comp)?.label ?? comp}`, fontSize: 9 },
                { text: `${pct}% (${c.correct}/${c.total})`, fontSize: 9, alignment: "right", color: pct < 50 ? "#b91c1c" : "#15803d" },
              ];
            }),
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        }
      );
    }

    content.push(
      {
        text: wrong.length
          ? `Preguntas para repasar (forma ${form?.label ?? r.formId}): ${wrong.join(", ")}`
          : "¡Respondió correctamente todas las preguntas de selección!",
        fontSize: 9,
        margin: [0, 4, 0, 8],
      },
      ...(tests.length ? [{ text: DISCLAIMER, fontSize: 7, italics: true, color: "#6b7280" }] : [])
    );
    if (idx < sorted.length - 1) content.push({ text: "", pageBreak: "after" });
  });

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [48, 48, 48, 48],
    info: { title: `Boletines — ${assessment.title}`, author: "ExamHub" },
    content,
    styles: { th: { bold: true, fontSize: 9, color: "#3730a3" } },
    defaultStyle: { fontSize: 10 },
  };
  await download(def, `Boletines - ${assessment.title}.pdf`);
}
