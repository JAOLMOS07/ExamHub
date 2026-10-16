/**
 * Importación de bancos de preguntas — lógica pura (sin Angular).
 *
 * Acepta dos entradas:
 *   - JSON producido por cualquier IA (ChatGPT, Claude, Gemini…) con
 *     los prompts de este archivo. Es tolerante: ignora texto o ```json
 *     alrededor, acepta opciones como texto y la clave como letra.
 *   - Texto pegado desde Word ("1. Enunciado / a) … / Respuesta: B"),
 *     sin IA de por medio.
 *
 * Ambos producen el mismo árbol de carpetas → lecturas → preguntas.
 */

import { QuestionKind } from "../models/questionKind.enum";
import { SABER11_TESTS, getCompetency, getTest } from "./taxonomy/saber11";

export interface ImportOption {
  text: string;
  correct: boolean;
}

export interface ImportQuestion {
  kind: QuestionKind;
  text: string;
  options?: ImportOption[];
  numericAnswer?: number;
  numericTolerance?: number;
  subject?: string;
  grade?: string;
  difficulty?: number;
  test?: string;
  competency?: string;
  component?: string;
  rationale?: string;
}

export interface ImportPassage {
  title: string;
  text: string;
  questions: ImportQuestion[];
}

export interface ImportFolder {
  name: string;
  questions: ImportQuestion[];
  passages: ImportPassage[];
  folders: ImportFolder[];
}

export interface ImportParse {
  format: "json" | "text";
  root: ImportFolder;
  /** Problemas encontrados; lo válido se importa igual. */
  errors: string[];
}

export function emptyFolder(name = ""): ImportFolder {
  return { name, questions: [], passages: [], folders: [] };
}

export interface TreeCount {
  folders: number;
  passages: number;
  questions: number;
}

export function countTree(f: ImportFolder): TreeCount {
  const own: TreeCount = {
    folders: f.folders.length,
    passages: f.passages.length,
    questions: f.questions.length + f.passages.reduce((a, p) => a + p.questions.length, 0),
  };
  for (const sub of f.folders) {
    const c = countTree(sub);
    own.folders += c.folders;
    own.passages += c.passages;
    own.questions += c.questions;
  }
  return own;
}

/** Detecta el formato y parsea. */
export function parseBankInput(input: string): ImportParse {
  const json = extractJson(input);
  if (json !== null) return parseBankJson(json);
  return parseBankText(input);
}

/**
 * Devuelve el JSON contenido en el texto (sin ```json ni comentarios
 * de la IA alrededor) o null si no parece JSON.
 */
export function extractJson(input: string): string | null {
  let text = input.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  // Texto plano con llaves sueltas (ej. conjuntos en matemáticas): solo
  // lo tratamos como JSON si empieza con { o menciona las claves.
  const body = text.slice(start, end + 1);
  if (start > 0 && !/"(questions|passages|folders)"\s*:/.test(body)) return null;
  return body;
}

// =====================================================================
//  JSON
// =====================================================================

export function parseBankJson(jsonText: string): ImportParse {
  const result: ImportParse = { format: "json", root: emptyFolder(), errors: [] };
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    // Coma al final de una lista: error típico de las IA.
    try {
      data = JSON.parse(jsonText.replace(/,\s*([\]}])/g, "$1"));
    } catch (e: any) {
    result.errors.push(
        `El JSON no es válido (${e.message}). Pídele a la IA que lo devuelva completo, sin cortar.`
      );
      return result;
    }
  }
  if (Array.isArray(data)) data = { questions: data };
  if (typeof data !== "object" || data === null) {
    result.errors.push("El JSON debe ser un objeto con 'questions', 'passages' o 'folders'.");
    return result;
  }
  result.root = mapFolder(data, "", result.errors);
  const c = countTree(result.root);
  if (c.questions === 0 && c.passages === 0) {
    result.errors.unshift("No encontramos preguntas en el JSON.");
  }
  return result;
}

