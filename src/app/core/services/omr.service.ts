import { Injectable } from "@angular/core";
import { AnswerLetter, DetectedAnswer } from "../models/gradedExam.model";
import {
  BUBBLE_SAMPLE_RADIUS_PT,
  FIDUCIAL_CENTERS,
  FIDUCIAL_SIZE_PT,
  PAGE_H_PT,
  PAGE_W_PT,
  bubbleCenter,
} from "../utils/omrLayout.const";

/**
 * ========================================================================
 *  OmrService — Optical Mark Recognition para hojas de respuestas ExamHub
 * ------------------------------------------------------------------------
 *  Carga OpenCV.js perezosamente (~9MB, solo cuando el profe usa el
 *  auto-grading) y corre el pipeline:
 *
 *      foto → grayscale → threshold → fiducials → warp →
 *      Hough circles → fill check → DetectedAnswer[]
 *
 *  El servicio NO conoce el modelo de negocio (planes, examen, etc.).
 *  Recibe una imagen + parámetros del examen y devuelve respuestas.
 *  La integración con la pantalla de grading vive en el componente.
 *
 *  PARÁMETROS DE CALIBRACIÓN (ver constantes abajo):
 *    Los valores default funcionan razonablemente con fotos de
 *    celular medianamente buenas. Si el motor falla con muchas
 *    fotos reales, ajustá las constantes (sobre todo BUBBLE_*_PX
 *    y FILL_THRESHOLD).
 * ========================================================================
 */

// ----- Constantes del canónico (post-warp) -----
//
// Trabajamos a 2x el tamaño del PDF en puntos. Eso da resolución
// suficiente para muestrear burbujas con precisión, sin que la
// matriz sea tan grande que cv.js tarde una eternidad.
// Como las coords del PDF están en pt, basta multiplicar por
// CANONICAL_SCALE para llevarlas al sistema del canónico.
const CANONICAL_SCALE = 2;
const CANONICAL_W = PAGE_W_PT * CANONICAL_SCALE;
const CANONICAL_H = PAGE_H_PT * CANONICAL_SCALE;

/** Convierte (x, y) en pt del PDF a coords del canónico. */
const pt = (v: number) => v * CANONICAL_SCALE;

/** Posiciones objetivo de los centros de fiduciales en el canónico
 *  (warp perspective los mapea ACA exactamente). */
const FIDUCIAL_TARGETS = {
  tl: { x: pt(FIDUCIAL_CENTERS.tl.x), y: pt(FIDUCIAL_CENTERS.tl.y) },
  tr: { x: pt(FIDUCIAL_CENTERS.tr.x), y: pt(FIDUCIAL_CENTERS.tr.y) },
  bl: { x: pt(FIDUCIAL_CENTERS.bl.x), y: pt(FIDUCIAL_CENTERS.bl.y) },
  br: { x: pt(FIDUCIAL_CENTERS.br.x), y: pt(FIDUCIAL_CENTERS.br.y) },
};

// "Lleno" si el promedio del centro está por debajo (más oscuro) que este umbral
const FILL_THRESHOLD = 130; // 0=negro puro, 255=blanco puro

const PDF_PAGE_WIDTH_PT = PAGE_W_PT;

/** Ancho máximo de la imagen antes de procesar. Fotos de celulares
 *  modernos pueden venir a 4000+ px de ancho — procesar eso completo
 *  con OpenCV.js tarda 30-60s y agota memoria. Downscaleamos al inicio
 *  para que el pipeline corra en 1-3 segundos sin perder precisión
 *  útil (las fiduciales y burbujas siguen siendo claramente legibles
 *  a 1200 px). */
const MAX_INPUT_WIDTH_PX = 1400;

/** Resultado del pipeline OMR. */
export interface OmrResult {
  /** Array de respuestas detectadas, alineado con `letters`. */
  answers: DetectedAnswer[];
  /** Imagen canónica con overlay de burbujas detectadas (data URL).
   *  Sirve para que el profe vea qué pasó visualmente. */
  previewDataUrl: string;
  /** Cuántas filas se detectaron (no necesariamente = expectedQuestions). */
  detectedRows: number;
  /** Cuántas fiduciales se detectaron (4 = ideal, <4 = degradado). */
  fiducialsFound: number;
}

