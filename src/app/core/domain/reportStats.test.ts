import { atRisk, groupStats, rankOf, recommendations, strengthsAndWeaknesses } from "./reportStats";
import { columnName, xlsxZip } from "../utils/xlsx.util";
import { ScoreBreakdown } from "../models/assessment.model";

const b = (mat: number, lc: number, comp: Record<string, [number, number]>): ScoreBreakdown => ({
  correct: 0,
  total: 0,
  byTest: {
    matematicas: { correct: 0, total: 0, score: mat, level: mat <= 35 ? 0 : 2 },
    lectura_critica: { correct: 0, total: 0, score: lc, level: lc <= 35 ? 0 : 2 },
  },
  byCompetency: Object.fromEntries(Object.entries(comp).map(([k, [c, t]]) => [k, { correct: c, total: t }])),
  global: Math.round(((mat + lc) / 2) * 5),
  globalComplete: false,
});

describe("estadísticas de reportes", () => {
  const rs = [
    { score: 4, breakdown: b(80, 60, { "matematicas:argumentacion": [3, 4], "lectura_critica:reflexionar_evaluar": [1, 4] }) },
    { score: 2, breakdown: b(20, 30, { "matematicas:argumentacion": [1, 4], "lectura_critica:reflexionar_evaluar": [0, 4] }) },
  ];

  it("promedia por prueba, competencia y global", () => {
    const s = groupStats(rs);
    expect(s).toMatchObject({ n: 2, score: 3, byTest: { matematicas: 50, lectura_critica: 45 } });
    expect(s.byCompetency).toEqual({ "matematicas:argumentacion": 50, "lectura_critica:reflexionar_evaluar": 13 });
  });

  it("puesto, fortalezas y riesgo", () => {
    expect(rankOf(4, [4, 2, 4.5])).toBe(2);
    const sw = strengthsAndWeaknesses(rs[0].breakdown);
    expect(sw.strengths.map((c) => c.competency)).toEqual(["argumentacion"]);
    expect(sw.weaknesses.map((c) => c.competency)).toEqual(["reflexionar_evaluar"]);
    expect(atRisk(rs, 5)).toEqual([rs[1]]);
  });

  it("recomienda trabajar la competencia más débil primero", () => {
    const rec = recommendations(groupStats(rs), []);
    expect(rec[0].title).toContain("Reflexionar");
  });
});

describe("xlsx", () => {
  it("nombra columnas como Excel", () => {
    expect([0, 25, 26, 27, 701].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ"]);
  });

  it("escribe hojas con números, texto escapado y nombres válidos", async () => {
    const zip = xlsxZip([
      { name: "Resultados", rows: [["Nombre", "Nota"], ["Ana <A&B>", 4.5]] },
      { name: "Resultados", rows: [["x"]] },
    ]);
    const wb = await zip.file("xl/workbook.xml")!.async("string");
    expect(wb).toContain('name="Resultados"');
    expect(wb).toContain('name="Resultados 2"');
    const s1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(s1).toContain('<c r="B2"><v>4.5</v></c>');
    expect(s1).toContain("Ana &lt;A&amp;B&gt;");
  });
});