function mapFolder(raw: any, path: string, errors: string[]): ImportFolder {
  const folder = emptyFolder(str(raw.name ?? raw.title ?? raw.nombre) || "Carpeta");
  const at = (key: string, i: number) => (path ? `${path} › ` : "") + `${key} ${i + 1}`;

  arr(raw.questions ?? raw.preguntas).forEach((rq, i) => {
    const q = mapQuestion(rq, at("pregunta", i), errors);
    if (q) folder.questions.push(q);
  });

  arr(raw.passages ?? raw.lecturas).forEach((rp, i) => {
    const where = at("lectura", i);
    const text = str(rp?.text ?? rp?.texto ?? rp?.content);
    if (!text) {
      errors.push(`${where}: la lectura no tiene texto.`);
      return;
    }
    const passage: ImportPassage = {
      title: str(rp.title ?? rp.titulo ?? rp.name) || "Lectura",
      text,
      questions: [],
    };
    arr(rp.questions ?? rp.preguntas).forEach((rq, j) => {
      const q = mapQuestion(rq, `${where} › pregunta ${j + 1}`, errors);
      if (q) passage.questions.push(q);
    });
    folder.passages.push(passage);
  });

  arr(raw.folders ?? raw.carpetas).forEach((rf, i) => {
    if (typeof rf !== "object" || rf === null) return;
    const name = str(rf.name ?? rf.nombre) || `Carpeta ${i + 1}`;
    folder.folders.push(mapFolder(rf, path ? `${path} › ${name}` : name, errors));
  });
  return folder;
}

const KIND_ALIASES: Record<string, QuestionKind> = {
  "multiple-choice": QuestionKind.MULTIPLE_CHOICE_SINGLE,
  "multiple_choice": QuestionKind.MULTIPLE_CHOICE_SINGLE,
  "multiple-choice-single": QuestionKind.MULTIPLE_CHOICE_SINGLE,
  mcq: QuestionKind.MULTIPLE_CHOICE_SINGLE,
  "true-false": QuestionKind.TRUE_FALSE,
  "true_false": QuestionKind.TRUE_FALSE,
  open: QuestionKind.OPEN,
  abierta: QuestionKind.OPEN,
  numeric: QuestionKind.NUMERIC,
  numerica: QuestionKind.NUMERIC,
};

function mapQuestion(raw: any, where: string, errors: string[]): ImportQuestion | null {
  if (typeof raw === "string") raw = { question: raw };
  if (typeof raw !== "object" || raw === null) {
    errors.push(`${where}: no es una pregunta.`);
    return null;
  }
  const text = str(raw.question ?? raw.text ?? raw.statement ?? raw.enunciado ?? raw.pregunta);
  if (!text) {
    errors.push(`${where}: falta el enunciado.`);
    return null;
  }

  const rawOptions = arr(raw.options ?? raw.opciones ?? raw.choices);
  let kind: QuestionKind | undefined = KIND_ALIASES[String(raw.type ?? raw.tipo ?? "").toLowerCase()];
  if (!kind) {
    if (rawOptions.length >= 2) kind = QuestionKind.MULTIPLE_CHOICE_SINGLE;
    else if (raw.numericAnswer !== undefined) kind = QuestionKind.NUMERIC;
    else kind = QuestionKind.OPEN;
  }

  const q: ImportQuestion = { kind, text };

  if (kind === QuestionKind.MULTIPLE_CHOICE_SINGLE || kind === QuestionKind.TRUE_FALSE) {
    const options: ImportOption[] = rawOptions.map((o: any) =>
      typeof o === "object" && o !== null
        ? {
            text: stripLetter(str(o.text ?? o.content ?? o.option ?? o.texto)),
            correct: o.correct === true || o.correct === "true" || o.correcta === true,
          }
        : { text: stripLetter(String(o ?? "").trim()), correct: false }
    );
    if (options.length < 2) {
      errors.push(`${where}: necesita al menos 2 opciones.`);
      return null;
    }
    const answer = raw.answer ?? raw.respuesta ?? raw.correctAnswer ?? raw.clave;
    if (!options.some((o) => o.correct) && answer !== undefined) {
      const idx = answerIndex(answer, options);
      if (idx !== null) options[idx].correct = true;
    }
    const correct = options.filter((o) => o.correct).length;
    if (correct !== 1) {
      errors.push(
        `${where}: debe tener exactamente una opción correcta (tiene ${correct}). "${preview(text)}"`
      );
      return null;
    }
    if (options.some((o) => !o.text)) {
      errors.push(`${where}: hay una opción vacía. "${preview(text)}"`);
      return null;
    }
    q.options = options;
  }

  if (kind === QuestionKind.NUMERIC) {
    const n = Number(String(raw.numericAnswer ?? raw.answer ?? raw.respuesta).replace(",", "."));
    if (!isFinite(n)) {
      errors.push(`${where}: la pregunta numérica necesita 'numericAnswer'.`);
      return null;
    }
    q.numericAnswer = n;
    const tol = Number(raw.numericTolerance ?? 0);
    q.numericTolerance = isFinite(tol) && tol > 0 ? tol : 0;
  }

  applyMetadata(q, raw);
  return q;
}

