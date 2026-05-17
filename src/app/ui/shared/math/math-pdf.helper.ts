import html2canvas from "html2canvas";
import { MathTextComponent } from "./math-text.component";

/**
 * Padding interno del iframe de render. Sirve como margen de
 * seguridad para que KaTeX no recorte trazos al borde, pero después
 * del render el canvas se RECORTA automáticamente para eliminar el
 * blanco sobrante (auto-trim) — así la imagen final tiene el alto
 * justo y no separa el enunciado de las opciones en el PDF.
 */
const PAD_X = 8;
const PAD_Y = 8;

/**
 * Convierte un texto que puede contener fórmulas LaTeX en un nodo de
 * pdfmake. Si no hay fórmulas, devuelve texto plano. Si hay, renderiza
 * con KaTeX dentro de un iframe aislado, captura con html2canvas y
 * RECORTA automáticamente los bordes blancos para que la imagen
 * resultante tenga la altura justa del contenido.
 */
export async function textToPdfNode(
  text: string,
  maxWidth: number = 500,
  fontSizePx: number = 14
): Promise<any> {
  const safeText = text ?? "";
  if (!safeText.includes("$")) {
    return { text: safeText };
  }

  const contentWidth = maxWidth;
  const iframeWidth = contentWidth + PAD_X * 2;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = `${iframeWidth}px`;
  iframe.style.height = "100px";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;

    const katexLinks = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    ).filter((l) =>
      ((l as HTMLLinkElement).href || "").includes("katex")
    ) as HTMLLinkElement[];

    let cssLinks = katexLinks
      .map((l) => `<link rel="stylesheet" href="${l.href}">`)
      .join("\n");

    if (!cssLinks) {
      cssLinks = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">`;
    }

    const renderedHtml = MathTextComponent.renderToHtml(safeText);

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          ${cssLinks}
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: ${fontSizePx}px;
              line-height: 1.45;
              padding: ${PAD_Y}px ${PAD_X}px;
              width: ${contentWidth}px;
              box-sizing: content-box;
              white-space: pre-wrap;
              word-break: break-word;
            }
            /*
              CRÍTICO: KaTeX calcula la posición de la línea de fracción,
              numerador, denominador, raíces, exponentes, etc. con valores
              relativos al line-height del contexto. Si heredamos el
              line-height de body (1.45 ó 2.2), las fracciones quedan
              DESALINEADAS — la línea de la fracción aparece arriba del
              numerador en lugar de en el medio.
              Forzar line-height: normal aquí restaura los cálculos
              internos de KaTeX y las fórmulas se ven correctas.
            */
            .katex, .katex * {
              line-height: normal !important;
              color: #000 !important;
            }
            .katex {
              font-size: 1.05em;
            }
            .katex-display {
              margin: 0.3em 0;
            }
            /* La línea de la fracción usa border-bottom; forzamos
               estilo sólido por si Tailwind/DaisyUI se filtra. */
            .katex .frac-line {
              border-bottom-style: solid !important;
              border-bottom-color: #000 !important;
            }
          </style>
        </head>
        <body>${renderedHtml}</body>
      </html>
    `);
    doc.close();

    await waitForReady(iframe);

    const body = doc.body;
    const totalWidth = iframeWidth;
    const totalHeight = Math.max(body.scrollHeight, body.offsetHeight) + 4;

    iframe.style.height = `${totalHeight}px`;
    await new Promise<void>((r) => setTimeout(r, 30));

    const rawCanvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      width: totalWidth,
      height: totalHeight,
      windowWidth: totalWidth,
      windowHeight: totalHeight,
    });

    // Auto-trim: recortar los bordes blancos del canvas para que la
    // imagen final tenga el alto JUSTO del contenido. Sin esto, el
    // PAD_Y y el line-height generoso generaban espacio en blanco
    // enorme entre el enunciado y las opciones en el PDF.
    const trimmedCanvas = trimWhitespace(rawCanvas);

    const dataUrl = trimmedCanvas.toDataURL("image/png");
    return {
      image: dataUrl,
      width: Math.min(contentWidth, trimmedCanvas.width / 2),
    };
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Recorta los bordes blancos (o casi blancos) del canvas. Devuelve un
 * nuevo canvas solo con el área que tiene contenido.
 *
 * Usa un umbral tolerante: pixel "blanco" = todos los canales >= 250.
 * Eso permite ignorar sub-píxeles grises del antialiasing.
 */
function trimWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const isWhite = (i: number) =>
    data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250;

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  // Buscar primera fila no-blanca desde arriba
  outerTop: for (top = 0; top < height; top++) {
    for (let x = 0; x < width; x++) {
      if (!isWhite((top * width + x) * 4)) break outerTop;
    }
  }
  // Desde abajo
  outerBottom: for (bottom = height - 1; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) {
      if (!isWhite((bottom * width + x) * 4)) break outerBottom;
    }
  }
  // Desde la izquierda
  outerLeft: for (left = 0; left < width; left++) {
    for (let y = top; y <= bottom; y++) {
      if (!isWhite((y * width + left) * 4)) break outerLeft;
    }
  }
  // Desde la derecha
  outerRight: for (right = width - 1; right >= left; right--) {
    for (let y = top; y <= bottom; y++) {
      if (!isWhite((y * width + right) * 4)) break outerRight;
    }
  }

  // Sumar un pequeño padding (4px en cada lado en coords del canvas)
  // para que las fórmulas no queden cortadas al ras.
  const margin = 4;
  top = Math.max(0, top - margin);
  bottom = Math.min(height - 1, bottom + margin);
  left = Math.max(0, left - margin);
  right = Math.min(width - 1, right + margin);

  const newWidth = right - left + 1;
  const newHeight = bottom - top + 1;

  // Si por alguna razón el trim falla (canvas vacío), devolver el original.
  if (newWidth <= 0 || newHeight <= 0) {
    return canvas;
  }

  const trimmed = document.createElement("canvas");
  trimmed.width = newWidth;
  trimmed.height = newHeight;
  const trimmedCtx = trimmed.getContext("2d");
  if (!trimmedCtx) return canvas;
  trimmedCtx.drawImage(
    canvas,
    left,
    top,
    newWidth,
    newHeight,
    0,
    0,
    newWidth,
    newHeight
  );
  return trimmed;
}

async function waitForReady(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument!;

  const links = Array.from(
    doc.querySelectorAll('link[rel="stylesheet"]')
  ) as HTMLLinkElement[];

  await Promise.all(
    links.map(
      (l) =>
        new Promise<void>((resolve) => {
          if ((l as any).sheet) return resolve();
          l.addEventListener("load", () => resolve(), { once: true });
          l.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 2000);
        })
    )
  );

  if ((doc as any).fonts?.ready) {
    try {
      await (doc as any).fonts.ready;
    } catch {
      // ignorar
    }
  }

  await new Promise<void>((r) => setTimeout(r, 80));
}
