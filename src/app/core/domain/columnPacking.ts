/**
 * Reparto de bloques del cuadernillo en 2 columnas tipo periódico.
 *
 * pdfmake no puede hacer fluir texto de una columna a la otra, así que
 * el reparto se decide antes de renderizar, con alturas ESTIMADAS:
 * se llena la columna izquierda, luego la derecha y luego la página
 * siguiente. Un bloque nunca se parte; uno más alto que lo razonable
 * para una columna (lecturas largas) va a ancho completo.
 */

export interface PackBlock {
  /** Altura estimada a ancho de columna (pt). */
  height: number;
  /** Altura estimada a ancho completo (pt), para bloques anchos. */
  fullHeight?: number;
  /** No dejarlo al final de una columna sin el bloque siguiente. */
  keepWithNext?: boolean;
  /** Forzar ancho completo. */
  fullWidth?: boolean;
}

export type PackSegment =
  | { kind: "columns"; left: number[]; right: number[]; newPage: boolean }
  | { kind: "full"; index: number; newPage: boolean };

export interface PackOptions {
  /** Alto útil de la primera página (pt). */
  firstPageHeight: number;
  /** Alto útil de las demás páginas (pt). */
  pageHeight: number;
  /** Fracción de columna a partir de la cual un bloque va a ancho completo. */
  fullWidthThreshold?: number;
}

export function packColumns(blocks: PackBlock[], opts: PackOptions): PackSegment[] {
  const threshold = opts.fullWidthThreshold ?? 0.6;
  const segments: PackSegment[] = [];
  let page = 0;
  let y = 0; // alto ya ocupado en la página actual (pt)
  let seg: Extract<PackSegment, { kind: "columns" }> | null = null;
  let used: [number, number] = [0, 0];
  let col = 0;
  let pendingNewPage = false;

  const cap = () => (page === 0 ? opts.firstPageHeight : opts.pageHeight);
  const closeSegment = () => {
    if (seg && (seg.left.length || seg.right.length)) {
      segments.push(seg);
      y += Math.max(used[0], used[1]);
    }
    seg = null;
    used = [0, 0];
    col = 0;
  };
  const newPage = () => {
    closeSegment();
    page++;
    y = 0;
    pendingNewPage = true;
  };
  const openSegment = () => {
    if (!seg) {
      seg = { kind: "columns", left: [], right: [], newPage: pendingNewPage };
      pendingNewPage = false;
    }
    return seg;
  };

  blocks.forEach((b, i) => {
    const colCap = cap() - y;
    const wide = b.fullWidth || b.height > opts.pageHeight * threshold;
    if (wide) {
      closeSegment();
      const h = b.fullHeight ?? b.height;
      // Si casi no queda espacio en la página, empezar en una nueva.
      if (cap() - y < Math.min(h, 80)) newPage();
      segments.push({ kind: "full", index: i, newPage: pendingNewPage });
      pendingNewPage = false;
      y += h;
      while (y > cap()) {
        y -= cap();
        page++;
      }
      return;
    }

    const need = b.height + (b.keepWithNext ? blocks[i + 1]?.height ?? 0 : 0);
    const fits = (c: number) => used[c] + Math.min(need, colCap) <= colCap || used[c] === 0;

    if (col === 0 && !fits(0)) col = 1;
    if (col === 1 && !fits(1)) {
      newPage();
    }
    const s = openSegment();
    (col === 0 ? s.left : s.right).push(i);
    used[col] += b.height;
  });
  closeSegment();
  return segments;
}

// ---------------------------------------------------------------------
//  Estimación de alturas (Roboto, la fuente por defecto de pdfmake)
// ---------------------------------------------------------------------

/** Alto de línea de Roboto en pdfmake (lineHeight 1). */
export const LINE_HEIGHT = 1.17;

/** Ancho medio de carácter en em (Roboto, texto en español). */
const CHAR_EM = { regular: 0.5, bold: 0.53 };

/** Líneas que ocupa un texto en un ancho dado. */
export function estimateLines(
  text: string,
  widthPt: number,
  fontSize: number,
  bold = false
): number {
  const perLine = Math.max(1, Math.floor(widthPt / (fontSize * (bold ? CHAR_EM.bold : CHAR_EM.regular))));
  return (text || " ")
    .split("\n")
    .reduce((sum, para) => sum + Math.max(1, Math.ceil((para.length * 1.06) / perLine)), 0);
}

export function estimateTextHeight(
  text: string,
  widthPt: number,
  fontSize: number,
  bold = false
): number {
  return estimateLines(text, widthPt, fontSize, bold) * fontSize * LINE_HEIGHT;
}