function applyMetadata(q: ImportQuestion, raw: any): void {
  const subject = str(raw.subject ?? raw.materia);
  if (subject) q.subject = subject;
  const grade = str(raw.grade ?? raw.grado);
  if (grade) q.grade = grade;
  const d = Number(raw.difficulty ?? raw.dificultad);
  if ([1, 2, 3].includes(d)) q.difficulty = d;
  const test = normalizeTestId(raw.test ?? raw.prueba);
  if (test) {
    q.test = test;
    if (getCompetency(test, raw.competency)) q.competency = raw.competency;
    const comp = getTest(test)?.components?.find((c) => c.id === raw.component);
    if (comp) q.component = comp.id;
  }
  const rationale = str(raw.rationale ?? raw.explanation ?? raw.justificacion ?? raw.explicacion);
  if (rationale) q.rationale = rationale;
}

/** Acepta el id o el nombre de la prueba ("Matemáticas" → matematicas). */
function normalizeTestId(value: any): string | undefined {
  if (!value) return undefined;
  if (getTest(value)) return value;
  const key = fold(String(value));
  return SABER11_TESTS.find((t) => fold(t.label) === key || fold(t.shortLabel) === key)?.id;
}

function answerIndex(answer: any, options: ImportOption[]): number | null {
  if (typeof answer === "number") {
    // 0-based si cabe; si no, 1-based.
    if (answer >= 0 && answer < options.length) return answer;
    if (answer >= 1 && answer <= options.length) return answer - 1;
    return null;
  }
  const s = String(answer).trim();
  const letter = s.match(/^\(?([a-hA-H])\)?[.)]?$/);
  if (letter) {
    const i = letter[1].toUpperCase().charCodeAt(0) - 65;
    return i < options.length ? i : null;
  }
  const i = options.findIndex((o) => fold(o.text) === fold(s));
  return i === -1 ? null : i;
}

// =====================================================================
//  Texto pegado desde Word
// =====================================================================

const RE_FOLDER = /^(#{1,3})\s*(.+)$|^(sub)?carpeta\s*:\s*(.+)$/i;
/** "Lectura: título", "Texto 2:", "Contexto:" o "LECTURA" en mayúsculas. */
const RE_PASSAGE = /^(?:lectura|texto|contexto)(?:\s+\d+)?\s*:\s*(.*)$|^LECTURA(?:\s+\d+)?\b\s*[.\-–]?\s*(.*)$/;
const RE_PASSAGE_CI = /^(?:lectura|texto|contexto)(?:\s+\d+)?\s*:\s*(.*)$/i;
const RE_END_PASSAGE = /^fin\s+(de\s+(la\s+)?)?lectura\b/i;
const RE_QUESTION = /^(?:pregunta\s*)?(\d{1,3})\s*[.)\-–:]\s*(.+)$/i;
const RE_OPTION = /^(\*)?\s*\(?([a-hA-H])\s*[).]\s*(.+)$/;
const RE_ANSWER =
  /^(?:respuesta(?:\s+correcta)?|clave|rta|resp|answer)\.?\s*[:=\-–]?\s*(.+)$/i;
const RE_RATIONALE = /^(?:justificaci[oó]n|explicaci[oó]n|retroalimentaci[oó]n)\s*[:.\-–]\s*(.+)$/i;
const RE_MARK = /\s*(\(\s*correcta\s*\)|\[\s*correcta\s*\]|✓|✔|\(x\))\s*$/i;

