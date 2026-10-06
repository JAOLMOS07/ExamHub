/**
 * Taxonomía de referencia de la prueba Saber 11 (ICFES).
 *
 * Se usa para alinear cada ítem del banco a una prueba y competencia,
 * y para reportar resultados con la misma estructura que el ICFES.
 *
 * Los puntos de corte de niveles de desempeño son una REFERENCIA para
 * reportes estimados: verificar contra la guía de interpretación de
 * resultados vigente del ICFES antes de publicarlos como oficiales.
 */

export type TestId =
  | "lectura_critica"
  | "matematicas"
  | "sociales_ciudadanas"
  | "ciencias_naturales"
  | "ingles";

export interface CompetencyDef {
  id: string;
  label: string;
}

export interface TestDef {
  id: TestId;
  label: string;
  shortLabel: string;
  /** Peso en el puntaje global (fórmula ICFES). */
  weight: number;
  competencies: CompetencyDef[];
  /** Componentes temáticos opcionales (ej. ciencias). */
  components?: CompetencyDef[];
  /**
   * Límite superior (inclusive, escala 0–100) de cada nivel de
   * desempeño, en orden. El último nivel llega a 100.
   */
  levelCuts: number[];
  levelLabels: string[];
}

export const SABER11_TAXONOMY_ID = "saber11";

export const SABER11_TESTS: TestDef[] = [
  {
    id: "lectura_critica",
    label: "Lectura Crítica",
    shortLabel: "LC",
    weight: 3,
    competencies: [
      { id: "identificar_entender", label: "Identificar y entender los contenidos locales de un texto" },
      { id: "comprender_articulacion", label: "Comprender cómo se articulan las partes de un texto" },
      { id: "reflexionar_evaluar", label: "Reflexionar a partir de un texto y evaluar su contenido" },
    ],
    levelCuts: [35, 50, 65, 100],
    levelLabels: ["1", "2", "3", "4"],
  },
  {
    id: "matematicas",
    label: "Matemáticas",
    shortLabel: "MAT",
    weight: 3,
    competencies: [
      { id: "interpretacion_representacion", label: "Interpretación y representación" },
      { id: "formulacion_ejecucion", label: "Formulación y ejecución" },
      { id: "argumentacion", label: "Argumentación" },
    ],
    levelCuts: [35, 50, 70, 100],
    levelLabels: ["1", "2", "3", "4"],
  },
  {
    id: "sociales_ciudadanas",
    label: "Sociales y Ciudadanas",
    shortLabel: "SC",
    weight: 3,
    competencies: [
      { id: "pensamiento_social", label: "Pensamiento social" },
      { id: "interpretacion_perspectivas", label: "Interpretación y análisis de perspectivas" },
      { id: "pensamiento_reflexivo", label: "Pensamiento reflexivo y sistémico" },
    ],
    levelCuts: [40, 55, 70, 100],
    levelLabels: ["1", "2", "3", "4"],
  },
  {
    id: "ciencias_naturales",
    label: "Ciencias Naturales",
    shortLabel: "CN",
    weight: 3,
    competencies: [
      { id: "uso_comprensivo", label: "Uso comprensivo del conocimiento científico" },
      { id: "explicacion_fenomenos", label: "Explicación de fenómenos" },
      { id: "indagacion", label: "Indagación" },
    ],
    components: [
      { id: "biologico", label: "Biológico" },
      { id: "quimico", label: "Químico" },
      { id: "fisico", label: "Físico" },
      { id: "cts", label: "Ciencia, tecnología y sociedad" },
    ],
    levelCuts: [40, 55, 70, 100],
    levelLabels: ["1", "2", "3", "4"],
  },
  {
    id: "ingles",
    label: "Inglés",
    shortLabel: "ING",
    weight: 1,
    competencies: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      id: `parte_${n}`,
      label: `Parte ${n}`,
    })),
    levelCuts: [36, 57, 70, 100],
    levelLabels: ["A-", "A1", "A2", "B1"],
  },
];

const TESTS_BY_ID = new Map(SABER11_TESTS.map((t) => [t.id, t]));

export function getTest(id: string | undefined | null): TestDef | undefined {
  return id ? TESTS_BY_ID.get(id as TestId) : undefined;
}

export function getCompetency(
  testId: string | undefined | null,
  competencyId: string | undefined | null
): CompetencyDef | undefined {
  return getTest(testId)?.competencies.find((c) => c.id === competencyId);
}

/** Orden oficial de las pruebas (para armar simulacros por secciones). */
export function testOrder(id: string | undefined | null): number {
  const idx = SABER11_TESTS.findIndex((t) => t.id === id);
  return idx === -1 ? SABER11_TESTS.length : idx;
}

/** Índice (0-based) del nivel de desempeño para un puntaje 0–100. */
export function performanceLevel(testId: string, score: number): number | null {
  const test = getTest(testId);
  if (!test) return null;
  const idx = test.levelCuts.findIndex((cut) => score <= cut);
  return idx === -1 ? test.levelCuts.length - 1 : idx;
}
