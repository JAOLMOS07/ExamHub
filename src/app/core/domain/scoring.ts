import { KeyEntry, ScoreBreakdown, TestScore } from "../models/assessment.model";
import { DetectedAnswer } from "../models/gradedExam.model";
import { getTest, performanceLevel, SABER11_TESTS } from "./taxonomy/saber11";

/** ¿La respuesta detectada en la posición es correcta? */
export function isCorrectAnswer(
  entry: KeyEntry,
  answer: DetectedAnswer | undefined
): boolean {
  return (
    entry.letter !== null &&
    answer !== null &&
    answer !== undefined &&
    answer !== "MULTI" &&
    answer === entry.letter
  );
}

/** Puntos (0..1) que aporta la posición `i`. */
export function pointsAt(
  key: KeyEntry[],
  answers: DetectedAnswer[],
  manualScores: Record<number, number> | undefined,
  i: number
): number {
  const entry = key[i];
  if (entry.letter === null) {
    const manual = manualScores?.[i] ?? 0;
    return Math.min(1, Math.max(0, manual));
  }
  return isCorrectAnswer(entry, answers[i]) ? 1 : 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Califica una respuesta completa: total, por prueba (escala 0–100 con
 * nivel de desempeño), por competencia y puntaje global estimado.
 *
 * El global sigue la fórmula ICFES (promedio ponderado × 5) sobre las
 * pruebas presentes. Es una ESTIMACIÓN lineal; el ICFES usa TRI.
 */
export function scoreResponse(
  key: KeyEntry[],
  answers: DetectedAnswer[],
  manualScores?: Record<number, number>
): ScoreBreakdown {
  let correct = 0;
  const testAcc = new Map<string, { correct: number; total: number }>();
  const byCompetency: ScoreBreakdown["byCompetency"] = {};

  key.forEach((entry, i) => {
    const pts = pointsAt(key, answers, manualScores, i);
    correct += pts;
    if (entry.test) {
      const t = testAcc.get(entry.test) ?? { correct: 0, total: 0 };
      t.correct += pts;
      t.total += 1;
      testAcc.set(entry.test, t);
      if (entry.competency) {
        const ck = `${entry.test}:${entry.competency}`;
        const c = byCompetency[ck] ?? { correct: 0, total: 0 };
        c.correct += pts;
        c.total += 1;
        byCompetency[ck] = c;
      }
    }
  });

  const byTest: Record<string, TestScore> = {};
  for (const [testId, acc] of testAcc.entries()) {
    const score = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
    byTest[testId] = {
      correct: round1(acc.correct),
      total: acc.total,
      score,
      level: performanceLevel(testId, score),
    };
  }

  const { global, complete } = globalScore(byTest);
  return {
    correct: round1(correct),
    total: key.length,
    byTest,
    byCompetency,
    global,
    globalComplete: complete,
  };
}

/** Puntaje global 0–500 (ponderado ICFES) sobre las pruebas presentes. */
export function globalScore(byTest: Record<string, { score: number }>): {
  global: number | null;
  complete: boolean;
} {
  let weighted = 0;
  let weights = 0;
  for (const [testId, t] of Object.entries(byTest)) {
    const def = getTest(testId);
    if (!def) continue;
    weighted += t.score * def.weight;
    weights += def.weight;
  }
  if (weights === 0) return { global: null, complete: false };
  const complete = SABER11_TESTS.every((t) => byTest[t.id] !== undefined);
  return { global: Math.round((weighted / weights) * 5), complete };
}

/** Nota en la escala del colegio (ej. 0–5), redondeada a 1 decimal. */
export function toScale(points: number, total: number, maxScore: number): number {
  if (total <= 0) return 0;
  return round1((points / total) * maxScore);
}
