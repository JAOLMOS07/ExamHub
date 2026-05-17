/**
 * Tipos de nodos del banco.
 *
 * - FOLDER: carpeta, puede contener cualquier cosa.
 * - QUESTION: pregunta atómica del examen.
 * - PASSAGE: "lectura" / contexto: un texto largo introductorio
 *            (típico en exámenes de Sociales, Lenguaje, Matemáticas
 *            con problemas de aplicación) que tiene preguntas
 *            asociadas como hijas. Se renderiza en el PDF como bloque
 *            de texto antes de las preguntas, una sola vez por grupo.
 *
 * Los valores numéricos no se deben cambiar — están persistidos en
 * Firestore para los bancos existentes.
 */
export enum objectType {
  FOLDER = 0,
  QUESTION = 1,
  PASSAGE = 2,
}
