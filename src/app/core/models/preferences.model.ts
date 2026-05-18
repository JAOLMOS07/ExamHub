/**
 * Plantilla de examen — un perfil guardado con valores pre-cargados
 * para el formulario de "Generar Examen". El profe lo selecciona y
 * el header se llena automáticamente, evitando re-tipear cada vez.
 *
 * Típicamente un profe va a tener una plantilla "Colegio X – Grado Y"
 * que reutiliza en todos sus exámenes.
 */
export interface ExamTemplate {
  id: string;
  /** Nombre interno para identificarla en el selector. Ej: "Colegio San Martín – 7° básico". */
  name: string;
  /** Institución que aparece en el header del PDF. */
  institution?: string;
  /** Título del examen. Ej: "Evaluación de Matemática – Unidad 3". */
  title?: string;
  /** Lugar/dirección que aparece debajo del título. */
  place?: string;
  /** Subtítulo informativo (típicamente período / docente). */
  subtitle?: string;
  /** Grado que se imprime junto al nombre del estudiante. */
  grade?: string;
  /** Layout sugerido: 1col o 2col. */
  layout?: "1col" | "2col";
}

/**
 * Preferencias del usuario — vive en Firestore como un único
 * documento por usuario: `users/<uid>/preferences/profile`.
 *
 * Provee tres beneficios:
 *  1. Autocompletar consistente en los inputs de Materia y Grado
 *     (evita "Matemática" vs "Matemáticas" vs "Mate").
 *  2. Plantillas de examen para no re-escribir el header.
 *  3. Base para futuras preferencias (idioma, layout default, etc.).
 */
export interface UserPreferences {
  /** Materias predefinidas. Aparecen como sugerencias en datalist. */
  subjects: string[];
  /** Grados predefinidos. */
  grades: string[];
  /** Plantillas de examen. */
  examTemplates: ExamTemplate[];
}

/** Preferencias por defecto cuando un usuario nuevo entra y aún no
 *  guardó nada. Incluyen sugerencias típicas para empezar más rápido. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  subjects: [
    "Matemática",
    "Lengua y Literatura",
    "Sociales",
    "Ciencias Naturales",
    "Física",
    "Química",
    "Biología",
    "Historia",
    "Geografía",
    "Inglés",
  ],
  grades: [
    "1° básico",
    "2° básico",
    "3° básico",
    "4° básico",
    "5° básico",
    "6° básico",
    "7°",
    "8°",
    "9°",
    "10°",
    "11°",
  ],
  examTemplates: [],
};