interface DraftQuestion {
  number: string;
  text: string[];
  options: { letter: string; text: string[]; correct: boolean }[];
  answer?: string;
  rationale?: string;
}

/**
 * Formato aceptado (flexible):
 *
 *   # Carpeta            (## subcarpeta)   o   CARPETA: Nombre
 *   LECTURA: Título
 *   Texto de la lectura…
 *   1. Enunciado
 *   a) opción            (*b) o "b) opción (correcta)" marca la clave)
 *   Respuesta: B
 *   Justificación: …
 *   FIN LECTURA          (opcional: si no, la lectura sigue hasta la
 *                         próxima carpeta o lectura)
 */
export function parseBankText(input: string): ImportParse {
  const result: ImportParse = { format: "text", root: emptyFolder(), errors: [] };
  const stack: { level: number; folder: ImportFolder }[] = [{ level: 0, folder: result.root }];
  const current = () => stack[stack.length - 1].folder;

  let passage: ImportPassage | null = null;
  let passageCollecting = false;
  let draft: DraftQuestion | null = null;
  let lastTarget: "question" | "option" | "rationale" | null = null;

  const flush = () => {
    if (!draft) return;
    const q = finishDraft(draft, result.errors);
    if (q) (passage ? passage.questions : current().questions).push(q);
    draft = null;
    lastTarget = null;
  };
  const closePassage = () => {
    flush();
    if (passage) {
      if (!passage.text.trim()) result.errors.push(`Lectura "${passage.title}": no tiene texto.`);
      else current().passages.push(passage);
    }
    passage = null;
    passageCollecting = false;
  };

  for (const rawLine of input.replace(/\r/g, "").split("\n")) {
    const line = rawLine.replace(/\t/g, " ").replace(/ /g, " ").trim();
    if (!line) {
      if (passageCollecting && passage) passage.text += "\n\n";
      continue;
    }

    const folderMatch = line.match(RE_FOLDER);
    if (folderMatch) {
      closePassage();
      const level = folderMatch[1] ? folderMatch[1].length : folderMatch[3] ? 2 : 1;
      const name = (folderMatch[2] ?? folderMatch[4]).trim();
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const folder = emptyFolder(name);
      current().folders.push(folder);
      stack.push({ level, folder });
      continue;
    }
    if (RE_END_PASSAGE.test(line)) {
      closePassage();
      continue;
    }
    const passageMatch = line.match(RE_PASSAGE_CI) ?? line.match(RE_PASSAGE);
    if (passageMatch) {
      closePassage();
      const title = (passageMatch[1] ?? passageMatch[2] ?? "").trim();
      passage = { title: title || "Lectura", text: "", questions: [] };
      passageCollecting = true;
      continue;
    }

    const qMatch = line.match(RE_QUESTION);
    if (qMatch) {
      flush();
      passageCollecting = false;
      draft = { number: qMatch[1], text: [qMatch[2].trim()], options: [] };
      lastTarget = "question";
      continue;
    }

    if (passageCollecting && passage) {
      passage.text += (passage.text && !passage.text.endsWith("\n\n") ? "\n" : "") + line;
      continue;
    }

    if (!draft) {
      result.errors.push(`Línea ignorada (no pertenece a ninguna pregunta): "${preview(line)}"`);
      continue;
    }
    const d: DraftQuestion = draft;

    const ansMatch = line.match(RE_ANSWER);
    if (ansMatch) {
      d.answer = ansMatch[1].trim();
      lastTarget = null;
      continue;
    }
    const ratMatch = line.match(RE_RATIONALE);
    if (ratMatch) {
      d.rationale = ratMatch[1].trim();
      lastTarget = "rationale";
      continue;
    }
    const optMatch = line.match(RE_OPTION);
    if (optMatch && expectedLetter(d) === optMatch[2].toUpperCase()) {
      let text = optMatch[3].trim();
      const marked = RE_MARK.test(text);
      text = text.replace(RE_MARK, "").trim();
      d.options.push({ letter: optMatch[2].toUpperCase(), text: [text], correct: !!optMatch[1] || marked });
      lastTarget = "option";
      continue;
    }

    if (lastTarget === "option") d.options[d.options.length - 1].text.push(line);
    else if (lastTarget === "rationale") d.rationale += " " + line;
    else d.text.push(line);
  }
  closePassage();

  const c = countTree(result.root);
  if (c.questions === 0 && result.errors.length === 0) {
    result.errors.unshift(
      "No encontramos preguntas. Cada pregunta debe empezar con su número (1. o 1)) y sus opciones con a), b), c)…"
    );
  }
  return result;
}

