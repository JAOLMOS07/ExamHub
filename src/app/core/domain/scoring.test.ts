import { KeyEntry } from "../models/assessment.model";
import { QuestionKind } from "../models/questionKind.enum";
import { globalScore, scoreResponse, toScale } from "./scoring";
import { analyzeItems, itemFlags, pearson } from "./psychometrics";

const MCQ = QuestionKind.MULTIPLE_CHOICE_SINGLE;

const entry = (letter: string | null, extra: Partial<KeyEntry> = {}): KeyEntry => ({
  itemId: null,
  kind: letter ? MCQ : QuestionKind.OPEN,
  letter,
  ...extra,
});

describe("scoreResponse", () => {
  it("cuenta aciertos, ignora MULTI y suma puntaje manual", () => {
    const key = [entry("A"), entry("B"), entry("C"), entry(null)];
    const r = scoreResponse(key, ["A", "MULTI", "D", null], { 3: 0.5 });
    expect(r.correct).toBe(1.5);
    expect(r.total).toBe(4);
  });

  it("calcula puntaje por prueba, competencia y nivel", () => {
    const key = [
      entry("A", { test: "matematicas", competency: "argumentacion" }),
      entry("B", { test: "matematicas", competency: "argumentacion" }),
      entry("C", { test: "matematicas", competency: "formulacion_ejecucion" }),
      entry("D", { test: "matematicas", competency: "formulacion_ejecucion" }),
    ];
    const r = scoreResponse(key, ["A", "B", "C", "A"]);
    expect(r.byTest["matematicas"].score).toBe(75);
    expect(r.byTest["matematicas"].level).toBe(3);
    expect(r.byCompetency["matematicas:argumentacion"]).toEqual({ correct: 2, total: 2 });
    expect(r.byCompetency["matematicas:formulacion_ejecucion"]).toEqual({ correct: 1, total: 2 });
    expect(r.global).toBe(375);
    expect(r.globalComplete).toBe(false);
  });
});

describe("globalScore", () => {
  it("aplica la ponderación ICFES con las 5 pruebas", () => {
    const g = globalScore({
      lectura_critica: { score: 60 },
      matematicas: { score: 60 },
      sociales_ciudadanas: { score: 60 },
      ciencias_naturales: { score: 60 },
      ingles: { score: 100 },
    });
    // (60*12 + 100*1) / 13 * 5 = 315.38
    expect(g.global).toBe(315);
    expect(g.complete).toBe(true);
  });

  it("devuelve null sin pruebas", () => {
    expect(globalScore({}).global).toBeNull();
  });
});

describe("toScale", () => {
  it("escala y redondea a un decimal", () => {
    expect(toScale(7, 10, 5)).toBe(3.5);
    expect(toScale(0, 0, 5)).toBe(0);
  });
});

describe("analyzeItems", () => {
  const formA = {
    id: "v1",
    key: [
      { itemId: "i1", kind: MCQ, letter: "A", perm: "0123" },
      { itemId: "i2", kind: MCQ, letter: "B", perm: "0123" },
    ] as KeyEntry[],
  };
  // En la forma B el ítem i1 va segundo y con opciones invertidas.
  const formB = {
    id: "v2",
    key: [
      { itemId: "i2", kind: MCQ, letter: "B", perm: "0123" },
      { itemId: "i1", kind: MCQ, letter: "D", perm: "3210" },
    ] as KeyEntry[],
  };

  it("deshace la permutación de cada forma", () => {
    const res = analyzeItems(
      [formA, formB],
      [
        { formId: "v1", answers: ["A", "B"] },
        { formId: "v2", answers: ["B", "D"] },
        { formId: "v2", answers: ["A", "A"] }, // i1: impresa A → original 3
      ]
    );
    const i1 = res.find((r) => r.itemId === "i1")!;
    expect(i1.n).toBe(3);
    expect(i1.pValue).toBeCloseTo(2 / 3);
    expect(i1.correctOption).toBe(0);
    expect(i1.optionShare[0]).toBeCloseTo(2 / 3);
    expect(i1.optionShare[3]).toBeCloseTo(1 / 3);
  });

  it("marca distractores más atractivos que la clave", () => {
    const flags = itemFlags(
      {
        itemId: "x",
        position: 0,
        n: 20,
        pValue: 0.3,
        discrimination: 0.4,
        optionShare: [0.3, 0.5, 0.1, 0.1],
        correctOption: 0,
        omitted: 0,
        multi: 0,
      },
      10
    );
    expect(flags).toContain("distractor_atractivo");
  });
});

describe("pearson", () => {
  it("es 1 para series perfectamente correlacionadas", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });
  it("es null sin varianza", () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
