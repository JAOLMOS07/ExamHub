/**
 * Banco ExamHub: catálogo compartido de preguntas tipo Saber 11 para
 * todas las instituciones (lógica pura, sin Firebase).
 *
 * La unidad del catálogo es lo que se elige de una vez: una pregunta
 * suelta o una lectura con todas sus preguntas. Así una lectura nunca
 * se parte y cada documento de Firestore trae todo lo necesario.
 */

import { QuestionKind } from "../models/questionKind.enum";
import { ImportFolder, ImportQuestion, emptyFolder } from "./bankImport";
import { Rng, shuffle } from "./rng";
import { SABER11_TESTS, getCompetency, getTest } from "./taxonomy/saber11";

export type CatalogStatus = "published" | "pending" | "rejected";

export interface CatalogUnit {
  id: string;
  kind: "question" | "passage";
  /** Prueba Saber 11 (id de la taxonomía). */
  test: string;
  /** Competencias de sus preguntas (para filtrar). */
  competencies: string[];
  /** Dificultad 1–3 (promedio redondeado en lecturas). */
  difficulty?: number;
  grade?: string;
  /** Tema o unidad (ej. "Funciones lineales"). */
  topic?: string;
  /** Solo lecturas. */
  title?: string;
  text?: string;
  questions: ImportQuestion[];
  questionCount: number;
  status: CatalogStatus;
  rejectReason?: string;
  source: "examhub" | "docente";
  contributedBy?: { uid: string; name: string; orgName?: string };
  reviewedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogFilters {
  test?: string;
  competency?: string;
  difficulty?: number;
  text?: string;
  kind?: "question" | "passage";
}

// ---------------------------------------------------------------------
//  De un banco importado (JSON / Word) a unidades del catálogo
// ---------------------------------------------------------------------

/**
 * Aplana carpetas → unidades. El nombre de la carpeta (y sus padres)
 * queda como tema. Las preguntas sin prueba Saber 11 se descartan y se
 * informan: el catálogo es solo de preguntas alineadas.
 */
export function unitsFromImport(
  root: ImportFolder,
  base: Pick<CatalogUnit, "status" | "source" | "contributedBy">,
  newId: () => string,
  now = Date.now()
): { units: CatalogUnit[]; skipped: string[] } {
  const units: CatalogUnit[] = [];
  const skipped: string[] = [];

  const walk = (f: ImportFolder, topics: string[]) => {
    const topic = topics.filter(Boolean).join(" › ") || undefined;
    for (const q of f.questions) {
      const problem = contributionProblem(q);
      if (problem) {
        skipped.push(`${preview(q.text)}: ${problem}`);
        continue;
      }
      units.push(makeUnit("question", [q], { topic }, base, newId(), now));
    }
    for (const p of f.passages) {
      const valid = p.questions.filter((q) => {
        const problem = contributionProblem(q);
        if (problem) skipped.push(`${preview(q.text)} (lectura "${p.title}"): ${problem}`);
        return !problem;
      });
      if (valid.length === 0) continue;
      units.push(makeUnit("passage", valid, { topic, title: p.title, text: p.text }, base, newId(), now));
    }
    for (const sub of f.folders) walk(sub, [...topics, sub.name]);
  };
  // La raíz del import no es un tema (su nombre es genérico).
  walk(root, []);
  return { units, skipped };
}

function makeUnit(
  kind: CatalogUnit["kind"],
  questions: ImportQuestion[],
  extra: Partial<CatalogUnit>,
  base: Pick<CatalogUnit, "status" | "source" | "contributedBy">,
  id: string,
  now: number
): CatalogUnit {
  const tests = questions.map((q) => q.test!).filter(Boolean);
  const test = mostCommon(tests) ?? tests[0];
  const diffs = questions.map((q) => q.difficulty).filter((d): d is number => typeof d === "number");
  const grade = questions.find((q) => q.grade)?.grade;
  return stripUndefined({
    id,
    kind,
    test,
    competencies: [...new Set(questions.map((q) => q.competency).filter((c): c is string => !!c))],
    difficulty: diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : undefined,
    grade,
    questions: questions.map(cleanQuestion),
    questionCount: questions.length,
    createdAt: now,
    updatedAt: now,
    ...extra,
    ...base,
  }) as CatalogUnit;
}

/** Motivo por el que una pregunta no entra al catálogo (null = válida). */
export function contributionProblem(q: ImportQuestion): string | null {
  if (!getTest(q.test)) return "falta la prueba Saber 11";
  if (!q.competency || !getCompetency(q.test, q.competency)) return "falta la competencia";
  if (q.kind !== QuestionKind.MULTIPLE_CHOICE_SINGLE) return "solo se aceptan preguntas de selección múltiple";
  const opts = q.options ?? [];
  if (opts.length < 3) return "necesita al menos 3 opciones";
  if (opts.filter((o) => o.correct).length !== 1) return "debe tener exactamente una respuesta correcta";
  if (q.text.trim().length < 15) return "el enunciado es muy corto";
  return null;
}

// ---------------------------------------------------------------------
//  Filtros
// ---------------------------------------------------------------------

export function filterUnits(units: CatalogUnit[], f: CatalogFilters): CatalogUnit[] {
  const needle = f.text ? fold(f.text) : "";
  return units.filter((u) => {
    if (f.test && u.test !== f.test) return false;
    if (f.kind && u.kind !== f.kind) return false;
    if (f.competency && !u.competencies.includes(f.competency)) return false;
    if (f.difficulty && u.difficulty !== f.difficulty) return false;
    if (needle) {
      const hay = fold([u.title, u.text, u.topic, ...u.questions.map((q) => q.text)].filter(Boolean).join(" "));
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------
//  Simulacro automático
// ---------------------------------------------------------------------

/** Proporciones aproximadas del Saber 11 por prueba. */
export const SABER11_MIX: Record<string, number> = {
  lectura_critica: 0.2,
  matematicas: 0.2,
  sociales_ciudadanas: 0.2,
  ciencias_naturales: 0.22,
  ingles: 0.18,
};

/** Reparte `total` preguntas entre las pruebas según SABER11_MIX. */
export function mixCounts(total: number, tests: string[] = Object.keys(SABER11_MIX)): Record<string, number> {
  const weights = tests.map((t) => SABER11_MIX[t] ?? 0.2);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const counts = raw.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  // El resto, a las de mayor parte decimal.
  raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        counts[i]++;
        left--;
      }
    });
  return Object.fromEntries(tests.map((t, i) => [t, counts[i]]));
}

export interface AutoResult {
  units: CatalogUnit[];
  /** Preguntas logradas por prueba. */
  got: Record<string, number>;
  /** Pruebas donde no alcanzó el catálogo. */
  short: string[];
}

/**
 * Elige unidades para llegar a `counts` preguntas por prueba sin
 * pasarse: primero lecturas que quepan, luego preguntas sueltas,
 * rotando competencias para que queden equilibradas.
 */
export function autoSimulacro(
  units: CatalogUnit[],
  counts: Record<string, number>,
  rng: Rng,
  difficulty?: number
): AutoResult {
  const chosen: CatalogUnit[] = [];
  const got: Record<string, number> = {};
  const short: string[] = [];

  for (const [test, target] of Object.entries(counts)) {
    if (target <= 0) continue;
    let pool = units.filter((u) => u.test === test && u.status === "published");
    if (difficulty) {
      const exact = pool.filter((u) => u.difficulty === difficulty);
      // Si no alcanza con la dificultad pedida, se completa con el resto.
      pool = [...shuffle(exact, rng), ...shuffle(pool.filter((u) => u.difficulty !== difficulty), rng)];
    } else pool = shuffle(pool, rng);

    let n = 0;
    const picked = new Set<string>();
    // Lecturas completas hasta ocupar como mucho el 60 % del cupo.
    const passageCap = Math.floor(target * 0.6);
    const passages = pool.filter((u) => u.kind === "passage").sort((a, b) => b.questionCount - a.questionCount);
    for (const u of passages) {
      if (u.kind !== "passage" || picked.has(u.id)) continue;
      if (n + u.questionCount <= passageCap) {
        picked.add(u.id);
        chosen.push(u);
        n += u.questionCount;
      }
    }
    // Preguntas sueltas, rotando competencias.
    const byComp = new Map<string, CatalogUnit[]>();
    for (const u of pool) {
      if (u.kind !== "question" || picked.has(u.id)) continue;
      const c = u.competencies[0] ?? "";
      if (!byComp.has(c)) byComp.set(c, []);
      byComp.get(c)!.push(u);
    }
    const queues = [...byComp.values()];
    let added = true;
    while (n < target && added) {
      added = false;
      for (const q of queues) {
        if (n >= target) break;
        const u = q.shift();
        if (!u) continue;
        picked.add(u.id);
        chosen.push(u);
        n += 1;
        added = true;
      }
    }
    // Si faltan, lecturas que todavía quepan.
    for (const u of pool) {
      if (n >= target) break;
      if (u.kind === "passage" && !picked.has(u.id) && n + u.questionCount <= target) {
        picked.add(u.id);
        chosen.push(u);
        n += u.questionCount;
      }
    }
    got[test] = n;
    if (n < target) short.push(test);
  }
  return { units: chosen, got, short };
}

// ---------------------------------------------------------------------
//  Del catálogo al banco de la institución
// ---------------------------------------------------------------------

/**
 * Árbol para ExamService.importTree: una carpeta principal con una
 * subcarpeta por prueba (en el orden del Saber 11).
 */
export function unitsToFolder(units: CatalogUnit[], folderName: string): ImportFolder {
  const root = emptyFolder();
  const main = emptyFolder(folderName);
  root.folders.push(main);
  for (const t of SABER11_TESTS) {
    const mine = units.filter((u) => u.test === t.id);
    if (!mine.length) continue;
    const sub = emptyFolder(t.label);
    for (const u of mine) {
      if (u.kind === "passage") {
        sub.passages.push({ title: u.title || "Lectura", text: u.text || "", questions: u.questions.map((q) => ({ ...q })) });
      } else sub.questions.push({ ...u.questions[0] });
    }
    main.folders.push(sub);
  }
  return root;
}

// ---------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------

function cleanQuestion(q: ImportQuestion): ImportQuestion {
  return stripUndefined({ ...q, options: q.options?.map((o) => ({ text: o.text, correct: o.correct })) }) as ImportQuestion;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function mostCommon(xs: string[]): string | undefined {
  const c = new Map<string, number>();
  xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function preview(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > 50 ? one.slice(0, 47) + "…" : one;
}

// ---------------------------------------------------------------------
//  Del banco de la institución a un aporte al catálogo
// ---------------------------------------------------------------------

/** Lo mínimo de un Document del banco que se necesita para aportarlo. */
export interface BankQuestionLike {
  type: number;
  name: string;
  kind?: QuestionKind;
  options?: { content: string; correct: boolean }[];
  passageId?: string;
  passageContext?: string;
  test?: string;
  competency?: string;
  component?: string;
  difficulty?: number;
  grade?: string;
  subject?: string;
  rationale?: string;
}

/** Preguntas del banco → árbol de importación (lecturas agrupadas). */
export function documentsToFolder(docs: BankQuestionLike[], passageTitle = "Lectura"): ImportFolder {
  const root = emptyFolder();
  const byPassage = new Map<string, { text: string; questions: ImportQuestion[] }>();
  for (const d of docs) {
    if (d.type !== 1) continue; // solo preguntas: las lecturas viajan con ellas
    const q = stripUndefined({
      kind: d.kind ?? QuestionKind.MULTIPLE_CHOICE_SINGLE,
      text: d.name,
      options: d.options?.map((o) => ({ text: o.content, correct: !!o.correct })),
      test: d.test,
      competency: d.competency,
      component: d.component,
      difficulty: d.difficulty,
      grade: d.grade,
      subject: d.subject,
      rationale: d.rationale,
    }) as ImportQuestion;
    if (d.passageId && d.passageContext) {
      if (!byPassage.has(d.passageId)) byPassage.set(d.passageId, { text: d.passageContext, questions: [] });
      byPassage.get(d.passageId)!.questions.push(q);
    } else root.questions.push(q);
  }
  for (const p of byPassage.values()) root.passages.push({ title: passageTitle, text: p.text, questions: p.questions });
  return root;
}