function expectedLetter(d: DraftQuestion): string {
  return String.fromCharCode(65 + d.options.length);
}

function finishDraft(d: DraftQuestion, errors: string[]): ImportQuestion | null {
  const text = d.text.join("\n").trim();
  const where = `Pregunta ${d.number}`;
  const options = d.options.map((o) => ({ text: o.text.join(" ").trim(), correct: o.correct }));
  const q: ImportQuestion = { kind: QuestionKind.OPEN, text };
  if (d.rationale) q.rationale = d.rationale.trim();

  if (options.length >= 2) {
    if (d.answer && !options.some((o) => o.correct)) {
      const idx = answerIndex(d.answer.replace(/[.)\s].*$/, "") || d.answer, options);
      if (idx !== null) options[idx].correct = true;
    }
    const correct = options.filter((o) => o.correct).length;
    if (correct !== 1) {
      errors.push(
        correct === 0
          ? `${where}: falta la respuesta. Agrega "Respuesta: B" debajo de las opciones. "${preview(text)}"`
          : `${where}: tiene ${correct} opciones marcadas como correctas. "${preview(text)}"`
      );
      return null;
    }
    const tf =
      options.length === 2 &&
      /^verdader[oa]$/i.test(options[0].text) &&
      /^fals[oa]$/i.test(options[1].text);
    q.kind = tf ? QuestionKind.TRUE_FALSE : QuestionKind.MULTIPLE_CHOICE_SINGLE;
    q.options = options;
    return q;
  }
  if (options.length === 1) {
    errors.push(`${where}: tiene una sola opción. "${preview(text)}"`);
    return null;
  }
  const n = d.answer !== undefined ? Number(d.answer.replace(",", ".")) : NaN;
  if (d.answer !== undefined && isFinite(n)) {
    q.kind = QuestionKind.NUMERIC;
    q.numericAnswer = n;
    q.numericTolerance = 0;
  }
  return q;
}

// =====================================================================
//  Prompts para la IA del docente
// =====================================================================

const FORMAT_SPEC = `FORMATO DE SALIDA (JSON):
{
  "folders": [
    {
      "name": "Nombre de la carpeta",
      "questions": [
        {
          "type": "multiple-choice",
          "question": "Enunciado completo",
          "options": [
            { "text": "Opción A", "correct": false },
            { "text": "Opción B", "correct": true },
            { "text": "Opción C", "correct": false },
            { "text": "Opción D", "correct": false }
          ],
          "subject": "Matemáticas",
          "grade": "11",
          "difficulty": 2,
          "test": "matematicas",
          "competency": "formulacion_ejecucion",
          "rationale": "Por qué la clave es correcta y qué error refleja cada distractor"
        }
      ],
      "passages": [
        {
          "title": "Título de la lectura",
          "text": "Texto completo de la lectura, gráfica descrita o situación",
          "questions": [ /* preguntas con el mismo formato */ ]
        }
      ],
      "folders": [ /* subcarpetas opcionales con el mismo formato */ ]
    }
  ]
}

TIPOS DE PREGUNTA:
- "multiple-choice": al menos 2 opciones y EXACTAMENTE UNA con "correct": true.
- "true-false": dos opciones, "Verdadero" y "Falso", con la correcta marcada.
- "open": sin "options" (se corrige a mano).
- "numeric": sin "options", con "numericAnswer" (número) y "numericTolerance" opcional.

CAMPOS OPCIONALES: subject, grade, difficulty (1 fácil, 2 media, 3 difícil), test, competency, rationale.
Si la pregunta corresponde a una prueba Saber 11, usa estos ids en "test" y "competency":
${SABER11_TESTS.map(
  (t) => `  ${t.id}: ${t.competencies.map((c) => c.id).join(", ")}`
).join("\n")}

REGLAS DE SALIDA:
- Responde ÚNICAMENTE con el JSON, sin texto antes ni después y sin \`\`\`.
- El JSON debe ser válido (sin comentarios, sin comas al final). Los /* */ del ejemplo son solo explicativos.
- Escribe las fórmulas matemáticas en LaTeX entre signos $, por ejemplo $\\\\frac{3}{4}$ o $x^2$ (con la barra invertida escapada dentro del JSON).
- Si la respuesta es muy larga y se va a cortar, termina el JSON en una pregunta completa y dime que pida "continúa" para el resto en un JSON nuevo.`;

