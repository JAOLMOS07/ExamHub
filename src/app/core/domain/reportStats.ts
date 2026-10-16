/**
 * Estadísticas para boletines e informe institucional (lógica pura).
 */

import { ResponseDoc, ScoreBreakdown } from "../models/assessment.model";
import { ItemAnalysis } from "./psychometrics";
import { SABER11_TESTS, getCompetency, getTest } from "./taxonomy/saber11";

export interface GroupStats {
  n: number;
  /** Nota promedio en la escala del colegio. */
  score: number;
  global: number | null;
  /** Promedio 0–100 por prueba. */
  byTest: Record<string, number>;
  /** % de aciertos por competencia (`test:comp`). */
  byCompetency: Record<string, number>;
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function groupStats(responses: Pick<ResponseDoc, "score" | "breakdown">[]): GroupStats {
  const tests = new Map<string, number[]>();
  const comps = new Map<string, { c: number; t: number }>();
  const globals: number[] = [];
  for (const r of responses) {
    const b = r.breakdown;
    if (!b) continue;
    if (typeof b.global === "number") globals.push(b.global);
    for (const [t, s] of Object.entries(b.byTest ?? {})) {
      if (!tests.has(t)) tests.set(t, []);
      tests.get(t)!.push(s.score);
    }
    for (const [k, c] of Object.entries(b.byCompetency ?? {})) {
      const a = comps.get(k) ?? { c: 0, t: 0 };
      a.c += c.correct;
      a.t += c.total;
      comps.set(k, a);
    }
  }
  return {
    n: responses.length,
    score: round(mean(responses.map((r) => r.score ?? 0)), 1),
    global: globals.length ? round(mean(globals)) : null,
    byTest: Object.fromEntries([...tests].map(([t, xs]) => [t, round(mean(xs))])),
    byCompetency: Object.fromEntries(
      [...comps].map(([k, a]) => [k, a.t ? round((a.c / a.t) * 100) : 0])
    ),
  };
}

/** Puesto (1 = mejor) por nota; empates comparten puesto. */
export function rankOf(score: number, all: number[]): number {
  return all.filter((s) => s > score).length + 1;
}

export interface CompetencyResult {
  key: string;
  test: string;
  competency: string;
  label: string;
  pct: number;
  correct: number;
  total: number;
}

export function competencyResults(b: ScoreBreakdown | undefined): CompetencyResult[] {
  return Object.entries(b?.byCompetency ?? {}).map(([key, c]) => {
    const [test, competency] = key.split(":");
    return {
      key,
      test,
      competency,
      label: getCompetency(test, competency)?.label ?? competency,
      pct: c.total ? round((c.correct / c.total) * 100) : 0,
      correct: c.correct,
      total: c.total,
    };
  });
}

/**
 * Fortalezas (≥ 60 %) y aspectos por mejorar (< 60 %) del estudiante,
 * solo en competencias con al menos 2 preguntas.
 */
export function strengthsAndWeaknesses(
  b: ScoreBreakdown | undefined,
  max = 3
): { strengths: CompetencyResult[]; weaknesses: CompetencyResult[] } {
  const list = competencyResults(b).filter((c) => c.total >= 2);
  return {
    strengths: list.filter((c) => c.pct >= 60).sort((x, y) => y.pct - x.pct).slice(0, max),
    weaknesses: list.filter((c) => c.pct < 60).sort((x, y) => x.pct - y.pct).slice(0, max),
  };
}

/**
 * Estudiantes en riesgo: nivel 1 en al menos `minTests` pruebas, o
 * (sin pruebas ICFES) nota por debajo del 60 % de la escala.
 */
export function atRisk<T extends Pick<ResponseDoc, "score" | "breakdown">>(
  responses: T[],
  maxScore: number,
  minTests = 2
): T[] {
  return responses.filter((r) => {
    const levels = Object.values(r.breakdown?.byTest ?? {}).map((t) => t.level);
    if (levels.length === 0) return (r.score ?? 0) < maxScore * 0.6;
    const ones = levels.filter((l) => l === 0).length;
    return ones >= Math.min(minTests, levels.length);
  });
}

/** Sugerencia pedagógica por competencia (para el plan de mejora). */
const ACTIONS: Record<string, string> = {
  "lectura_critica:identificar_entender":
    "Trabajar comprensión literal: ideas principales, vocabulario en contexto y relaciones explícitas entre datos del texto.",
  "lectura_critica:comprender_articulacion":
    "Analizar la estructura de los textos: conectores, función de cada párrafo y relación entre tesis y argumentos.",
  "lectura_critica:reflexionar_evaluar":
    "Practicar lectura crítica: identificar la intención del autor, supuestos, falacias y contrastar puntos de vista.",
  "matematicas:interpretacion_representacion":
    "Leer y transformar tablas, gráficas y diagramas; pasar información entre representaciones verbales y numéricas.",
  "matematicas:formulacion_ejecucion":
    "Resolver problemas en contexto planteando el procedimiento antes de calcular; revisar operaciones con fracciones y porcentajes.",
  "matematicas:argumentacion":
    "Pedir justificaciones: validar o refutar afirmaciones y procedimientos, y explicar por qué una respuesta es correcta.",
  "sociales_ciudadanas:pensamiento_social":
    "Reforzar conceptos de la Constitución, organización del Estado e hitos históricos y geográficos de Colombia.",
  "sociales_ciudadanas:interpretacion_perspectivas":
    "Analizar situaciones desde la mirada de distintos actores e identificar intereses y argumentos de cada uno.",
  "sociales_ciudadanas:pensamiento_reflexivo":
    "Evaluar fuentes, usos de la información y consecuencias de decisiones en problemas sociales reales.",
  "ciencias_naturales:uso_comprensivo":
    "Repasar conceptos clave (célula, energía, materia, fuerzas) asociándolos a fenómenos cotidianos.",
  "ciencias_naturales:explicacion_fenomenos":
    "Pedir explicaciones causales de fenómenos y contrastar modelos que los expliquen.",
  "ciencias_naturales:indagacion":
    "Diseñar y analizar experimentos: variables, control, interpretación de resultados y conclusiones válidas.",
};

export function actionFor(test: string, competency: string): string {
  return (
    ACTIONS[`${test}:${competency}`] ??
    (test === "ingles"
      ? "Practicar lectura en inglés con vocabulario frecuente, gramática en contexto y textos cortos."
      : "Retomar los temas de esta competencia con ejercicios graduados y retroalimentación.")
  );
}

export interface Recommendation {
  title: string;
  detail: string;
}

/** Plan de mejora a partir de los resultados (reglas, sin IA). */
export function recommendations(
  stats: GroupStats,
  items: ItemAnalysis[],
  max = 6
): Recommendation[] {
  const out: Recommendation[] = [];
  const weakest = Object.entries(stats.byCompetency)
    .filter(([, pct]) => pct < 60)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4);
  for (const [key, pct] of weakest) {
    const [test, comp] = key.split(":");
    out.push({
      title: `${getTest(test)?.shortLabel ?? test} · ${getCompetency(test, comp)?.label ?? comp} (${pct} %)`,
      detail: actionFor(test, comp),
    });
  }
  for (const t of SABER11_TESTS) {
    const avg = stats.byTest[t.id];
    if (avg !== undefined && avg <= t.levelCuts[0]) {
      out.push({
        title: `${t.label}: promedio en nivel 1 (${avg}/100)`,
        detail: "Programar refuerzo semanal en esta prueba y un nuevo simulacro corto en 4 a 6 semanas para medir avance.",
      });
    }
  }
  const suspicious = items.filter((i) => i.discrimination !== null && i.discrimination < 0 && i.n >= 10);
  if (suspicious.length) {
    out.push({
      title: `Revisar ${suspicious.length} pregunta(s) con discriminación negativa`,
      detail:
        "Los mejores estudiantes fallaron más que los demás: puede haber una clave errada o un enunciado ambiguo. Revisa antes de usarlas de nuevo.",
    });
  }
  return out.slice(0, max);
}
