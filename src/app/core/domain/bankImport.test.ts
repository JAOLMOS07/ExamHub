import {
  buildConvertPrompt,
  buildGeneratePrompt,
  countTree,
  defaultGenerateOptions,
  extractJson,
  parseBankInput,
} from "./bankImport";
import { QuestionKind } from "../models/questionKind.enum";

describe("importar JSON", () => {
  it("ignora el texto y los ``` que agrega la IA", () => {
    const r = parseBankInput(
      'Claro, aquí está:\n```json\n{"questions":[{"type":"multiple-choice","question":"2+2","options":[{"text":"3","correct":false},{"text":"4","correct":true}]}]}\n```\n¡Éxitos!'
    );
    expect(r.format).toBe("json");
    expect(r.errors).toEqual([]);
    expect(r.root.questions[0].options?.[1]).toEqual({ text: "4", correct: true });
  });

  it("lee carpetas anidadas con lecturas", () => {
    const r = parseBankInput(
      JSON.stringify({
        folders: [
          {
            name: "Matemáticas",
            folders: [
              {
                name: "Fracciones",
                questions: [{ question: "½ + ½", options: ["1", "2"], answer: "A" }],
                passages: [{ title: "Tienda", text: "Doña Rosa vende…", questions: [{ question: "¿Cuánto?", type: "open" }] }],
              },
            ],
          },
        ],
      })
    );
    expect(r.errors).toEqual([]);
    expect(r.root.folders[0].name).toBe("Matemáticas");
    const sub = r.root.folders[0].folders[0];
    expect(sub.questions[0].options).toEqual([
      { text: "1", correct: true },
      { text: "2", correct: false },
    ]);
    expect(sub.passages[0].questions[0].kind).toBe(QuestionKind.OPEN);
    expect(countTree(r.root)).toEqual({ folders: 2, passages: 1, questions: 2 });
  });

  it("tolera comas finales, letras en las opciones y la prueba por nombre", () => {
    const r = parseBankInput(
      '{"questions":[{"question":"x","options":["A) uno","B) dos",],"answer":1,"test":"Matemáticas","competency":"argumentacion",}]}'
    );
    expect(r.errors).toEqual([]);
    const q = r.root.questions[0];
    expect(q.options?.map((o) => o.text)).toEqual(["uno", "dos"]);
    expect(q.options?.[1].correct).toBe(true);
    expect(q.test).toBe("matematicas");
    expect(q.competency).toBe("argumentacion");
  });

  it("descarta preguntas sin clave única y lo informa", () => {
    const r = parseBankInput('{"questions":[{"question":"x","options":[{"text":"a","correct":true},{"text":"b","correct":true}]}]}');
    expect(r.root.questions).toHaveLength(0);
    expect(r.errors.join(" ")).toContain("exactamente una");
  });

  it("no confunde texto con llaves con JSON", () => {
    expect(extractJson("1. Si A = {1, 2}, ¿cuántos elementos tiene?\na) 1\nb) 2\nRespuesta: b")).toBeNull();
  });
});

describe("importar texto de Word", () => {
  const word = `# Matemáticas
## Fracciones
1. ¿Cuánto es 1/2 + 1/4?
a) 3/4
b) 2/6
c) 1/8
Respuesta: A
Justificación: se lleva a denominador común.

2) Una pregunta
que sigue en otra línea
A. opción uno
*B. opción dos
C. opción tres

LECTURA: El río
El río Magdalena atraviesa el país.
Es la arteria fluvial principal.
3. ¿Qué atraviesa el país?
a) El río (correcta)
b) La montaña
4. Explica con tus palabras.
FIN LECTURA

# Ciencias
5. El agua hierve a 100 °C al nivel del mar.
a) Verdadero
b) Falso
Respuesta: a
6. ¿Cuántos huesos tiene el cuerpo humano adulto?
Respuesta: 206`;

  it("arma carpetas, lecturas y tipos de pregunta", () => {
    const r = parseBankInput(word);
    expect(r.format).toBe("text");
    expect(r.errors).toEqual([]);
    const mat = r.root.folders[0];
    expect(mat.name).toBe("Matemáticas");
    const frac = mat.folders[0];
    expect(frac.name).toBe("Fracciones");
    expect(frac.questions).toHaveLength(2);
    expect(frac.questions[0].options?.[0].correct).toBe(true);
    expect(frac.questions[0].rationale).toBe("se lleva a denominador común.");
    expect(frac.questions[1].text).toBe("Una pregunta\nque sigue en otra línea");
    expect(frac.questions[1].options?.[1]).toEqual({ text: "opción dos", correct: true });

    const passage = frac.passages[0];
    expect(passage.title).toBe("El río");
    expect(passage.text).toBe("El río Magdalena atraviesa el país.\nEs la arteria fluvial principal.");
    expect(passage.questions.map((q) => q.kind)).toEqual([QuestionKind.MULTIPLE_CHOICE_SINGLE, QuestionKind.OPEN]);

    const cien = r.root.folders[1];
    expect(cien.questions[0].kind).toBe(QuestionKind.TRUE_FALSE);
    expect(cien.questions[1]).toMatchObject({ kind: QuestionKind.NUMERIC, numericAnswer: 206 });
  });

  it("avisa cuando falta la respuesta", () => {
    const r = parseBankInput("1. Pregunta\na) uno\nb) dos");
    expect(r.root.questions).toHaveLength(0);
    expect(r.errors[0]).toContain("falta la respuesta");
  });
});

describe("prompts", () => {
  it("el de generar incluye prueba, competencias, cantidad y carpeta", () => {
    const p = buildGeneratePrompt({
      ...defaultGenerateOptions(),
      topic: "Funciones lineales",
      test: "matematicas",
      competencies: ["argumentacion"],
      count: 12,
      passages: 2,
      questionsPerPassage: 3,
    });
    expect(p).toContain("exactamente 12 preguntas");
    expect(p).toContain('"test": "matematicas"');
    expect(p).toContain("argumentacion: Argumentación");
    expect(p).not.toContain("formulacion_ejecucion: Formulación");
    expect(p).toContain("6 de las 12 preguntas");
    expect(p).toContain('"Matemáticas — Funciones lineales"');
  });

  it("el de convertir pide no inventar preguntas", () => {
    expect(buildConvertPrompt()).toContain("No inventes preguntas");
  });
});