/** Prompt para convertir el material propio del docente (Word, PDF…). */
export function buildConvertPrompt(organizeInFolders = true): string {
  return `Eres un asistente que convierte bancos de preguntas al formato de ExamHub, una plataforma colombiana de evaluaciones tipo Saber 11.

TAREA: convierte el material que pego al final a JSON con el formato de abajo.
- No inventes preguntas: usa solo las de mi material y conserva su redacción.
- Si una pregunta no tiene la respuesta marcada, deduce la correcta y explícalo en "rationale" empezando con "[Clave sugerida]".
- Si un texto, gráfica o situación sirve para varias preguntas, ponlo como lectura en "passages".
${
  organizeInFolders
    ? `- Organiza las preguntas en carpetas por tema o unidad, según como venga el material (puedes usar subcarpetas).`
    : `- Pon todo en una sola carpeta.`
}
- Infiere materia, grado y dificultad cuando sea claro; si no, omítelos.

${FORMAT_SPEC}

MI MATERIAL:
==========================================
[PEGA AQUÍ TU MATERIAL]
==========================================`;
}

export type FolderBy = "none" | "topic" | "competency" | "difficulty";

export interface GenerateOptions {
  /** Temas, uno por línea o separados por coma. */
  topic: string;
  /** Prueba Saber 11; vacío = tema libre (no ICFES). */
  test: string;
  competencies: string[];
  grade: string;
  subject: string;
  count: number;
  /** 0 = mezcla 30/50/20. */
  difficulty: 0 | 1 | 2 | 3;
  /** Cuántas de las preguntas van agrupadas en lecturas. */
  passages: number;
  questionsPerPassage: number;
  folderBy: FolderBy;
  /** Nombre de la carpeta principal. */
  folderName: string;
  /** Material base opcional (guía, texto, temario). */
  source: string;
  notes: string;
}

export function defaultGenerateOptions(): GenerateOptions {
  return {
    topic: "",
    test: "",
    competencies: [],
    grade: "11",
    subject: "",
    count: 20,
    difficulty: 0,
    passages: 0,
    questionsPerPassage: 3,
    folderBy: "topic",
    folderName: "",
    source: "",
    notes: "",
  };
}

const DIFFICULTY_TEXT: Record<number, string> = {
  0: "mezcla: 30 % fáciles (1), 50 % medias (2) y 20 % difíciles (3)",
  1: "todas fáciles (1)",
  2: "todas de dificultad media (2)",
  3: "todas difíciles (3)",
};

const FOLDER_BY_TEXT: Record<FolderBy, string> = {
  none: "Pon todas las preguntas directamente en la carpeta principal, sin subcarpetas.",
  topic: "Dentro de la carpeta principal, crea una subcarpeta por tema.",
  competency: "Dentro de la carpeta principal, crea una subcarpeta por competencia evaluada.",
  difficulty: 'Dentro de la carpeta principal, crea subcarpetas "Fácil", "Media" y "Difícil".',
};

