/**
 * Datos de ejemplo para demos: estudiantes con nombres colombianos y
 * respuestas simuladas con un modelo logístico (habilidad del
 * estudiante vs. dificultad del ítem). Determinista con la semilla.
 */

import { KeyEntry } from "../models/assessment.model";
import { DetectedAnswer } from "../models/gradedExam.model";
import { createRng, Rng } from "./rng";

export const DEMO_TAG = "(ejemplo)";
export const DEMO_FOLDER = "Ejemplo · Saber 11";
export const DEMO_ASSESSMENT_PREFIX = "[Ejemplo]";

const FIRST = [
  "Valentina", "Santiago", "Mariana", "Samuel", "Isabella", "Matías", "Sofía", "Sebastián",
  "Gabriela", "Juan José", "Daniela", "Alejandro", "Luciana", "Nicolás", "Sara", "Miguel Ángel",
  "Camila", "Tomás", "Antonella", "David", "Paula Andrea", "Julián", "Laura", "Emmanuel",
  "Manuela", "Andrés Felipe", "María José", "Esteban", "Salomé", "Juan Pablo",
];
const LAST = [
  "Rodríguez", "Gómez", "González", "Martínez", "García", "López", "Hernández", "Sánchez",
  "Ramírez", "Pérez", "Díaz", "Muñoz", "Rojas", "Moreno", "Jiménez", "Vargas", "Castro",
  "Ortiz", "Rincón", "Cárdenas", "Ospina", "Mejía", "Restrepo", "Zapata", "Quintero",
];

export interface DemoStudent {
  code: string;
  fullName: string;
  group: string;
  /** Habilidad simulada (≈ −2 … 2). */
  ability: number;
}

/** `perGroup` estudiantes en cada grupo, nombres sin repetir. */
export function demoStudents(groups: string[], perGroup: number, seed = 2026): DemoStudent[] {
  const rng = createRng(seed);
  const used = new Set<string>();
  const out: DemoStudent[] = [];
  groups.forEach((group, g) => {
    for (let i = 0; i < perGroup; i++) {
      let name = "";
      do {
        const first = FIRST[Math.floor(rng() * FIRST.length)];
        const l1 = LAST[Math.floor(rng() * LAST.length)];
        const l2 = LAST[Math.floor(rng() * LAST.length)];
        name = `${first} ${l1} ${l2}`;
      } while (used.has(name) || name.split(" ").slice(-2)[0] === name.split(" ").slice(-1)[0]);
      used.add(name);
      out.push({
        code: String(110001 + out.length),
        fullName: name,
        group,
        // Cada grupo con un nivel medio distinto para que el reporte
        // por grupo muestre diferencias.
        ability: normal(rng) * 0.9 + (g === 0 ? 0.35 : -0.25),
      });
    }
  });
  return out;
}

/**
 * Respuestas simuladas para una forma. `difficultyOf(itemId)` en 1–3;
 * `shift` mueve la habilidad (ej. un simulacro anterior más bajo).
 * Los errores eligen el distractor de la posición siguiente a la clave
 * con más probabilidad, así el análisis de distractores muestra uno
 * "atractivo".
 */
export function simulateAnswers(
  key: KeyEntry[],
  letters: string[],
  ability: number,
  difficultyOf: (itemId: string | null) => number,
  rng: Rng,
  shift = 0
): DetectedAnswer[] {
  return key.map((entry) => {
    if (!entry.letter) return null;
    const b = (difficultyOf(entry.itemId) - 2) * 0.9;
    const p = 1 / (1 + Math.exp(-1.7 * (ability + shift - b)));
    const r = rng();
    if (r < p) return entry.letter;
    if (r > 0.97) return null;
    const correct = letters.indexOf(entry.letter);
    const options = Math.max(2, letters.length);
    const attractive = (correct + 1) % options;
    if (rng() < 0.55) return letters[attractive];
    const others = letters.slice(0, options).filter((_, i) => i !== correct);
    return others[Math.floor(rng() * others.length)];
  });
}

/** Normal estándar (Box–Muller). */
function normal(rng: Rng): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
