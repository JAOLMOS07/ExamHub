import { Document, Option } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { QuestionKind } from "../models/questionKind.enum";
import { buildForm, formLabel } from "./formBuilder";

function mcq(id: string, correct: number, extra: Partial<Document> = {}): Document {
  return {
    id,
    name: `Pregunta ${id}`,
    type: objectType.QUESTION,
    kind: QuestionKind.MULTIPLE_CHOICE_SINGLE,
    options: ["a", "b", "c", "d"].map(
      (t, i) => new Option(`${id}-${t}`, `${id} ${t}`, i === correct)
    ),
    ...extra,
  } as Document;
}

describe("buildForm", () => {
  const selection = Array.from({ length: 12 }, (_, i) => mcq(`q${i}`, i % 4));

  it("es determinista con la misma semilla", () => {
    const a = buildForm(selection, { seed: 42 });
    const b = buildForm(selection, { seed: 42 });
    expect(a.key).toEqual(b.key);
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  it("produce órdenes distintos con semillas distintas", () => {
    const a = buildForm(selection, { seed: 1 });
    const b = buildForm(selection, { seed: 2 });
    expect(a.questions.map((q) => q.id)).not.toEqual(b.questions.map((q) => q.id));
  });

  it("la letra de la clave apunta a la opción correcta tras barajar", () => {
    const form = buildForm(selection, { seed: 7 });
    form.questions.forEach((q, i) => {
      const entry = form.key[i];
      const idx = entry.letter!.charCodeAt(0) - 65;
      expect(q.options![idx].correct).toBe(true);
      expect(entry.itemId).toBe(q.id);
      // perm deshace el barajado: la opción impresa en idx es la original perm[idx]
      const original = selection.find((s) => s.id === q.id)!;
      expect(original.options![parseInt(entry.perm![idx], 36)].correct).toBe(true);
    });
  });

  it("mantiene las preguntas de una lectura juntas y debajo de ella", () => {
    const passage = {
      id: "p1",
      name: "Lectura 1",
      type: objectType.PASSAGE,
      passageText: "Texto",
    } as Document;
    const inPassage = [0, 1, 2].map((i) => mcq(`pq${i}`, 0, { passageId: "p1" }));
    const form = buildForm([...selection, passage, ...inPassage], { seed: 99 });
    const pos = form.sequence.findIndex((d) => d.id === "p1");
    expect(pos).toBeGreaterThanOrEqual(0);
    const following = form.sequence.slice(pos + 1, pos + 4).map((d) => d.passageId);
    expect(following).toEqual(["p1", "p1", "p1"]);
  });

  it("sintetiza la lectura desde passageContext si no fue seleccionada", () => {
    const qs = [0, 1].map((i) =>
      mcq(`c${i}`, 0, { passageId: "px", passageContext: "Contexto compartido" })
    );
    const form = buildForm(qs, { seed: 3 });
    expect(form.sequence[0].type).toBe(objectType.PASSAGE);
    expect(form.sequence[0].passageText).toBe("Contexto compartido");
  });

  it("respeta maxQuestions sin partir lecturas", () => {
    const form = buildForm(selection, { seed: 5, maxQuestions: 5 });
    expect(form.questions.length).toBe(5);
    expect(form.key.length).toBe(5);
  });

  it("modo simulacro agrupa por prueba en el orden ICFES", () => {
    const mixed = [
      mcq("m1", 0, { test: "matematicas" }),
      mcq("l1", 0, { test: "lectura_critica" }),
      mcq("i1", 0, { test: "ingles" }),
      mcq("m2", 0, { test: "matematicas" }),
      mcq("l2", 0, { test: "lectura_critica" }),
    ];
    const form = buildForm(mixed, { seed: 11, groupByTest: true });
    expect(form.key.map((k) => k.test)).toEqual([
      "lectura_critica",
      "lectura_critica",
      "matematicas",
      "matematicas",
      "ingles",
    ]);
  });

  it("no baraja Verdadero/Falso", () => {
    const tf = {
      id: "tf",
      name: "VF",
      type: objectType.QUESTION,
      kind: QuestionKind.TRUE_FALSE,
      options: [new Option("v", "Verdadero", false), new Option("f", "Falso", true)],
    } as Document;
    for (let seed = 0; seed < 10; seed++) {
      const form = buildForm([tf], { seed });
      expect(form.questions[0].options!.map((o) => o.id)).toEqual(["v", "f"]);
      expect(form.key[0].letter).toBe("B");
    }
  });

  it("preguntas abiertas no tienen letra en la clave", () => {
    const open = {
      id: "o",
      name: "Abierta",
      type: objectType.QUESTION,
      kind: QuestionKind.OPEN,
    } as Document;
    const form = buildForm([open], { seed: 1 });
    expect(form.key[0].letter).toBeNull();
    expect(form.maxOptions).toBe(2);
  });
});

describe("formLabel", () => {
  it("usa letras estilo planilla", () => {
    expect(formLabel(1)).toBe("A");
    expect(formLabel(26)).toBe("Z");
    expect(formLabel(27)).toBe("AA");
    expect(formLabel(28)).toBe("AB");
  });
});