/** Prompt para generar preguntas nuevas de cualquier tema. */
export function buildGeneratePrompt(o: GenerateOptions): string {
  const test = getTest(o.test);
  const count = Math.max(1, Math.round(o.count || 1));
  const inPassages = Math.min(count, Math.max(0, o.passages) * Math.max(1, o.questionsPerPassage));
  const folderName =
    o.folderName.trim() ||
    [test?.label ?? (o.subject.trim() || "Banco"), firstLine(o.topic)].filter(Boolean).join(" — ");
  const comps = test
    ? (o.competencies.length ? o.competencies : test.competencies.map((c) => c.id))
        .map((id) => getCompetency(test.id, id))
        .filter((c): c is NonNullable<typeof c> => !!c)
    : [];

  const lines: string[] = [];
  lines.push(
    test
      ? `Eres un experto colombiano en evaluación educativa y en el diseño de ítems de la prueba Saber 11 del ICFES (${test.label}).`
      : `Eres un docente experto en evaluación educativa en Colombia y en la construcción de preguntas de selección múltiple de alta calidad.`
  );
  lines.push("");
  lines.push(`TAREA: crea exactamente ${count} preguntas nuevas y originales para un banco de ExamHub.`);
  lines.push("");
  lines.push("ESPECIFICACIONES:");
  if (o.topic.trim()) lines.push(`- Tema(s): ${o.topic.trim().replace(/\n+/g, "; ")}.`);
  if (o.subject.trim() || test) lines.push(`- Área: ${o.subject.trim() || test!.label}.`);
  if (o.grade.trim()) lines.push(`- Grado: ${o.grade.trim()} (contexto colombiano).`);
  if (test) {
    lines.push(`- Prueba Saber 11: "test": "${test.id}".`);
    lines.push(
      `- Reparte las preguntas de forma equilibrada entre estas competencias (usa su id en "competency"):`
    );
    for (const c of comps) lines.push(`    ${c.id}: ${c.label}`);
    if (test.components?.length) {
      lines.push(
        `- Usa también "component" con uno de: ${test.components.map((c) => c.id).join(", ")}.`
      );
    }
  }
  lines.push(`- Dificultad: ${DIFFICULTY_TEXT[o.difficulty] ?? DIFFICULTY_TEXT[0]}. Indica "difficulty" en cada una.`);
  if (inPassages > 0) {
    lines.push(
      `- ${inPassages} de las ${count} preguntas deben ir agrupadas en ${o.passages} lectura(s) o situación(es) ` +
        `de unos 150 a 300 palabras, con ${o.questionsPerPassage} preguntas cada una ("passages"). ` +
        `Las demás son preguntas sueltas.`
    );
  }
  lines.push("");
  lines.push("CALIDAD DE CADA PREGUNTA:");
  lines.push(
    "- Contexto: plantea una situación real o cotidiana (tabla, caso, experimento, noticia, problema) antes de preguntar; evita preguntas de pura memoria."
  );
  lines.push(`- 4 opciones (A, B, C, D) con una sola respuesta correcta${test?.id === "ingles" ? " (en inglés puedes usar 3 opciones cuando la parte lo requiera)" : ""}.`);
  lines.push("- Distractores plausibles que correspondan a errores frecuentes de los estudiantes.");
  lines.push('- Nunca uses "todas las anteriores" ni "ninguna de las anteriores".');
  lines.push("- Opciones de longitud y estructura parecidas, sin pistas gramaticales hacia la clave.");
  lines.push("- Distribuye la posición de la respuesta correcta entre A, B, C y D.");
  lines.push('- En "rationale" explica por qué la clave es correcta y qué error refleja cada distractor.');
  lines.push("- Lenguaje claro, español de Colombia, sin ambigüedades; datos y cifras verosímiles.");
  if (o.notes.trim()) lines.push(`- Indicaciones del docente: ${o.notes.trim()}`);
  lines.push("");
  lines.push("ORGANIZACIÓN:");
  lines.push(`- Crea una carpeta principal llamada "${folderName}".`);
  lines.push(`- ${FOLDER_BY_TEXT[o.folderBy]}`);
  lines.push("");
  lines.push(FORMAT_SPEC);
  if (o.source.trim()) {
    lines.push("");
    lines.push("BASA LAS PREGUNTAS EN ESTE MATERIAL:");
    lines.push("==========================================");
    lines.push(o.source.trim());
    lines.push("==========================================");
  }
  return lines.join("\n");
}

// =====================================================================
//  Utilidades
// =====================================================================

function arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function str(v: any): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** Quita "A) " / "b. " que algunas IA ponen al inicio de la opción. */
function stripLetter(text: string): string {
  return text.replace(/^\(?[a-hA-H]\s*[).]\s+/, "").trim();
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function preview(s: string): string {
  const one = s.replace(/\s+/g, " ");
  return one.length > 60 ? one.slice(0, 57) + "…" : one;
}

function firstLine(s: string): string {
  return s.split(/[\n,;]/)[0]?.trim() ?? "";
}
