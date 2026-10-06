import { Document, getQuestionKind } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { QuestionKind } from "../models/questionKind.enum";
import { KeyEntry } from "../models/assessment.model";
import { ALPHABET } from "../utils/alphabet.const";
import { createRng, Rng, shuffle } from "./rng";
import { testOrder } from "./taxonomy/saber11";

export interface FormBuildOptions {
  seed: number;
  /** Máximo de preguntas (las lecturas no cuentan). Default: todas. */
  maxQuestions?: number;
  /**
   * Modo simulacro: agrupa por prueba ICFES en el orden oficial y
   * baraja solo dentro de cada prueba.
   */
  groupByTest?: boolean;
  /** Default true. */
  shuffleItems?: boolean;
  /** Default true. Verdadero/Falso nunca se baraja. */
  shuffleOptions?: boolean;
}

export interface BuiltForm {
  seed: number;
  /** Lo que se imprime en el cuadernillo: lecturas + preguntas. */
  sequence: Document[];
  /** Solo preguntas, en el orden de la hoja de respuestas. */
  questions: Document[];
  key: KeyEntry[];
  /** Máximo de opciones de las preguntas con burbujas (mínimo 2). */
  maxOptions: number;
}

const LOOSE = "__loose__";

export function hasBubbles(doc: Document): boolean {
  const kind = getQuestionKind(doc);
  return (
    kind === QuestionKind.MULTIPLE_CHOICE_SINGLE ||
    kind === QuestionKind.TRUE_FALSE
  );
}

/**
 * Arma una forma de examen a partir de la selección del docente.
 *
 * Reglas (heredadas de v1):
 *   1. Las preguntas con el mismo `passageId` forman un bloque
 *      indivisible, siempre debajo de su lectura.
 *   2. Las preguntas sueltas son bloques de tamaño 1.
 *   3. Se barajan los bloques entre sí y las preguntas dentro de cada
 *      bloque; también las opciones de cada pregunta.
 *   4. Si la lectura no está seleccionada pero las preguntas traen
 *      `passageContext`, se sintetiza el bloque de lectura.
 *   5. `maxQuestions` no parte lecturas por la mitad.
 *
 * Determinista: misma selección + misma semilla = misma forma.
 */
export function buildForm(
  selection: Document[],
  options: FormBuildOptions
): BuiltForm {
  const rng = createRng(options.seed);
  const shuffleItems = options.shuffleItems !== false;
  const shuffleOptions = options.shuffleOptions !== false;
  const maybeShuffle = <T>(arr: T[]): T[] =>
    shuffleItems ? shuffle(arr, rng) : arr.slice();

  const explicitPassages = new Map<string, Document>();
  const groups = new Map<string, Document[]>();
  for (const item of selection) {
    if (item.type === objectType.PASSAGE) {
      explicitPassages.set(item.id, item);
      continue;
    }
    if (item.type !== objectType.QUESTION) continue;
    const key = item.passageId ?? LOOSE;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const permOf = new Map<Document, string>();
  const prepare = (q: Document): Document => {
    const { doc, perm } = shuffleOptions
      ? permuteOptions(q, rng)
      : { doc: { ...q } as Document, perm: identityPerm(q) };
    if (perm) permOf.set(doc, perm);
    return doc;
  };

  const chunks: Document[][] = [];
  for (const q of groups.get(LOOSE) ?? []) {
    chunks.push([prepare(q)]);
  }
  for (const [passageId, questions] of groups.entries()) {
    if (passageId === LOOSE) continue;
    const shuffledQs = maybeShuffle(questions).map(prepare);
    let passage = explicitPassages.get(passageId);
    if (!passage) {
      const ctx = shuffledQs.find((q) => q.passageContext)?.passageContext;
      if (ctx) {
        passage = {
          id: passageId,
          name: "Lectura",
          type: objectType.PASSAGE,
          passageText: ctx,
        } as Document;
      }
    }
    chunks.push(passage ? [{ ...passage } as Document, ...shuffledQs] : shuffledQs);
  }
  for (const [pid, passage] of explicitPassages.entries()) {
    if (!groups.has(pid)) chunks.push([{ ...passage } as Document]);
  }

  let ordered: Document[][];
  if (options.groupByTest) {
    const byTest = new Map<number, Document[][]>();
    for (const chunk of chunks) {
      const order = testOrder(chunkTest(chunk));
      if (!byTest.has(order)) byTest.set(order, []);
      byTest.get(order)!.push(chunk);
    }
    ordered = [...byTest.keys()]
      .sort((a, b) => a - b)
      .flatMap((k) => maybeShuffle(byTest.get(k)!));
  } else {
    ordered = maybeShuffle(chunks);
  }

  const limit = options.maxQuestions ?? Number.POSITIVE_INFINITY;
  const sequence: Document[] = [];
  let count = 0;
  for (const chunk of ordered) {
    if (count >= limit) break;
    const qInChunk = chunk.filter((d) => d.type === objectType.QUESTION).length;
    if (
      count + qInChunk > limit &&
      chunk.some((d) => d.type === objectType.PASSAGE)
    ) {
      continue;
    }
    sequence.push(...chunk);
    count += qInChunk;
  }

  const questions = sequence.filter((d) => d.type === objectType.QUESTION);
  const key = questions.map((q) => keyEntryFor(q, permOf.get(q)));
  const maxOptions = Math.max(
    2,
    ...questions.filter(hasBubbles).map((q) => q.options?.length ?? 0)
  );
  return { seed: options.seed, sequence, questions, key, maxOptions };
}

function chunkTest(chunk: Document[]): string | undefined {
  return chunk.find((d) => d.type === objectType.QUESTION && d.test)?.test;
}

function identityPerm(q: Document): string | undefined {
  if (!q.options?.length) return undefined;
  return q.options.map((_, i) => i.toString(36)).join("");
}

function permuteOptions(
  q: Document,
  rng: Rng
): { doc: Document; perm?: string } {
  if (!q.options?.length) return { doc: { ...q } as Document };
  const indices = q.options.map((_, i) => i);
  const order =
    getQuestionKind(q) === QuestionKind.TRUE_FALSE
      ? indices
      : shuffle(indices, rng);
  return {
    doc: { ...q, options: order.map((i) => q.options![i]) } as Document,
    perm: order.map((i) => i.toString(36)).join(""),
  };
}

/** Clave de una pregunta YA permutada en el orden en que se imprime. */
export function keyEntryFor(q: Document, perm?: string): KeyEntry {
  const kind = getQuestionKind(q);
  let letter: string | null = null;
  if (hasBubbles(q)) {
    const idx = (q.options ?? []).findIndex((o) => o.correct === true);
    letter = idx >= 0 ? ALPHABET[idx] : null;
  }
  const entry: KeyEntry = { itemId: q.id ?? null, kind, letter };
  if (perm) entry.perm = perm;
  if (q.test) entry.test = q.test;
  if (q.competency) entry.competency = q.competency;
  return entry;
}

/**
 * Etiqueta de forma estilo planilla: 1→A … 26→Z, 27→AA, 28→AB…
 */
export function formLabel(n: number): string {
  if (n < 1) throw new Error("El número de forma debe ser >= 1.");
  let code = "";
  while (n > 0) {
    n--;
    code = String.fromCharCode(65 + (n % 26)) + code;
    n = Math.floor(n / 26);
  }
  return code;
}
