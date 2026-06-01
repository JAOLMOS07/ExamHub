import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import {
  ExamResult,
  GradedExam,
} from "../../../core/models/gradedExam.model";

// Inicializamos fuentes de pdfmake. Es seguro reasignar; pdfmake lo
// ignora si ya estaba seteado.
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

/**
 * Genera y abre un PDF imprimible con la planilla de resultados de
 * un examen: encabezado, tabla con #, alumno, versión, aciertos, nota
 * y fecha, y un resumen al final (promedio, mejor, peor).
 *
 * Se ordenan los resultados alfabéticamente por nombre (más útil para
 * el profe que el orden de escaneo).
 */
export async function exportResultsPdf(
  exam: GradedExam,
  results: ExamResult[],
  maxScore: number
): Promise<void> {
  // Ordenar alfabéticamente por nombre (sin tocar la lista original)
  const sorted = results
    .slice()
    .sort((a, b) =>
      (a.studentName ?? "").localeCompare(b.studentName ?? "", "es")
    );

  const avg =
    sorted.length === 0
      ? 0
      : Math.round(
          (sorted.reduce((s, r) => s + (r.score ?? 0), 0) / sorted.length) *
            10
        ) / 10;
  const best =
    sorted.length === 0 ? 0 : Math.max(...sorted.map((r) => r.score ?? 0));
  const worst =
    sorted.length === 0 ? 0 : Math.min(...sorted.map((r) => r.score ?? 0));
  const aprobados = sorted.filter(
    (r) => (r.score ?? 0) >= maxScore * 0.6
  ).length;

  const tableBody: any[] = [
    [
      { text: "#", style: "tableHeader", alignment: "center" },
      { text: "Alumno", style: "tableHeader" },
      { text: "Código", style: "tableHeader" },
      { text: "Versión", style: "tableHeader", alignment: "center" },
      { text: "Aciertos", style: "tableHeader", alignment: "center" },
      { text: "Nota", style: "tableHeader", alignment: "right" },
      { text: "Fecha", style: "tableHeader" },
    ],
    ...sorted.map((r, i) => [
      { text: String(i + 1), alignment: "center", fontSize: 9 },
      { text: r.studentName || "(sin nombre)", fontSize: 9 },
      { text: r.studentCode || "—", fontSize: 9 },
      { text: r.versionId, alignment: "center", fontSize: 9 },
      {
        text: `${r.correct} / ${r.total}`,
        alignment: "center",
        fontSize: 9,
      },
      {
        text: r.score !== undefined ? r.score.toFixed(1) : "—",
        alignment: "right",
        fontSize: 9,
        bold: true,
      },
      {
        text: new Date(r.scannedAt).toLocaleDateString("es-CO"),
        fontSize: 9,
      },
    ]),
  ];

  const generatedAt = new Date().toLocaleString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    info: {
      title: `Resultados — ${exam.title}`,
      author: "ExamHub",
    },
    content: [
      {
        text: "Planilla de resultados",
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 4],
      },
      {
        text: exam.title,
        fontSize: 14,
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          {
            stack: [
              ...(exam.subject
                ? [{ text: `Materia: ${exam.subject}`, fontSize: 10 }]
                : []),
              ...(exam.grade
                ? [{ text: `Grado: ${exam.grade}`, fontSize: 10 }]
                : []),
              { text: `Total preguntas: ${exam.totalQuestions}`, fontSize: 10 },
              { text: `Versiones: ${exam.versions.length}`, fontSize: 10 },
            ],
          },
          {
            stack: [
              {
                text: `Calificados: ${sorted.length}`,
                fontSize: 10,
                alignment: "right",
              },
              {
                text: `Aprobados (≥ ${(maxScore * 0.6).toFixed(1)}): ${aprobados}`,
                fontSize: 10,
                alignment: "right",
                color: "#15803d",
              },
              {
                text: `Promedio: ${avg}`,
                fontSize: 10,
                alignment: "right",
                bold: true,
              },
              {
                text: `Mejor / Peor: ${best} / ${worst}`,
                fontSize: 10,
                alignment: "right",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        text: "Lista de alumnos (orden alfabético)",
        fontSize: 11,
        bold: true,
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: [20, "*", 60, 35, 50, 35, 60],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return "#eef2ff";
            return rowIndex % 2 === 0 ? "#fafafa" : null;
          },
          hLineColor: () => "#e5e7eb",
          vLineColor: () => "#e5e7eb",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
      {
        text: `Generado por ExamHub el ${generatedAt}.`,
        fontSize: 8,
        italics: true,
        color: "#888888",
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: "#3730a3",
      },
    },
    defaultStyle: {
      fontSize: 10,
    },
  };

  const fileName = `Resultados - ${exam.title}.pdf`.replace(
    /[/\\?%*:|"<>]/g,
    "-"
  );
  await new Promise<void>((resolve) => {
    (pdfMake as any).createPdf(def).download(fileName, resolve);
  });
}
