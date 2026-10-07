/**
 * Color de cada prueba ICFES en toda la interfaz (chips del banco,
 * barras de los reportes). Mismo orden y tono siempre: el docente
 * aprende a reconocer la prueba por el color.
 *
 * Las clases CSS equivalentes son `.eh-test--<id>` (styles.css).
 */
export const TEST_COLOR: Record<string, { fg: string; bg: string; bar: string }> = {
  lectura_critica: { fg: "#6d28d9", bg: "#f5f3ff", bar: "#8b5cf6" },
  matematicas: { fg: "#1d4ed8", bg: "#eff6ff", bar: "#3b82f6" },
  sociales_ciudadanas: { fg: "#c2410c", bg: "#fff7ed", bar: "#f97316" },
  ciencias_naturales: { fg: "#047857", bg: "#ecfdf5", bar: "#10b981" },
  ingles: { fg: "#be123c", bg: "#fff1f2", bar: "#f43f5e" },
};

export function testBarColor(testId: string | undefined | null): string {
  return (testId && TEST_COLOR[testId]?.bar) || "#94a3b8";
}
