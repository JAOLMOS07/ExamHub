import { KeyEntry } from "../models/assessment.model";
import { DetectedAnswer } from "../models/gradedExam.model";
import { letterToIndex } from "../utils/alphabet.const";
import { pointsAt } from "./scoring";

/**
 * Análisis de ítems con Teoría Clásica de los Tests.
 *
 *   - pValue: proporción de aciertos (dificultad empírica; alto = fácil).
 *   - discrimination: correlación punto-biserial entre el ítem y el
 *     puntaje del resto de la prueba. < 0.2 suele indicar un ítem
 *     problemático (ambiguo, clave errada o muy fácil/difícil).
 *   - optionShare: proporción que eligió cada opción ORIGINAL del ítem
 *     (deshace la permutación de cada forma).
 */
export interface ItemAnalysis {
  itemId: string;
  /** Posición de referencia (primera forma donde aparece), 0-based. */
  position: number;
  test?: string;
  competency?: string;
  n: number;
  pValue: number;
  discrimination: number | null;
  /** Índice = opción original; valor = proporción 0..1. */
  optionShare: number[];
  /** Original index de la opción correcta (si aplica). */
  correctOption: number | null;
  omitted: number;
  multi: number;
}

export interface AnalyzableResponse {
  formId: string;
  answers: DetectedAnswer[];
  manualScores?: Record<number, number>;
}

/** Pistas para el docente según los indicadores. */
export type ItemFlag = "muy_facil" | "muy_dificil" | "baja_discriminacion" | "distractor_atractivo";

export function analyzeItems(
  forms: { id: string; key: KeyEntry[] }[],
  responses: AnalyzableResponse[]
): ItemAnalysis[] {
  const formById = new Map(forms.map((f) => [f.id, f]));
  type Acc = {
    position: number;
    entry: KeyEntry;
    scores: number[];
    rest: number[];
    optionCounts: number[];
    omitted: number;
    multi: number;
  };
  const acc = new Map<string, Acc>();

  for (const r of responses) {
    const form = formById.get(r.formId);
    if (!form) continue;
    const pts = form.key.map((_, i) => pointsAt(form.key, r.answers, r.manualScores, i));
    const total = pts.reduce((s, p) => s + p, 0);

    form.key.forEach((entry, i) => {
      if (!entry.itemId) return;
      let a = acc.get(entry.itemId);
      if (!a) {
        a = {
          position: i,
          entry,
          scores: [],
          rest: [],
          optionCounts: [],
          omitted: 0,
          multi: 0,
        };
        acc.set(entry.itemId, a);
      }
      a.scores.push(pts[i]);
      a.rest.push(total - pts[i]);

      const ans = r.answers[i];
      if (ans === null || ans === undefined) a.omitted++;
      else if (ans === "MULTI") a.multi++;
      else {
        const printed = letterToIndex(ans);
        if (printed !== null) {
          const original = entry.perm
            ? parseInt(entry.perm[printed] ?? "", 36)
            : printed;
          if (Number.isFinite(original)) {
            a.optionCounts[original] = (a.optionCounts[original] ?? 0) + 1;
          }
        }
      }
    });
  }

  return [...acc.entries()]
    .map(([itemId, a]) => {
      const n = a.scores.length;
      const correctPrinted = a.entry.letter ? letterToIndex(a.entry.letter) : null;
      const correctOption =
        correctPrinted === null
          ? null
          : a.entry.perm
          ? parseInt(a.entry.perm[correctPrinted] ?? "", 36)
          : correctPrinted;
      const optionShare = Array.from(
        { length: Math.max(a.optionCounts.length, a.entry.perm?.length ?? 0) },
        (_, k) => (n > 0 ? (a.optionCounts[k] ?? 0) / n : 0)
      );
      return {
        itemId,
        position: a.position,
        test: a.entry.test,
        competency: a.entry.competency,
        n,
        pValue: n > 0 ? a.scores.reduce((s, x) => s + x, 0) / n : 0,
        discrimination: pearson(a.scores, a.rest),
        optionShare,
        correctOption: Number.isFinite(correctOption as number) ? correctOption : null,
        omitted: a.omitted,
        multi: a.multi,
      };
    })
    .sort((x, y) => x.position - y.position);
}

export function itemFlags(item: ItemAnalysis, minN = 10): ItemFlag[] {
  if (item.n < minN) return [];
  const flags: ItemFlag[] = [];
  if (item.pValue > 0.9) flags.push("muy_facil");
  if (item.pValue < 0.2) flags.push("muy_dificil");
  if (item.discrimination !== null && item.discrimination < 0.2) {
    flags.push("baja_discriminacion");
  }
  if (item.correctOption !== null) {
    const correctShare = item.optionShare[item.correctOption] ?? 0;
    if (item.optionShare.some((s, k) => k !== item.correctOption && s > correctShare)) {
      flags.push("distractor_atractivo");
    }
  }
  return flags;
}

/** Correlación de Pearson; null si no hay varianza o n < 3. */
export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}