/** Error del pipeline con mensaje en español para mostrar al usuario. */
export class OmrError extends Error {
  constructor(message: string, public readonly userFacingHint?: string) {
    super(message);
  }
}

@Injectable({ providedIn: "root" })
export class OmrService {
  /** Promesa de carga de OpenCV (singleton). null = no se intentó cargar aún. */
  private cvReady: Promise<any> | null = null;

  /**
   * Carga OpenCV.js perezosamente.
   *
   * CRÍTICO: NO devolvemos `cv` desde acá. El objeto `cv` de OpenCV.js
   * expone un método `.then()` propio que es buggy — si una `async`
   * function la devuelve, el `Promise.resolve(cv)` implícito intenta
   * seguir esa thenable y se cuelga. Por eso esta función retorna
   * `Promise<void>` y `cv` se lee con `getCv()` (o `window.cv`) DESPUÉS
   * de awaitar.
   */
  public ensureLoaded(): Promise<void> {
    if (!this.cvReady) {
      this.cvReady = this.loadInternal();
    }
    return this.cvReady;
  }

  /** Devuelve el `cv` global. Solo llamar después de `await ensureLoaded()`. */
  public getCv(): any {
    return (window as any).cv;
  }

  /**
   * Chequea si OpenCV.js terminó de inicializar el wasm AL COMPLETO.
   *
   * OJO: `cv.imread` aparece como función ANTES de que el wasm esté
   * listo (es solo un wrapper JS). El indicador verdadero de "todo
   * disponible" es que `cv.Mat` sea un constructor instanciable.
   * Si chequeás solo `cv.imread`, te puede dar falso positivo y al
   * primer `new cv.Mat()` explota con "cv.Mat is not a constructor".
   */
  private isCvFullyReady(cv: any): boolean {
    if (!cv) return false;
    if (typeof cv.imread !== "function") return false;
    if (typeof cv.Mat !== "function") return false;
    // Test final: intentar instanciar una Mat vacía. Si tira, no está.
    try {
      const m = new cv.Mat();
      m.delete();
      return true;
    } catch {
      return false;
    }
  }

