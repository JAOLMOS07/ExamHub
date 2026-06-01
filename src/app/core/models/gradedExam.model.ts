/**
 * ========================================================================
 *  Modelos de datos del feature de calificación automática
 * ------------------------------------------------------------------------
 *  Estos tipos describen lo que se persiste en Firestore para soportar
 *  el flujo:
 *
 *      1. El profe genera N versiones de un examen → se crea un
 *         GradedExam con un AnswerKey por versión.
 *      2. Cada hoja de respuestas impresa lleva un QR con el examId
 *         + versionId (ver `qrPayload.util.ts`).
 *      3. Al escanear, la app decodifica el QR, recupera el GradedExam
 *         desde Firestore y compara las respuestas leídas contra el
 *         answerKey correspondiente.
 *      4. El resultado se persiste como ExamResult dentro del examen.
 *
 *  Importante: NO duplicamos el texto de las preguntas en Firestore.
 *  Solo guardamos lo mínimo para poder calificar (answerKey + metadata).
 *  El banco de preguntas sigue siendo la fuente de verdad del enunciado.
 * ========================================================================
 */

import { ALPHABET } from "../utils/alphabet.const";

/** Letras permitidas para una opción marcada (A, B, C, D, E, ...). */
export type AnswerLetter = string;

/** Respuesta detectada para una pregunta del examen del estudiante.
 *
 *  - Una letra → marca única detectada.
 *  - `null`    → la pregunta quedó sin responder.
 *  - `"MULTI"` → más de una burbuja marcada (caso "anulada" / error). */
export type DetectedAnswer = AnswerLetter | null | "MULTI";

/**
 * Plan en el que se generó el examen al momento de imprimirlo.
 * Sirve para auditoría y para aplicar políticas de retención.
 */
export type PlanAtCreation = "free" | "pro" | "school";

/**
 * Clave de respuestas correctas para UNA versión del examen.
 *
 * `answers[i]` es la letra correcta de la pregunta i+1 (índice 0-based).
 * El largo del array es exactamente igual al número de preguntas del examen.
 */
export interface AnswerKey {
  /** Identificador interno de la versión (ej: "v1", "v2"...). */
  versionId: string;
  /** Etiqueta visible al docente (ej: "Forma A", "Versión 1"). */
  label: string;
  /** Letra correcta por pregunta. `null` solo se usa para preguntas no
   *  calificables (ej: abiertas). El motor de OMR las ignora. */
  answers: (AnswerLetter | null)[];
}

/**
 * Documento principal persistido en Firestore tras generar un examen.
 *
 * Path: `/exams/{examId}`
 */
export interface GradedExam {
  /** UUID del examen (mismo id usado en el QR). */
  id: string;
  /** UID del profesor dueño. Las reglas de seguridad usan este campo. */
  ownerId: string;
  /** Título humano para la lista en /grade. */
  title: string;
  /** Materia o curso opcional, copiado del banco al momento de generar. */
  subject?: string;
  /** Grado o curso opcional. */
  grade?: string;
  /** Cantidad total de preguntas calificables (todas las versiones tienen
   *  el mismo total: solo cambia el orden y/o el orden de opciones). */
  totalQuestions: number;
  /** Letras válidas para este examen (ej: ["A","B","C","D"]). Sirve para
   *  el renderer del grid táctil y para validar lo detectado por OMR. */
  letters: AnswerLetter[];
  /** Una entrada por versión generada. Mínimo 1, máximo `maxVersions`
   *  según el plan del usuario. */
  versions: AnswerKey[];
  /** Plan vigente al generar — sirve para conservar histórico aunque el
   *  usuario downgradee después. */
  planAtCreation: PlanAtCreation;
  /** Timestamps en milisegundos (Date.now()). Mantengo number en vez de
   *  Timestamp de Firestore para que sea trivial cachear offline. */
  createdAt: number;
  /** TTL — Firestore puede borrar automáticamente tras esta fecha si se
   *  configura la política. Default: 90 días para Free, 1 año para Pro. */
  expiresAt: number;
}

/**
 * Resultado individual de un estudiante.
 *
 * Path: `/exams/{examId}/results/{resultId}`
 *
 * Nota: NO guardamos la imagen del scan por defecto (privacidad / Habeas
 * Data Colombia). Si el profe activa "guardar imagen", se sube a Storage
 * en un path separado y se referencia con `imageUrl`.
 */
export interface ExamResult {
  /** UUID del resultado (no es el del estudiante). */
  id: string;
  /** UUID del examen padre. Duplicado aquí para queries planas. */
  examId: string;
  /** Versión que respondió este estudiante (de qué answerKey calificar). */
  versionId: string;
  /** Nombre del estudiante (escrito por el profe o leído del bubble code). */
  studentName?: string;
  /** Código del estudiante si lo marcó con burbujas en la hoja. */
  studentCode?: string;
  /** Respuestas detectadas — mismo largo que answerKey.answers. */
  answers: DetectedAnswer[];
  /** Cantidad de respuestas correctas. */
  correct: number;
  /** Cantidad de preguntas calificables (puede ser < totalQuestions si
   *  hubo preguntas no calificables en este examen). */
  total: number;
  /** Nota en la escala del docente (ej: 4.5 sobre 5). Se calcula en
   *  cliente al guardar — el motor solo cuenta aciertos. */
  score?: number;
  /** Cómo se hizo el scan: asistido (humano), OMR automático, o ambos
   *  (OMR con override puntual). Útil para métricas y para detectar
   *  exámenes con baja confianza. */
  source: "assisted" | "omr" | "mixed";
  /**
   * Puntaje manual asignado por el docente a preguntas NO calificables
   * automáticamente (abiertas / numéricas). Map de `índice de pregunta`
   * → valor 0..1 (1 = correcta completa, 0.5 = media, 0 = incorrecta).
   * Solo contiene entradas para preguntas que el docente revisó.
   * Las MCQ/TF NO van acá — esas se sacan de `answers` automáticamente.
   */
  manualScores?: Record<number, number>;
  /** Hash perceptual de la imagen del scan. Sirve para detectar scans
   *  duplicados (mismo alumno escaneado dos veces). */
  imageHash?: string;
  /** URL en Storage si el profe decidió guardar la imagen original. */
  imageUrl?: string;
  /** Timestamp del scan. */
  scannedAt: number;
}

/**
 * Vista derivada usada por el componente de resultados.
 * No se persiste — se calcula a partir de ExamResult + AnswerKey.
 */
export interface QuestionGradeBreakdown {
  /** Índice 0-based de la pregunta. */
  index: number;
  /** Letra correcta esperada. */
  expected: AnswerLetter | null;
  /** Letra detectada / marcada. */
  detected: DetectedAnswer;
  /** Si la pregunta cuenta como acierto. */
  isCorrect: boolean;
  /** Si la pregunta no es calificable (expected null). */
  isUngradable: boolean;
}

/**
 * Helper: calcula el array de breakdown a partir de detected vs answerKey.
 */
export function computeBreakdown(
  detected: DetectedAnswer[],
  key: AnswerKey
): QuestionGradeBreakdown[] {
  return key.answers.map((expected, index) => {
    const got = detected[index] ?? null;
    const ungradable = expected === null;
    const isCorrect =
      !ungradable && got !== null && got !== "MULTI" && got === expected;
    return {
      index,
      expected,
      detected: got,
      isCorrect,
      isUngradable: ungradable,
    };
  });
}

/**
 * Re-exporto el alfabeto canónico para que los consumidores del modelo
 * tengan una sola fuente de verdad para letras de opciones.
 */
export { ALPHABET };
