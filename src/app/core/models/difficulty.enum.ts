/**
 * Nivel de dificultad de una pregunta. Tres niveles balancean
 * granularidad con simplicidad para el profe: muchos niveles
 * (1–5, 1–10) son indecisos y nadie los aplica consistentemente.
 */
export enum Difficulty {
  EASY = 1,
  MEDIUM = 2,
  HARD = 3,
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  [Difficulty.EASY]: "Fácil",
  [Difficulty.MEDIUM]: "Media",
  [Difficulty.HARD]: "Difícil",
};

/** Color/tono para cada nivel — verde → ámbar → rojo. */
export const DIFFICULTY_COLOR: Record<
  Difficulty,
  { bg: string; text: string; border: string }
> = {
  [Difficulty.EASY]: {
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
  },
  [Difficulty.MEDIUM]: {
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fde68a",
  },
  [Difficulty.HARD]: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
  },
};
