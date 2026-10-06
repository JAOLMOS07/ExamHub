/**
 * Parser del listado de estudiantes pegado desde Excel o exportado
 * de SIMAT. Acepta separador coma, punto y coma o tabulación, con o
 * sin fila de encabezado.
 *
 * Columnas reconocidas (en cualquier orden si hay encabezado):
 *   código | nombre | grupo
 * Sin encabezado se asume: código, nombre, grupo (opcional).
 */
export interface StudentRow {
  code: string;
  fullName: string;
  group?: string;
}

export interface StudentsParseResult {
  rows: StudentRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<keyof StudentRow, string[]> = {
  code: ["codigo", "código", "code", "id", "documento", "doc", "numero", "número"],
  fullName: ["nombre", "nombres", "estudiante", "name", "nombre completo", "apellidos y nombres"],
  group: ["grupo", "curso", "group", "grado"],
};

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function detectSeparator(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseStudentsCsv(text: string): StudentsParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const result: StudentsParseResult = { rows: [], errors: [] };
  if (lines.length === 0) {
    result.errors.push("No hay filas para importar.");
    return result;
  }
  const sep = detectSeparator(lines[0]);
  const first = splitLine(lines[0], sep).map(normalize);

  let columns: Partial<Record<keyof StudentRow, number>> = {};
  let start = 0;
  for (const field of Object.keys(HEADER_ALIASES) as (keyof StudentRow)[]) {
    const idx = first.findIndex((h) => HEADER_ALIASES[field].map(normalize).includes(h));
    if (idx >= 0) columns[field] = idx;
  }
  if (columns.code !== undefined && columns.fullName !== undefined) {
    start = 1;
  } else {
    columns = { code: 0, fullName: 1, group: 2 };
  }

  const seen = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i], sep);
    const code = (cells[columns.code!] ?? "").replace(/\s+/g, "");
    const fullName = (cells[columns.fullName!] ?? "").replace(/\s+/g, " ").trim();
    const group = columns.group !== undefined ? cells[columns.group]?.trim() : undefined;
    const lineNo = i + 1;
    if (!code || !fullName) {
      result.errors.push(`Fila ${lineNo}: falta el código o el nombre.`);
      continue;
    }
    if (!/^\d+$/.test(code)) {
      result.errors.push(
        `Fila ${lineNo}: el código "${code}" debe tener solo dígitos (se rellena en burbujas 0–9).`
      );
      continue;
    }
    if (seen.has(code)) {
      result.errors.push(`Fila ${lineNo}: el código ${code} está repetido.`);
      continue;
    }
    seen.add(code);
    result.rows.push(group ? { code, fullName, group } : { code, fullName });
  }
  return result;
}
