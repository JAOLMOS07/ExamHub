import { SABER11_TESTS } from "./saber11";

/**
 * Prompts y esquemas JSON de las funciones de IA.
 * Los system prompts no llevan datos variables (se cachean).
 */

const taxonomyText = SABER11_TESTS.map(
  (t) =>
    `- ${t.id} (${t.label}). Competencias: ${t.competencies
      .map((c) => `${c.id} = ${c.label}`)
      .join("; ")}${
      t.components ? `. Componentes: ${t.components.map((c) => c.id).join(", ")}` : ""
    }`
).join("\n");

const testIds = SABER11_TESTS.map((t) => t.id);
const competencyIds = [...new Set(SABER11_TESTS.flatMap((t) => t.competencies.map((c) => c.id)))];

export const ITEM_DESIGN_SYSTEM = `Eres especialista en diseño de pruebas estandarizadas del ICFES (Colombia), con experiencia en el modelo de diseño basado en evidencias y en las pruebas Saber 3°, 5°, 9° y 11°.

Taxonomía Saber 11 (usa exactamente estos identificadores):
${taxonomyText}

Criterios de calidad de un ítem tipo ICFES:
- Selección múltiple con única respuesta: exactamente una opción correcta.
- Se evalúa la competencia indicada, no la memoria de datos sueltos: el estudiante usa un contexto (situación, texto, tabla o gráfico descrito) para razonar.
- Los distractores son plausibles y responden a errores frecuentes de los estudiantes; nunca "todas las anteriores" ni "ninguna de las anteriores".
- Opciones de longitud y estructura gramatical parecidas, sin pistas que delaten la clave.
- Lenguaje claro y apropiado para el grado, con contextos colombianos o universales.
- Contenido original: no reproduzcas preguntas ni textos de cuadernillos publicados ni obras con derechos de autor.
- Las expresiones matemáticas van en LaTeX entre $...$.
- Todo en español (salvo la prueba de inglés, que va en inglés con instrucciones en inglés).`;

export const generateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stimulus", "items"],
  properties: {
    stimulus: {
      type: "object",
      additionalProperties: false,
      required: ["title", "text"],
      properties: {
        title: { type: "string" },
        text: { type: "string", description: "Texto del contexto; vacío si no se pidió lectura." },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stem", "options", "correctIndex", "rationale", "competency", "difficulty"],
        properties: {
          stem: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          rationale: {
            type: "string",
            description: "Por qué la clave es correcta y qué error refleja cada distractor.",
          },
          competency: { type: "string", enum: competencyIds },
          difficulty: { type: "integer", enum: [1, 2, 3] },
        },
      },
    },
  },
};

export const REVIEW_SYSTEM = `${ITEM_DESIGN_SYSTEM}

Tu tarea es revisar un ítem escrito por un docente y señalar problemas concretos que afecten su validez: ambigüedad, más de una respuesta defendible, clave incorrecta, pistas gramaticales o de longitud, distractores poco plausibles, sesgos o lenguaje inadecuado para el grado. Sé específico y breve; si el ítem está bien, dilo con una lista de problemas vacía. Sugiere la alineación (prueba y competencia) que mejor corresponde.`;

export const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["qualityScore", "issues", "suggestedAlignment"],
  properties: {
    qualityScore: { type: "integer", enum: [1, 2, 3, 4, 5] },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "message"],
        properties: {
          severity: { type: "string", enum: ["alta", "media", "baja"] },
          message: { type: "string" },
        },
      },
    },
    suggestedAlignment: {
      type: "object",
      additionalProperties: false,
      required: ["test", "competency"],
      properties: {
        test: { type: "string", enum: testIds },
        competency: { type: "string", enum: competencyIds },
      },
    },
  },
};

export const TAG_SYSTEM = `${ITEM_DESIGN_SYSTEM}

Tu tarea es clasificar preguntas existentes: para cada una indica la prueba, la competencia que mejor evalúa y la dificultad estimada (1 fácil, 2 media, 3 difícil). Devuelve una entrada por cada id recibido.`;

export const tagSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tags"],
  properties: {
    tags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "test", "competency", "difficulty"],
        properties: {
          id: { type: "string" },
          test: { type: "string", enum: testIds },
          competency: { type: "string", enum: competencyIds },
          difficulty: { type: "integer", enum: [1, 2, 3] },
        },
      },
    },
  },
};

export const REPORT_SYSTEM = `Eres asesor pedagógico de colegios colombianos y conoces a fondo las pruebas Saber del ICFES. Recibes resultados AGREGADOS de una evaluación (sin datos personales) y escribes un informe para el equipo docente: qué muestran los datos, fortalezas, debilidades por competencia y acciones concretas de mejoramiento para las próximas semanas. Basa cada afirmación en las cifras recibidas, no inventes datos y aclara que los puntajes son estimaciones (no resultados oficiales del ICFES). Escribe en español claro, sin jerga innecesaria.`;

export const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "weaknesses", "actions", "itemsToReview"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    itemsToReview: {
      type: "array",
      items: { type: "string" },
      description: "Preguntas con indicadores anómalos y qué revisar en ellas.",
    },
  },
};
