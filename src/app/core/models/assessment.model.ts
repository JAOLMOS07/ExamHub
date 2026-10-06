/**
 * ========================================================================
 *  Modelos v2 — evaluaciones institucionales
 * ------------------------------------------------------------------------
 *  Paths (todo vive bajo la organización):
 *
 *    /orgs/{orgId}/assessments/{assessmentId}                 Assessment
 *    /orgs/{orgId}/assessments/{assessmentId}/items/{itemId}  snapshot
 *    /orgs/{orgId}/assessments/{assessmentId}/responses/{id}  ResponseDoc
 *
 *  Diferencias clave con v1 (`/exams`):
 *    - La clave de cada forma sabe QUÉ ítem es cada posición (itemId),
 *      su prueba y competencia → reportes por competencia y análisis
 *      de ítems.
 *    - Cada forma guarda su semilla: el orden se puede regenerar.
 *    - Los ítems impresos se congelan en un snapshot: editar el banco
 *      después no altera exámenes ya aplicados.
 * ========================================================================
 */

import { QuestionKind } from "./questionKind.enum";
import { DetectedAnswer } from "./gradedExam.model";

/** Posición `i` de una forma impresa. */
export interface KeyEntry {
  /** Ítem del banco (null en exámenes migrados de v1). */
  itemId: string | null;
  kind: QuestionKind;
  /** Letra correcta impresa; null = no calificable por OMR. */
  letter: string | null;
  /**
   * Permutación de opciones: `perm[k]` es el índice ORIGINAL (base 36)
   * de la opción impresa en la posición k. Permite el análisis de
   * distractores aunque cada forma baraje distinto.
   */
  perm?: string;
  test?: string;
  competency?: string;
}

export interface FormDef {
  /** "v1", "v2"… (mismo id que viaja en el QR). */
  id: string;
  /** Etiqueta impresa: "A", "B"… */
  label: string;
  seed: number;
  key: KeyEntry[];
}

/** Configuración de la hoja de respuestas con la que se imprimió. */
export interface SheetSpec {
  /** 1 = hoja legacy de 36 preguntas, 2 = hoja multipágina. */
  version: 1 | 2;
  letterCount: number;
  /** Dígitos del código del estudiante en burbujas (0 = sin código). */
  codeDigits: number;
  totalPages: number;
}

export type AssessmentType = "quiz" | "simulacro";

export interface Assessment {
  id: string;
  orgId: string;
  title: string;
  subject?: string;
  grade?: string;
  type: AssessmentType;
  /** Taxonomía usada para alinear (ej. "saber11"). */
  taxonomyId?: string;
  /** Grupos a los que se aplica (para reportes por grupo). */
  groupIds: string[];
  totalQuestions: number;
  letters: string[];
  sheet: SheetSpec;
  forms: FormDef[];
  /** Escala de la nota del colegio (ej. 5.0). */
  maxScore: number;
  createdBy: string;
  createdAt: number;
  /** true si vino de la migración de `/exams` (v1). */
  legacy?: boolean;
}

export interface TestScore {
  correct: number;
  total: number;
  /** 0–100 */
  score: number;
  /** Índice del nivel de desempeño (0-based) o null. */
  level: number | null;
}

export interface ScoreBreakdown {
  /** Puntos obtenidos (aciertos + puntaje manual). */
  correct: number;
  total: number;
  /** Por prueba (lectura_critica, matematicas…). */
  byTest: Record<string, TestScore>;
  /** Por competencia, clave `${test}:${competency}`. */
  byCompetency: Record<string, { correct: number; total: number }>;
  /** Puntaje global estimado 0–500 (null si ningún ítem tiene prueba). */
  global: number | null;
  /** true si el global incluye las 5 pruebas. */
  globalComplete: boolean;
}

export type ResponseSource = "assisted" | "omr" | "mixed";

export interface ResponseDoc {
  id: string;
  assessmentId: string;
  formId: string;
  studentId?: string;
  studentName?: string;
  studentCode?: string;
  groupId?: string;
  answers: DetectedAnswer[];
  /** índice de pregunta → 0..1 (abiertas / numéricas). */
  manualScores?: Record<number, number>;
  source: ResponseSource;
  breakdown: ScoreBreakdown;
  /** Nota en la escala del colegio. */
  score: number;
  /** Páginas de la hoja que se escanearon (multipágina). */
  pagesScanned?: number[];
  scannedBy: string;
  scannedAt: number;
}
