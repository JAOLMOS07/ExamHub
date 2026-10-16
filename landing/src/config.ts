/**
 * Datos que cambian sin tocar el diseño. Completa los marcados con [ ].
 */
export const SITE = {
  name: "ExamHub",
  tagline: "Del lápiz al resultado, en segundos.",
  description:
    "Simulacros tipo Saber 11 en papel, calificados con el celular. Hojas con el nombre de cada estudiante, funciona sin internet e informes por competencia para colegios de Colombia.",
  appUrl: "https://exam-hub-woad.vercel.app",
  /** Número de WhatsApp Business con indicativo, sin + ni espacios. [ ] */
  whatsapp: "573137931748",
  /** Correo de contacto. [ ] */
  email: "[correo]",
  instagram: "https://instagram.com/examhub.co",
  tiktok: "https://tiktok.com/@examhub.co",
};

export const waLink = (text: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

export const WA_DEMO = waLink(
  "Hola, quiero el simulacro diagnóstico gratis de ExamHub para mi colegio."
);

/** Precios de lanzamiento (COP). Ajusta aquí. */
export const PLANS = [
  {
    id: "docente",
    name: "Docente",
    price: "Gratis",
    unit: "para siempre",
    pitch: "Para empezar con tus grupos.",
    features: ["Banco de preguntas y lecturas", "Exámenes en PDF con varias formas", "Calificación con el celular", "Crea preguntas con tu IA gratis"],
    cta: "Crear cuenta",
    href: "app",
  },
  {
    id: "pro",
    name: "Docente Pro",
    price: "$199.000",
    unit: "al año",
    pitch: "Para el profe que hace simulacros.",
    features: ["Todo lo de Docente", "Informes por competencia", "Boletines para familias", "Libro de Excel completo"],
    cta: "Crear cuenta",
    href: "app",
  },
  {
    id: "colegio",
    name: "Colegio",
    price: "$8.000",
    unit: "por estudiante al año",
    pitch: "Todo el colegio en un solo lugar.",
    features: ["Todos los docentes y grupos", "Hojas con el nombre de cada estudiante", "Informe para rectoría", "Datos de cada año guardados", "Mínimo $1.500.000 al año"],
    cta: "Hablar con nosotros",
    href: "wa",
    featured: true,
  },
  {
    id: "saber",
    name: "Colegio Saber",
    price: "$15.000",
    unit: "por estudiante al año",
    pitch: "Simulacros Saber 11 listos y acompañamiento.",
    features: ["Todo lo de Colegio", "Simulacros Saber 11 listos para aplicar", "Plan de mejora con el equipo", "Capacitación docente"],
    cta: "Hablar con nosotros",
    href: "wa",
  },
];
