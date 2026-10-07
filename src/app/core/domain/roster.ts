/**
 * Asignación de formas a estudiantes para hojas personalizadas.
 *
 * Dentro de cada grupo los estudiantes se ordenan por nombre (el orden
 * de lista) y las formas se alternan A, B, C… Así quienes están juntos
 * en la lista —y casi siempre sentados juntos— reciben formas distintas.
 */
export interface RosterStudent {
  id: string;
  fullName: string;
  groupId: string | null;
}

export interface RosterEntry {
  studentId: string;
  name: string;
  groupId: string | null;
  formId: string;
}

export function assignForms(
  students: RosterStudent[],
  groupOrder: string[],
  formIds: string[]
): RosterEntry[] {
  if (formIds.length === 0) return [];
  const byName = (a: RosterStudent, b: RosterStudent) =>
    a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
  const entries: RosterEntry[] = [];
  for (const groupId of groupOrder) {
    students
      .filter((s) => s.groupId === groupId)
      .sort(byName)
      .forEach((s, i) =>
        entries.push({
          studentId: s.id,
          name: s.fullName,
          groupId: s.groupId,
          formId: formIds[i % formIds.length],
        })
      );
  }
  return entries;
}

/** Estudiantes del listado que aún no tienen respuesta calificada. */
export function pendingFromRoster(
  roster: RosterEntry[],
  gradedStudentIds: Iterable<string>
): RosterEntry[] {
  const done = new Set(gradedStudentIds);
  return roster.filter((r) => !done.has(r.studentId));
}