  private loadInternal(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const w = window as any;
      const log = (m: string) => console.log(`[OMR loader] ${m}`);

      // Si ya está cargado COMPLETO, listo.
      if (this.isCvFullyReady(w.cv)) {
        log("cv ya disponible al iniciar");
        resolve();
        return;
      }

      const startedAt = performance.now();
      const TIMEOUT_MS = 30000;
      let resolved = false;

      const finishOk = () => {
        if (resolved) return;
        resolved = true;
        log(
          `cv totalmente listo en ${Math.round(
            performance.now() - startedAt
          )}ms`
        );
        resolve();
      };

      const finishErr = (err: Error) => {
        if (resolved) return;
        resolved = true;
        log(`error: ${err.message}`);
        reject(err);
      };

      // Polling: chequea cada 200ms si `cv.Mat` ya es constructor
      // instanciable (NO basta con cv.imread — ese aparece antes
      // de que el wasm termine y da falso positivo).
      const startPolling = () => {
        const tick = () => {
          if (resolved) return;
          if (this.isCvFullyReady(w.cv)) {
            finishOk();
            return;
          }
          if (performance.now() - startedAt > TIMEOUT_MS) {
            finishErr(
              new OmrError(
                "El motor de visión está tardando demasiado. Revisá tu conexión a internet."
              )
            );
            return;
          }
          setTimeout(tick, 200);
        };
        tick();
      };

      // Hook de Module.onRuntimeInitialized — esta es la señal
      // oficial de que el wasm terminó de compilarse. Combinado con
      // el polling cubrimos todos los escenarios.
      w.Module = w.Module || {};
      const prevHook = w.Module.onRuntimeInitialized;
      w.Module.onRuntimeInitialized = () => {
        log("Module.onRuntimeInitialized disparado");
        if (typeof prevHook === "function") {
          try {
            prevHook();
          } catch {
            /* ignore */
          }
        }
        // Damos un tick para que el binding de cv.Mat termine
        // de exponerse, después validamos el ready completo.
        setTimeout(() => {
          if (this.isCvFullyReady(w.cv)) finishOk();
        }, 0);
      };

      log("inyectando script de OpenCV.js…");
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://docs.opencv.org/4.8.0/opencv.js";

      script.onload = () => {
        log("script cargado, esperando inicialización del wasm");
        startPolling();
      };

      script.onerror = () =>
        finishErr(
          new OmrError(
            "No pudimos descargar el motor de visión. Verificá tu conexión y reintentá."
          )
        );

      document.head.appendChild(script);
    });
  }

  /**
   * Pipeline principal. Toma una imagen (cualquier formato que cargue
   * un <img>) y devuelve las respuestas detectadas.
   *
   * @param image          HTMLImageElement ya cargado (decodificado).
   * @param totalQuestions Cuántas preguntas tiene el examen.
   * @param letters        Letras válidas (ej: ["A","B","C","D"]).
   */
  /**
   * @param expectedAnswers Array con la answerKey de la versión. Su largo
   *                        es `totalQuestions`. Las entradas `null`
   *                        corresponden a preguntas NO calificables
   *                        (abiertas / numéricas) — saltamos esas filas
   *                        al mapear lo que detectamos.
   */
  public async detectAnswers(
    image: HTMLImageElement,
    expectedAnswers: (AnswerLetter | null)[],
    letters: string[]
  ): Promise<OmrResult> {
    await this.ensureLoaded();
    const cv = this.getCv();
    if (!cv || typeof cv.imread !== "function") {
      throw new OmrError(
        "El motor de visión no está disponible. Recargá la página y reintentá."
      );
    }

    const totalQuestions = expectedAnswers.length;
    // Índices de las preguntas que SÍ se pueden calificar automáticamente.
    // Las filas detectadas en la hoja se mapean a estos índices en orden,
    // saltando las preguntas abiertas/numéricas que en la hoja aparecen
    // como texto "(se responde en el espacio…)" en vez de burbujas.
    const gradableIndices: number[] = [];
    expectedAnswers.forEach((a, i) => {
      if (a !== null) gradableIndices.push(i);
    });

    // Para diagnosticar dónde se atora si una foto tarda más de lo
    // esperado. El usuario abre DevTools → Console y nos pasa qué
    // logs aparecieron y cuáles no.
    const t0 = performance.now();
    const log = (msg: string) =>
      console.log(`[OMR ${Math.round(performance.now() - t0)}ms] ${msg}`);

    // Trackeamos Mats creados para liberarlos siempre en finally.
    const mats: any[] = [];
    const track = <T>(m: T): T => {
      mats.push(m);
      return m;
    };

    try {
      // -----------------------------------------------------------------
      // 0. Downscale: fotos de celular pueden venir a 4000+px. OpenCV.js
      //    en wasm + adaptive threshold + findContours sobre eso tarda
      //    decenas de segundos. Achicamos a MAX_INPUT_WIDTH_PX antes.
      // -----------------------------------------------------------------
      log(`imagen original: ${image.naturalWidth}x${image.naturalHeight}`);
      const scaled = this.downscaleIfNeeded(image, MAX_INPUT_WIDTH_PX);
      log(`imagen escalada: ${scaled.width}x${scaled.height}`);

      // -----------------------------------------------------------------
      // 1. Cargar imagen escalada como Mat
      // -----------------------------------------------------------------
      const src = track(cv.imread(scaled));
      log(`cv.imread OK (channels=${src.channels()})`);

      // imread normalmente devuelve RGBA, pero algunos formatos/builds
      // entregan RGB. Elegimos el conversor según el canal real.
      const gray = track(new cv.Mat());
      const grayCode =
        src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY;
      cv.cvtColor(src, gray, grayCode);
      log("grayscale OK");

      // -----------------------------------------------------------------
      // 2. Threshold (binarizamos para detección de fiduciales)
      // -----------------------------------------------------------------
      const bin = track(new cv.Mat());
      cv.adaptiveThreshold(
        gray,
        bin,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        31,
        10
      );
      log("adaptiveThreshold OK");

      // -----------------------------------------------------------------
      // 3. Detectar los 4 cuadrados fiduciales en las esquinas
      // -----------------------------------------------------------------
      const fiducials = this.findFiducials(cv, bin, src.cols, src.rows);
      log(
        `findFiducials → ${fiducials.length} encontradas: ${fiducials
          .map((f) => `${f.corner}(${Math.round(f.x)},${Math.round(f.y)})`)
          .join(" ")}`
      );

      if (fiducials.length < 4) {
        throw new OmrError(
          `Solo detectamos ${fiducials.length} de las 4 marcas de las esquinas. Probá con una foto más nítida.`,
          "Asegurate de que la hoja esté plana, bien iluminada y entren las 4 esquinas en el encuadre."
        );
      }

      // -----------------------------------------------------------------
      // 4. Warp perspectivo al canónico
      // -----------------------------------------------------------------
      const warped = track(this.warpToCanonical(cv, src, fiducials));
      log("warpPerspective OK");
      const warpedGray = track(new cv.Mat());
      const warpedGrayCode =
        warped.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY;
      cv.cvtColor(warped, warpedGray, warpedGrayCode);

      // -----------------------------------------------------------------
      // 5. Muestreo DETERMINÍSTICO de burbujas.
      //
      //    No usamos HoughCircles. Como la hoja tiene posiciones de
      //    burbujas EXACTAS y conocidas (definidas en omrLayout.const),
      //    después del warp sabemos dónde está cada una en el canónico.
      //    Solo tenemos que samplear el centro y decidir "lleno o no".
      // -----------------------------------------------------------------
      const sampledBubbles: Array<{
        questionIdx: number;
        letterIdx: number;
        x: number;
        y: number;
        fill: number;
      }> = [];
      const detectedAnswers: DetectedAnswer[] = new Array(totalQuestions).fill(
        null
      );
      const sampleRadius = Math.max(
        3,
        Math.round(BUBBLE_SAMPLE_RADIUS_PT * CANONICAL_SCALE)
      );

      for (const qIdx of gradableIndices) {
        const fills: { letterIdx: number; v: number }[] = [];
        for (let lIdx = 0; lIdx < letters.length; lIdx++) {
          const centerPt = bubbleCenter(qIdx, lIdx, totalQuestions);
          const xCan = pt(centerPt.x);
          const yCan = pt(centerPt.y);
          const v = this.measureFill(cv, warpedGray, xCan, yCan, sampleRadius);
          fills.push({ letterIdx: lIdx, v });
          sampledBubbles.push({
            questionIdx: qIdx,
            letterIdx: lIdx,
            x: xCan,
            y: yCan,
            fill: v,
          });
        }
        // Cuántas burbujas están "claramente más oscuras" que el promedio
        // de la fila + offset (= "más llenas que el resto"). Esto es más
        // robusto que un threshold absoluto porque tolera variaciones
        // de iluminación entre regiones de la foto.
        const minV = Math.min(...fills.map((f) => f.v));
        const filled = fills
          .filter((f) => f.v < FILL_THRESHOLD || f.v < minV + 25)
          .filter((f) => f.v < 180); // descartamos casos donde TODAS están blancas
        if (filled.length === 0) {
          detectedAnswers[qIdx] = null;
        } else if (filled.length === 1) {
          detectedAnswers[qIdx] = letters[filled[0].letterIdx] ?? null;
        } else {
          // Solo una claramente más oscura que las demás → la elegimos
          const sorted = filled.slice().sort((a, b) => a.v - b.v);
          if (sorted[1].v - sorted[0].v > 20) {
            detectedAnswers[qIdx] = letters[sorted[0].letterIdx] ?? null;
          } else {
            detectedAnswers[qIdx] = "MULTI";
          }
        }
      }
      log(
        `muestreo OK (${gradableIndices.length} preguntas calificables × ${letters.length} letras)`
      );

      // -----------------------------------------------------------------
      // 6. Generar preview con overlay para debugging visual
      // -----------------------------------------------------------------
      const previewDataUrl = this.renderDeterministicPreview(
        cv,
        warped,
        sampledBubbles,
        detectedAnswers,
        letters,
        totalQuestions,
        sampleRadius
      );
      log("preview generado, pipeline completo");

      return {
        answers: detectedAnswers,
        previewDataUrl,
        detectedRows: gradableIndices.length,
        fiducialsFound: fiducials.length,
      };
    } finally {
      // Liberamos TODAS las Mats trackeadas pase lo que pase.
      // Sin esto, varios runs seguidos agotan la memoria del wasm.
      for (const m of mats) {
        try {
          if (m && typeof m.delete === "function") m.delete();
        } catch {
          // Si una Mat ya fue eliminada por otra ruta, no nos importa.
        }
      }
    }
  }

  /**
   * Devuelve un HTMLCanvasElement con la imagen escalada si supera
   * `maxWidth`, o el ImageBitmap-like original si ya es chica. cv.imread
   * acepta cualquier "canvas-like".
   */
  private downscaleIfNeeded(
    img: HTMLImageElement,
    maxWidth: number
  ): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    if (img.naturalWidth <= maxWidth) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    } else {
      const scale = maxWidth / img.naturalWidth;
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new OmrError("No pudimos crear el canvas de procesamiento.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // =====================================================================
  //  Helpers privados
  // =====================================================================

  /**
   * Busca los 4 cuadrados negros fiduciales en posiciones predecibles.
   *
   * Estrategia mejorada (v2):
   *
   *   1. NO buscamos en el cuadrante completo (eso confundía el QR del
   *      header con la fiducial). Buscamos en una "ventana de
   *      búsqueda" chica alrededor de la posición esperada de cada
   *      fiducial — calculada a partir de las coords del PDF (595x842
   *      pt) escaladas a las dimensiones de la imagen.
   *
   *   2. Filtramos por SOLIDEZ del contorno (área del contorno /
   *      área del rect que lo encierra). El fiducial es un cuadrado
   *      relleno → solidez > 0.85. El QR tiene patrón interno blanco
   *      → solidez < 0.7 cuando se contornea como un todo.
   *
   *   3. Filtramos por área esperada. Para una hoja A4 escalada a
   *      MAX_INPUT_WIDTH_PX (1200), un fiducial de 14pt ocupa
   *      ~28x28 px → área ~700-900. Si no entra en [200..2500],
   *      lo descartamos.
   *
   *   4. Si hay múltiples candidatos en una ventana, elegimos el
   *      MÁS CERCANO a la posición esperada (no el más grande).
   */
  private findFiducials(
    cv: any,
    bin: any,
    width: number,
    height: number
  ): { x: number; y: number; corner: "tl" | "tr" | "bl" | "br" }[] {
    // Posiciones esperadas como FRACCIONES del tamaño de la imagen,
    // sacadas de las constantes compartidas (mismo archivo que usa el
    // PDF para imprimirlas). Si cambia el layout, basta editar
    // omrLayout.const.ts y queda todo sincronizado.
    const expected = {
      tl: {
        x: FIDUCIAL_CENTERS.tl.x / PAGE_W_PT,
        y: FIDUCIAL_CENTERS.tl.y / PAGE_H_PT,
      },
      tr: {
        x: FIDUCIAL_CENTERS.tr.x / PAGE_W_PT,
        y: FIDUCIAL_CENTERS.tr.y / PAGE_H_PT,
      },
      bl: {
        x: FIDUCIAL_CENTERS.bl.x / PAGE_W_PT,
        y: FIDUCIAL_CENTERS.bl.y / PAGE_H_PT,
      },
      br: {
        x: FIDUCIAL_CENTERS.br.x / PAGE_W_PT,
        y: FIDUCIAL_CENTERS.br.y / PAGE_H_PT,
      },
    };
    // Ventana de búsqueda: 14% del ancho/alto centrada en la posición
    // esperada. Suficiente para tolerar rotaciones leves de la foto
    // pero chica como para no incluir el QR ni el cuerpo del examen.
    const WIN_W = 0.14;
    const WIN_H = 0.14;

    const corners: Array<{
      name: "tl" | "tr" | "bl" | "br";
      cx: number;
      cy: number;
    }> = [
      { name: "tl", cx: expected.tl.x * width, cy: expected.tl.y * height },
      { name: "tr", cx: expected.tr.x * width, cy: expected.tr.y * height },
      { name: "bl", cx: expected.bl.x * width, cy: expected.bl.y * height },
      { name: "br", cx: expected.br.x * width, cy: expected.br.y * height },
    ];

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      bin,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Filtro de área PROPORCIONAL al tamaño de la imagen. Un fiducial
    // de FIDUCIAL_SIZE_PT en una página de PDF_PAGE_WIDTH_PT, escalado
    // al ancho de la imagen, debería ocupar más o menos esta área.
    // Aceptamos entre 25% y 4x ese tamaño esperado para tolerar
    // antialiasing, blur y variaciones de escala.
    const expectedFidPx = (FIDUCIAL_SIZE_PT / PDF_PAGE_WIDTH_PT) * width;
    const expectedFidArea = expectedFidPx * expectedFidPx;
    const minFidArea = Math.max(40, expectedFidArea * 0.25);
    const maxFidArea = expectedFidArea * 4;

    // Pre-procesamos todos los contornos en candidates con sus métricas.
    const candidates: Array<{
      cx: number;
      cy: number;
      area: number;
      rect: { x: number; y: number; width: number; height: number };
      solidity: number;
    }> = [];
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const rect = cv.boundingRect(cnt);
      const ratio = rect.width / rect.height;
      if (ratio < 0.6 || ratio > 1.6) {
        cnt.delete();
        continue;
      }
      const rectArea = rect.width * rect.height;
      if (rectArea < minFidArea || rectArea > maxFidArea) {
        cnt.delete();
        continue;
      }
      const contourArea = cv.contourArea(cnt);
      const solidity = contourArea / rectArea;
      // Fiducial relleno: solidez > 0.80 (aflojamos un poco para
      // tolerar antialiasing en imágenes de baja resolución).
      // QR finder patterns: solidez < 0.7.
      if (solidity < 0.8) {
        cnt.delete();
        continue;
      }
      candidates.push({
        cx: rect.x + rect.width / 2,
        cy: rect.y + rect.height / 2,
        area: rectArea,
        rect,
        solidity,
      });
      cnt.delete();
    }

    console.log(
      `[OMR fid] candidatos tras filtros: ${candidates.length} | área esperada ${Math.round(expectedFidArea)}px² (rango ${Math.round(minFidArea)}-${Math.round(maxFidArea)})`
    );

    const found: any[] = [];
    const winHalfX = (width * WIN_W) / 2;
    const winHalfY = (height * WIN_H) / 2;
    for (const c of corners) {
      let best: { x: number; y: number; dist: number } | null = null;
      for (const cand of candidates) {
        // ¿Está dentro de la ventana de búsqueda?
        if (Math.abs(cand.cx - c.cx) > winHalfX) continue;
        if (Math.abs(cand.cy - c.cy) > winHalfY) continue;
        const dx = cand.cx - c.cx;
        const dy = cand.cy - c.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!best || dist < best.dist) {
          best = { x: cand.cx, y: cand.cy, dist };
        }
      }
      if (best) {
        found.push({ x: best.x, y: best.y, corner: c.name });
      }
    }
    contours.delete();
    hierarchy.delete();
    return found;
  }

  /**
   * Warp perspectivo de la imagen original a las dimensiones canónicas
   * usando los 4 fiduciales como esquinas conocidas.
   */
  private warpToCanonical(
    cv: any,
    src: any,
    fiducials: Array<{ x: number; y: number; corner: string }>
  ): any {
    const map = new Map(fiducials.map((f) => [f.corner, f]));
    const tl = map.get("tl")!;
    const tr = map.get("tr")!;
    const bl = map.get("bl")!;
    const br = map.get("br")!;

    const srcMat = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      [tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y]
    );
    const dstMat = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      [
        FIDUCIAL_TARGETS.tl.x,
        FIDUCIAL_TARGETS.tl.y,
        FIDUCIAL_TARGETS.tr.x,
        FIDUCIAL_TARGETS.tr.y,
        FIDUCIAL_TARGETS.bl.x,
        FIDUCIAL_TARGETS.bl.y,
        FIDUCIAL_TARGETS.br.x,
        FIDUCIAL_TARGETS.br.y,
      ]
    );
    const M = cv.getPerspectiveTransform(srcMat, dstMat);
    const dst = new cv.Mat();
    const dsize = new cv.Size(CANONICAL_W, CANONICAL_H);
    cv.warpPerspective(
      src,
      dst,
      M,
      dsize,
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );
    srcMat.delete();
    dstMat.delete();
    M.delete();
    return dst;
  }

  /**
   * Muestrea la intensidad promedio en una región circular del centro
   * de una burbuja. Devuelve 0..255 (0=negro puro / lleno).
   */
  private measureFill(
    cv: any,
    grayMat: any,
    x: number,
    y: number,
    radius: number
  ): number {
    const xi = Math.round(x);
    const yi = Math.round(y);
    const r = Math.max(1, Math.round(radius));
    const x0 = Math.max(0, xi - r);
    const y0 = Math.max(0, yi - r);
    const w = Math.min(grayMat.cols - x0, 2 * r);
    const h = Math.min(grayMat.rows - y0, 2 * r);
    if (w <= 0 || h <= 0) return 255;
    const roi = grayMat.roi(new cv.Rect(x0, y0, w, h));
    const mean = cv.mean(roi);
    roi.delete();
    return mean[0];
  }

  /**
   * Renderiza el canónico con overlay de las burbujas MUESTREADAS.
   * Pinta:
   *   - Naranja: cada burbuja sampleada (sin marcar).
   *   - Verde:   la burbuja inferida como marcada.
   *   - Rojo:    multi-marca (ambigua).
   * Sirve para que el profe vea visualmente qué interpretó el motor.
   */
  private renderDeterministicPreview(
    cv: any,
    warped: any,
    sampled: Array<{
      questionIdx: number;
      letterIdx: number;
      x: number;
      y: number;
      fill: number;
    }>,
    answers: DetectedAnswer[],
    letters: string[],
    totalQuestions: number,
    sampleRadius: number
  ): string {
    const out = new cv.Mat();
    warped.copyTo(out);
    for (const b of sampled) {
      const letter = letters[b.letterIdx];
      const ans = answers[b.questionIdx];
      let color: any;
      let thickness: number;
      if (ans === letter) {
        color = new cv.Scalar(0, 200, 0, 255); // verde
        thickness = 3;
      } else if (ans === "MULTI") {
        color = new cv.Scalar(0, 0, 220, 255); // rojo (BGR)
        thickness = 2;
      } else {
        color = new cv.Scalar(0, 140, 255, 255); // naranja
        thickness = 1;
      }
      cv.circle(
        out,
        new cv.Point(Math.round(b.x), Math.round(b.y)),
        sampleRadius + 1,
        color,
        thickness
      );
    }
    const canvas = document.createElement("canvas");
    cv.imshow(canvas, out);
    out.delete();
    return canvas.toDataURL("image/png");
  }
}
