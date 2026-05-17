/**
 * Tipos de pregunta soportados por ExamHub.
 *
 * MULTIPLE_CHOICE_SINGLE es el tipo "histórico" — el único que existía
 * en v1. Cualquier pregunta del banco viejo que no tenga `kind` se
 * trata como este tipo (retro-compatibilidad).
 *
 * Usamos strings (no números) como valor para que sean legibles en
 * Firestore y permitan agregar tipos nuevos sin afectar a los existentes.
 */
export enum QuestionKind {
  /** Opción múltiple con una sola respuesta correcta. */
  MULTIPLE_CHOICE_SINGLE = "multiple-choice-single",
  /** Verdadero / Falso. */
  TRUE_FALSE = "true-false",
  /** Respuesta abierta (texto libre, corrección manual). */
  OPEN = "open",
  /** Respuesta numérica con tolerancia. */
  NUMERIC = "numeric",
}

/**
 * Etiquetas en español para mostrar al usuario.
 */
export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  [QuestionKind.MULTIPLE_CHOICE_SINGLE]: "Opción múltiple",
  [QuestionKind.TRUE_FALSE]: "Verdadero / Falso",
  [QuestionKind.OPEN]: "Respuesta abierta",
  [QuestionKind.NUMERIC]: "Numérica",
};

/**
 * Ícono Material que representa visualmente cada tipo en la lista del
 * banco. Mantener consistentes con los íconos ya usados en la app.
 */
export const QUESTION_KIND_ICON: Record<QuestionKind, string> = {
  [QuestionKind.MULTIPLE_CHOICE_SINGLE]: "radio_button_checked",
  [QuestionKind.TRUE_FALSE]: "rule",
  [QuestionKind.OPEN]: "edit_note",
  [QuestionKind.NUMERIC]: "calculate",
};
