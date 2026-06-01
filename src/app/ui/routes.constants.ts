export const PRINCIPAL = {
  NAME: "principal",
  HOME: "home",
  LOGIN: "login",
};
export const EXAM = {
  NAME: "exam",
};
export const GRADE = {
  NAME: "grade",
  LIST: "",
  SCAN: "scan",
  EXAM: "exam",
  /** Subruta de un examen específico para calificar una hoja nueva. */
  GRADE_NEW: "grade",
};
export const MODULES = {
  HOME: {
    HOME: `/${PRINCIPAL.NAME}/${PRINCIPAL.HOME}`,
  },
  EXAM: {
    EXAM: `/${PRINCIPAL.NAME}/${EXAM.NAME}`,
  },
  LOGIN: {
    LOGIN: `/${PRINCIPAL.NAME}/${PRINCIPAL.LOGIN}`,
  },
  GRADE: {
    LIST: `/${GRADE.NAME}`,
    SCAN: `/${GRADE.NAME}/${GRADE.SCAN}`,
    /** Detalle del examen: lista de resultados, exportar, etc. */
    EXAM: (examId: string) => `/${GRADE.NAME}/${GRADE.EXAM}/${examId}`,
    /** Pantalla de calificación para escanear una hoja nueva (manual
     *  o foto) de un examen específico. */
    EXAM_GRADE: (examId: string) =>
      `/${GRADE.NAME}/${GRADE.EXAM}/${examId}/${GRADE.GRADE_NEW}`,
  },
};
