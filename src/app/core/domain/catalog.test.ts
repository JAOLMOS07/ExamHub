// Jest corre en Node; el tsconfig de dominio no incluye sus tipos.
declare const require: (m: string) => any;
declare const process: { cwd(): string };

import { autoSimulacro, contributionProblem, filterUnits, mixCounts, unitsFromImport, unitsToFolder, CatalogUnit } from "./catalog";
import { parseBankInput } from "./bankImport";
import { createRng } from "./rng";
import { QuestionKind } from "../models/questionKind.enum";

const mc = (text: string, test: string, competency: string, difficulty = 2) => ({
  kind: QuestionKind.MULTIPLE_CHOICE_SINGLE,
  text,
  test,
  competency,
  difficulty,
  options: [
    { text: "uno", correct: true },
    { text: "dos", correct: false },
    { text: "tres", correct: false },
    { text: "cuatro", correct: false },
  ],
});

let seq = 0;
const id = () => `u${++seq}`;
const base = { status: "published" as const, source: "examhub" as const };

function unit(test: string, competency: string, kind: "question" | "passage" = "question", n = 1): CatalogUnit {
  const qs = Array.from({ length: n }, (_, i) => mc(`Pregunta larga número ${i} de ${test}`, test, competency));
  return {
    id: id(),
    kind,
    test,
    competencies: [competency],
    difficulty: 2,
    questions: qs,
    questionCount: n,
    status: "published",
    source: "examhub",
    createdAt: 0,
    updatedAt: 0,
    ...(kind === "passage" ? { title: "Lectura", text: "Texto" } : {}),
  };
}

describe("catálogo: de un banco importado a unidades", () => {
  it("lecturas como una unidad, el tema desde la carpeta y descarta lo no alineado", () => {
    const r = parseBankInput(
      JSON.stringify({
        folders: [
          {
            name: "Funciones",
            questions: [
              { question: "¿Cuál es la pendiente de y = 2x + 3?", options: ["2", "3", "5", "1"], answer: "A", test: "matematicas", competency: "interpretacion_representacion" },
              { question: "Pregunta sin prueba asignada aquí", options: ["a", "b", "c"], answer: "A" },
            ],
            passages: [
              {
                title: "El río",
                text: "Texto de la lectura",
                questions: [
                  { question: "¿Qué idea defiende el autor del texto?", options: ["a", "b", "c", "d"], answer: "B", test: "lectura_critica", competency: "reflexionar_evaluar", difficulty: 3 },
                  { question: "¿Qué función cumple el segundo párrafo?", options: ["a", "b", "c", "d"], answer: "C", test: "lectura_critica", competency: "comprender_articulacion", difficulty: 1 },
                ],
              },
            ],
          },
        ],
      })
    );
    const { units, skipped } = unitsFromImport(r.root, base, id, 5);
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ kind: "question", test: "matematicas", topic: "Funciones", questionCount: 1, status: "published" });
    expect(units[1]).toMatchObject({ kind: "passage", test: "lectura_critica", title: "El río", questionCount: 2, difficulty: 2 });
    expect(units[1].competencies).toEqual(["reflexionar_evaluar", "comprender_articulacion"]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain("falta la prueba");
  });

  it("valida los aportes", () => {
    expect(contributionProblem(mc("Una pregunta bien formulada", "matematicas", "argumentacion"))).toBeNull();
    expect(contributionProblem(mc("Una pregunta bien formulada", "matematicas", "xx"))).toContain("competencia");
    expect(contributionProblem({ ...mc("Una pregunta bien formulada", "ingles", "parte_1"), options: [{ text: "a", correct: true }, { text: "b", correct: true }, { text: "c", correct: false }] })).toContain("exactamente una");
  });
});

describe("catálogo: filtros y simulacro automático", () => {
  const units = [
    ...Array.from({ length: 12 }, (_, i) => unit("matematicas", i % 2 ? "argumentacion" : "formulacion_ejecucion")),
    unit("lectura_critica", "reflexionar_evaluar", "passage", 4),
    unit("lectura_critica", "comprender_articulacion", "passage", 3),
    ...Array.from({ length: 6 }, () => unit("lectura_critica", "identificar_entender")),
  ];

  it("filtra por prueba, competencia y texto", () => {
    expect(filterUnits(units, { test: "matematicas", competency: "argumentacion" })).toHaveLength(6);
    expect(filterUnits(units, { kind: "passage" })).toHaveLength(2);
    expect(filterUnits(units, { text: "LECTURA_CRITICA" })).toHaveLength(8);
  });

  it("reparte el total con las proporciones del Saber 11", () => {
    const c = mixCounts(40);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(40);
    expect(c["ciencias_naturales"]).toBeGreaterThanOrEqual(c["ingles"]);
  });

  it("llega al número pedido sin partir lecturas ni pasarse", () => {
    const r = autoSimulacro(units, { matematicas: 8, lectura_critica: 10 }, createRng(1));
    expect(r.got).toEqual({ matematicas: 8, lectura_critica: 10 });
    const math = r.units.filter((u) => u.test === "matematicas");
    expect(math.filter((u) => u.competencies[0] === "argumentacion")).toHaveLength(4);
    expect(r.units.some((u) => u.kind === "passage")).toBe(true);
    expect(r.short).toEqual([]);
  });

  it("avisa cuando el catálogo no alcanza", () => {
    const r = autoSimulacro(units, { matematicas: 20 }, createRng(2));
    expect(r.got["matematicas"]).toBe(12);
    expect(r.short).toEqual(["matematicas"]);
  });

  it("arma la carpeta por pruebas para copiar al banco", () => {
    const f = unitsToFolder(units.slice(-8), "Simulacro");
    expect(f.folders[0].name).toBe("Simulacro");
    expect(f.folders[0].folders.map((x) => x.name)).toEqual(["Lectura Crítica"]);
    expect(f.folders[0].folders[0].passages).toHaveLength(2);
    expect(f.folders[0].folders[0].questions).toHaveLength(6);
  });
});

describe("semillas del Banco ExamHub", () => {
  const fs = require("fs");
  const path = require("path");
  const load = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

  it.each(["docs/catalogo/semilla-01.json", "docs/demo/banco-saber11-29.json"])("%s se publica completa", (file) => {
    const r = parseBankInput(load(file));
    expect(r.errors).toEqual([]);
    const { units, skipped } = unitsFromImport(r.root, base, id);
    expect(skipped).toEqual([]);
    expect(units.length).toBeGreaterThan(10);
  });

  it("la semilla 01 trae 10 preguntas por prueba", () => {
    const { units } = unitsFromImport(parseBankInput(load("docs/catalogo/semilla-01.json")).root, base, id);
    const per: Record<string, number> = {};
    units.forEach((u) => (per[u.test] = (per[u.test] ?? 0) + u.questionCount));
    expect(per).toEqual({ lectura_critica: 10, matematicas: 10, sociales_ciudadanas: 10, ciencias_naturales: 10, ingles: 10 });
  });
});
