/** Guías públicas (contenido para buscadores). */
export interface Guide {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  updated: string;
}

export const GUIDES: Guide[] = [
  {
    slug: "calculadora-puntaje-global-saber-11",
    title: "Calculadora del puntaje global Saber 11",
    description:
      "Calcula el puntaje global del Saber 11 (0 a 500) a partir de los puntajes de las cinco pruebas y entiende cómo pesa cada una.",
    kicker: "Herramienta gratis",
    updated: "2026-10-16",
  },
  {
    slug: "como-leer-resultados-saber-11",
    title: "Cómo leer los resultados del Saber 11",
    description:
      "Puntaje global, puntaje por prueba, niveles de desempeño y competencias: qué significa cada dato y cómo usarlo para mejorar en el colegio.",
    kicker: "Guía para coordinadores",
    updated: "2026-10-16",
  },
  {
    slug: "como-hacer-un-simulacro-saber-11",
    title: "Cómo hacer un simulacro Saber 11 en el colegio",
    description:
      "Paso a paso para preparar, aplicar y calificar un simulacro tipo Saber 11: preguntas, formas, hojas de respuestas e informe por competencia.",
    kicker: "Paso a paso",
    updated: "2026-10-16",
  },
];
