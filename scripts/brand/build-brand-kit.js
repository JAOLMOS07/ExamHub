/**
 * Genera el kit de marca de ExamHub en docs/brand/ y los íconos de la app.
 *
 *   cd scripts/brand && npm install && node build-brand-kit.js
 *
 * - Logos SVG con el texto convertido a curvas (no dependen de fuentes)
 *   y PNG en varios tamaños.
 * - Plantillas de redes en SVG EDITABLE (texto vivo en Sora / Atkinson
 *   Hyperlegible, ambas gratis en Google Fonts) + vista previa PNG.
 * - Tarjetas de presentación en milímetros con 3 mm de rebase.
 * - Paleta en JSON, CSS y GPL (Inkscape/GIMP).
 * - Íconos PWA y favicon en src/.
 */
const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const { Resvg } = require("@resvg/resvg-js");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "docs", "brand");
const ICONS = path.join(ROOT, "src", "assets", "icons");

const C = {
  tinta: "#16205A",
  lapiz: "#FFC531",
  papel: "#F6F3EA",
  grafito: "#1C1E26",
  aprobado: "#1F8A5B",
  borrador: "#F2789F",
  blanco: "#FFFFFF",
};

const fontFile = (pkg, file) =>
  path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), "files", file);
const F = {
  sora700: opentype.loadSync(fontFile("sora", "sora-latin-700-normal.woff")),
  sora600: opentype.loadSync(fontFile("sora", "sora-latin-600-normal.woff")),
  atk400: opentype.loadSync(fontFile("atkinson-hyperlegible", "atkinson-hyperlegible-latin-400-normal.woff")),
  atk700: opentype.loadSync(fontFile("atkinson-hyperlegible", "atkinson-hyperlegible-latin-700-normal.woff")),
};
const FAMILY = new Map([
  [F.sora700, ["Sora", 700]],
  [F.sora600, ["Sora", 600]],
  [F.atk400, ["Atkinson Hyperlegible", 400]],
  [F.atk700, ["Atkinson Hyperlegible", 700]],
]);

// ---------------------------------------------------------------------
//  Texto: medir, convertir a curvas o dejar editable
// ---------------------------------------------------------------------

/** Ancho y caja de un texto con interletrado (em, ej. -0.045). */
function measure(font, text, size, tracking = 0) {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  let x = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  glyphs.forEach((g, i) => {
    const bb = g.getBoundingBox();
    if (bb.y2 > bb.y1 || bb.x2 > bb.x1) {
      minY = Math.min(minY, -bb.y2 * scale);
      maxY = Math.max(maxY, -bb.y1 * scale);
    }
    x += g.advanceWidth * scale;
    if (i < glyphs.length - 1) {
      x += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
    }
  });
  return { width: x, top: minY === Infinity ? 0 : minY, bottom: maxY === -Infinity ? 0 : maxY };
}

/** Texto como curvas, con la línea base en (x, y). */
function textPath(font, text, x, y, size, fill, tracking = 0) {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  let cx = x;
  let d = "";
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * scale;
    if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
  });
  return `<path d="${d}" fill="${fill}"/>`;
}

/** Texto editable (necesita la fuente instalada para verse igual). */
function textLive(font, text, x, y, size, fill, tracking = 0, anchor = "start") {
  const [family, weight] = FAMILY.get(font);
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<text x="${x}" y="${y}" font-family="${family}, sans-serif" font-weight="${weight}" font-size="${size}" letter-spacing="${(tracking * size).toFixed(2)}" fill="${fill}" text-anchor="${anchor}">${esc}</text>`;
}

/** Un texto que se escribe editable o en curvas según el modo. */
function T(mode, font, text, x, y, size, fill, tracking = 0, anchor = "start") {
  if (mode === "live") return textLive(font, text, x, y, size, fill, tracking, anchor);
  const dx = anchor === "end" ? measure(font, text, size, tracking).width : 0;
  return textPath(font, text, x - dx, y, size, fill, tracking);
}

// ---------------------------------------------------------------------
//  Símbolo: el check de burbujas (lienzo 120 × 120)
// ---------------------------------------------------------------------

const OUTLINES = [[24, 36], [48, 36], [72, 36], [48, 60], [96, 60], [24, 84], [72, 84], [96, 84]];
const CHECK = "24,60 48,84 72,60 96,36";
let maskSeq = 0;

function mark(variant = "positive", { x = 0, y = 0, size = 120, tile = null, ink = null } = {}) {
  const s = size / 120;
  const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
  const full = (bg, fg, outlineOpacity) =>
    g(
      `<rect width="120" height="120" rx="30" fill="${bg}"/>` +
        `<g fill="none" stroke="${fg}" stroke-opacity="${outlineOpacity}" stroke-width="2">${OUTLINES.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="7"/>`).join("")}</g>` +
        `<polyline points="${CHECK}" fill="none" stroke="${fg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="${fg}"><circle cx="24" cy="60" r="8.5"/><circle cx="48" cy="84" r="8.5"/><circle cx="72" cy="60" r="8.5"/></g>` +
        `<circle cx="96" cy="36" r="9.5" fill="${C.lapiz}" stroke="${bg}" stroke-width="3"/>`
    );
  const simple = (bg, fg) =>
    g(
      `<rect width="120" height="120" rx="30" fill="${bg}"/>` +
        `<polyline points="${CHECK}" fill="none" stroke="${fg}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<circle cx="96" cy="36" r="14" fill="${C.lapiz}"/>`
    );
  switch (variant) {
    case "positive":
      return full(tile ?? C.tinta, ink ?? C.papel, 0.28);
    case "negative":
      return full(tile ?? C.papel, ink ?? C.tinta, 0.22);
    case "simple":
      return simple(tile ?? C.tinta, ink ?? C.papel);
    case "simple-negative":
      return simple(tile ?? C.papel, ink ?? C.tinta);
    case "mono": {
      // Una sola tinta: el check se calca (transparente) dentro de la baldosa.
      const id = `eh-knock-${++maskSeq}`;
      return g(
        `<mask id="${id}"><rect width="120" height="120" rx="30" fill="#fff"/>` +
          `<polyline points="${CHECK}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<g fill="#000"><circle cx="24" cy="60" r="9"/><circle cx="48" cy="84" r="9"/><circle cx="72" cy="60" r="9"/><circle cx="96" cy="36" r="10"/></g></mask>` +
          `<rect width="120" height="120" rx="30" fill="${ink}" mask="url(#${id})"/>`
      );
    }
  }
  throw new Error(variant);
}

// ---------------------------------------------------------------------
//  Logos
// ---------------------------------------------------------------------

const WORD = "examhub";
const TRACK = -0.045;

function svgDoc(w, h, body, bg = null, extra = "") {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${extra}>` +
    (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "") +
    body +
    `</svg>\n`
  );
}

/** Logo horizontal: símbolo de alto H, texto centrado en su eje. */
function horizontal(variant, H = 120, pad = 24) {
  const size = H * 0.81;
  const gap = H * 0.22;
  const m = measure(F.sora700, WORD, size, TRACK);
  const textH = m.bottom - m.top;
  const w = pad * 2 + H + gap + m.width;
  const h = pad * 2 + H;
  const baseline = pad + H / 2 - textH / 2 - m.top;
  const word = variant.word;
  return svgDoc(
    Math.ceil(w),
    Math.ceil(h),
    mark(variant.mark, { x: pad, y: pad, size: H, ink: variant.ink }) + textPath(F.sora700, WORD, pad + H + gap, baseline, size, word, TRACK)
  );
}

/** Logo apilado: símbolo arriba, texto centrado abajo. */
function stacked(variant, H = 120, pad = 24) {
  const size = H * 0.55;
  const gap = H * 0.16;
  const m = measure(F.sora700, WORD, size, TRACK);
  const w = Math.max(H, m.width) + pad * 2;
  const h = pad * 2 + H + gap + (m.bottom - m.top);
  return svgDoc(
    Math.ceil(w),
    Math.ceil(h),
    mark(variant.mark, { x: (w - H) / 2, y: pad, size: H, ink: variant.ink }) +
      textPath(F.sora700, WORD, (w - m.width) / 2, pad + H + gap - m.top, size, variant.word, TRACK)
  );
}

const VARIANTS = {
  "": { mark: "positive", word: C.tinta },
  "-negativo": { mark: "negative", word: C.papel },
  "-negro": { mark: "mono", ink: C.grafito, word: C.grafito },
  "-blanco": { mark: "mono", ink: C.blanco, word: C.blanco },
};

function writeFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function png(svg, width, file, background) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, background, font: { loadSystemFonts: false } });
  writeFile(file, r.render().asPng());
}

function buildLogos() {
  const dir = path.join(OUT, "logo");
  for (const [suffix, v] of Object.entries(VARIANTS)) {
    const h = horizontal(v);
    const s = stacked(v);
    writeFile(path.join(dir, `examhub-horizontal${suffix}.svg`), h);
    writeFile(path.join(dir, `examhub-apilado${suffix}.svg`), s);
    png(h, 2000, path.join(dir, "png", `examhub-horizontal${suffix}.png`));
    png(s, 1000, path.join(dir, "png", `examhub-apilado${suffix}.png`));
  }
  const symbols = {
    "simbolo": "positive",
    "simbolo-negativo": "negative",
    "simbolo-simple": "simple",
    "simbolo-simple-negativo": "simple-negative",
  };
  for (const [name, variant] of Object.entries(symbols)) {
    const svg = svgDoc(120, 120, mark(variant));
    writeFile(path.join(dir, `examhub-${name}.svg`), svg);
    for (const w of [1024, 512, 256]) png(svg, w, path.join(dir, "png", `examhub-${name}-${w}.png`));
  }
  writeFile(path.join(dir, "examhub-simbolo-negro.svg"), svgDoc(120, 120, mark("mono", { ink: C.grafito })));
  writeFile(path.join(dir, "examhub-simbolo-blanco.svg"), svgDoc(120, 120, mark("mono", { ink: C.blanco })));
}

// ---------------------------------------------------------------------
//  Íconos de la app (PWA) y favicon
// ---------------------------------------------------------------------

function iconSvg(size, { bleed, content, variant = "positive" }) {
  // bleed: fondo Tinta a sangre (maskable / Apple); si no, baldosa redondeada.
  const inner = size * content;
  const off = (size - inner) / 2;
  const tileOnly = mark(variant, { x: off, y: off, size: inner });
  return svgDoc(size, size, bleed ? `<rect width="${size}" height="${size}" fill="${C.tinta}"/>${tileOnly}` : tileOnly);
}

function icoFromPng(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

function buildAppIcons() {
  const render = (svg, w) => new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
  for (const s of [192, 512]) {
    writeFile(path.join(ICONS, `icon-${s}.png`), render(iconSvg(120, { bleed: false, content: 1 }), s));
    // Zona segura de Android: el símbolo cabe en el 66 % central.
    writeFile(path.join(ICONS, `maskable-${s}.png`), render(iconSvg(120, { bleed: true, content: 0.86 }), s));
  }
  writeFile(path.join(ICONS, "apple-touch-icon.png"), render(iconSvg(120, { bleed: true, content: 0.96 }), 180));
  const fav32 = render(svgDoc(120, 120, mark("simple")), 32);
  writeFile(path.join(ICONS, "favicon-32.png"), fav32);
  writeFile(path.join(ROOT, "src", "favicon.ico"), icoFromPng(render(svgDoc(120, 120, mark("simple")), 48), 48));
  writeFile(path.join(OUT, "app", "icono-app-1024.png"), render(iconSvg(120, { bleed: true, content: 0.86 }), 1024));
}

// ---------------------------------------------------------------------
//  Plantillas de redes (editables) + vista previa
// ---------------------------------------------------------------------

/** Logo horizontal pequeño en curvas dentro de una plantilla. */
function inlineLogo(x, y, H, variant = "negative", word = C.papel) {
  const size = H * 0.81;
  const gap = H * 0.22;
  const m = measure(F.sora700, WORD, size, TRACK);
  const baseline = y + H / 2 - (m.bottom - m.top) / 2 - m.top;
  return {
    svg: mark(variant, { x, y, size: H }) + textPath(F.sora700, WORD, x + H + gap, baseline, size, word, TRACK),
    width: H + gap + m.width,
  };
}

function bubbleRow(x, y, n, d, gap, filled, stroke, fill) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const cx = x + d / 2 + i * (d + gap);
    out += filled.includes(i)
      ? `<circle cx="${cx}" cy="${y + d / 2}" r="${d / 2}" fill="${fill}"/>`
      : `<circle cx="${cx}" cy="${y + d / 2}" r="${d / 2 - 2}" fill="none" stroke="${stroke}" stroke-width="4"/>`;
  }
  return out;
}

const TEMPLATES = {
  "post-cuadrado-cifra": {
    w: 1080,
    h: 1080,
    draw: (mode) => {
      const logo = inlineLogo(0, 0, 60);
      return (
        `<rect width="1080" height="1080" fill="${C.tinta}"/>` +
        bubbleRow(90, 90, 5, 66, 28, [1], "rgba(246,243,234,0.3)", C.lapiz) +
        T(mode, F.sora700, "40 hojas.", 90, 560, 168, C.papel, -0.04) +
        T(mode, F.sora700, "10 minutos.", 90, 725, 168, C.papel, -0.04) +
        T(mode, F.sora700, "1 celular.", 90, 890, 168, C.lapiz, -0.04) +
        T(mode, F.atk400, "Simulacros tipo Saber 11", 90, 1000, 38, "rgba(246,243,234,0.85)") +
        `<g transform="translate(${990 - logo.width} 952)">${logo.svg}</g>`
      );
    },
  },
  "post-cuadrado-tip": {
    w: 1080,
    h: 1080,
    draw: (mode) => {
      const logo = inlineLogo(0, 0, 56, "positive", C.tinta);
      return (
        `<rect width="1080" height="1080" fill="${C.papel}"/>` +
        T(mode, F.sora700, "TIP PARA DOCENTES", 90, 140, 30, C.tinta, 0.16) +
        T(mode, F.sora700, "Una pregunta mal", 90, 330, 92, C.grafito, -0.035) +
        T(mode, F.sora700, "redactada también", 90, 440, 92, C.grafito, -0.035) +
        T(mode, F.sora700, "se ve en los datos.", 90, 550, 92, C.tinta, -0.035) +
        `<rect x="90" y="630" width="900" height="250" rx="28" fill="#FFFFFF"/>` +
        T(mode, F.atk700, "Si los mejores estudiantes la fallan", 130, 710, 38, C.grafito) +
        T(mode, F.atk700, "más que los demás, revisa la clave.", 130, 762, 38, C.grafito) +
        T(mode, F.atk400, "ExamHub te avisa: “discriminación negativa”.", 130, 832, 32, "#5A5D69") +
        `<g transform="translate(90 960)">${logo.svg}</g>`
      );
    },
  },
  "historia-dato": {
    w: 1080,
    h: 1920,
    draw: (mode) => {
      const logo = inlineLogo(0, 0, 64, "positive", C.tinta);
      const bar = (y, label, pct, color) =>
        T(mode, F.atk700, label, 150, y, 44, C.papel) +
        T(mode, F.sora700, `${pct} %`, 930, y, 44, C.papel, 0, "end") +
        `<rect x="150" y="${y + 28}" width="780" height="26" rx="13" fill="rgba(246,243,234,0.2)"/>` +
        `<rect x="150" y="${y + 28}" width="${(780 * pct) / 100}" height="26" rx="13" fill="${color}"/>`;
      return (
        `<rect width="1080" height="1920" fill="${C.lapiz}"/>` +
        T(mode, F.sora700, "TIP PARA DOCENTES", 90, 220, 36, C.tinta, 0.16) +
        T(mode, F.sora700, "¿Cuál competencia", 90, 520, 92, C.tinta, -0.035) +
        T(mode, F.sora700, "le cuesta más", 90, 630, 92, C.tinta, -0.035) +
        T(mode, F.sora700, "a tu grado 11?", 90, 740, 92, C.tinta, -0.035) +
        `<rect x="90" y="900" width="900" height="420" rx="40" fill="${C.tinta}"/>` +
        bar(1010, "Argumentación", 33, C.borrador) +
        bar(1150, "Formulación", 62, C.lapiz) +
        T(mode, F.atk400, "Datos de ejemplo", 150, 1270, 30, "rgba(246,243,234,0.7)") +
        T(mode, F.atk700, "Descúbrelo en tu próximo simulacro.", 90, 1500, 44, C.tinta) +
        `<g transform="translate(90 1700)">${logo.svg}</g>`
      );
    },
  },
  "portada-video-tiktok-reels": {
    w: 1080,
    h: 1920,
    draw: (mode) => {
      const logo = inlineLogo(0, 0, 70);
      return (
        `<rect width="1080" height="1920" fill="${C.tinta}"/>` +
        bubbleRow(90, 260, 6, 110, 40, [2], "rgba(246,243,234,0.28)", C.lapiz) +
        bubbleRow(90, 410, 6, 110, 40, [4], "rgba(246,243,234,0.28)", C.papel) +
        T(mode, F.sora700, "Califiqué 40", 90, 820, 132, C.papel, -0.04) +
        T(mode, F.sora700, "simulacros en", 90, 970, 132, C.papel, -0.04) +
        T(mode, F.sora700, "10 minutos", 90, 1120, 132, C.lapiz, -0.04) +
        T(mode, F.atk700, "(con el celular)", 90, 1230, 56, "rgba(246,243,234,0.85)") +
        `<g transform="translate(90 1660)">${logo.svg}</g>`
      );
    },
  },
  "portada-linkedin": {
    w: 1584,
    h: 396,
    draw: (mode) => {
      const m = mark("negative", { x: 520, y: 118, size: 120 });
      return (
        `<rect width="1584" height="396" fill="${C.tinta}"/>` +
        bubbleRow(1180, 40, 6, 40, 18, [3], "rgba(246,243,234,0.2)", C.lapiz) +
        m +
        T(mode, F.sora700, "Simulacros tipo Saber 11,", 680, 175, 50, C.papel, -0.02) +
        T(mode, F.sora700, "calificados con el celular.", 680, 238, 50, C.papel, -0.02) +
        `<rect x="680" y="270" width="380" height="60" rx="30" fill="${C.lapiz}"/>` +
        T(mode, F.sora700, "Pide tu simulacro gratis", 708, 310, 26, C.tinta)
      );
    },
  },
  "portada-facebook": {
    w: 1640,
    h: 624,
    draw: (mode) => {
      const logo = inlineLogo(0, 0, 110);
      return (
        `<rect width="1640" height="624" fill="${C.tinta}"/>` +
        bubbleRow(1150, 70, 5, 70, 26, [1], "rgba(246,243,234,0.22)", C.lapiz) +
        `<g transform="translate(120 150)">${logo.svg}</g>` +
        T(mode, F.sora600, "Del lápiz al resultado, en segundos.", 120, 380, 54, C.lapiz, -0.02) +
        T(mode, F.atk400, "Simulacros Saber 11 en papel · calificación con el celular · reportes por competencia", 120, 450, 30, "rgba(246,243,234,0.8)")
      );
    },
  },
  "foto-perfil": {
    w: 1080,
    h: 1080,
    draw: () => `<rect width="1080" height="1080" fill="${C.lapiz}"/>` + mark("positive", { x: 290, y: 290, size: 500 }),
  },
};

function buildTemplates() {
  const dir = path.join(OUT, "redes");
  for (const [name, t] of Object.entries(TEMPLATES)) {
    writeFile(path.join(dir, "editables", `${name}.svg`), svgDoc(t.w, t.h, t.draw("live")));
    png(svgDoc(t.w, t.h, t.draw("path")), t.w, path.join(dir, `${name}.png`));
  }
}

// ---------------------------------------------------------------------
//  Tarjetas de presentación (85 × 55 mm + 3 mm de rebase)
// ---------------------------------------------------------------------

function buildCards() {
  const dir = path.join(OUT, "tarjetas");
  const W = 910; // 91 mm × 10
  const H = 610;
  const B = 30; // rebase 3 mm
  const mm = (body, mode) =>
    svgDoc(W, H, body(mode), null, ` width="91mm" height="61mm"`).replace(` width="${W}" height="${H}"`, "");

  const front = (mode) => {
    const logo = inlineLogo(0, 0, 120);
    let grid = "";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        const filled = r === 0 && c === 4;
        const cx = W - 320 + c * 62;
        const cy = H - 120 + r * 62;
        grid += filled
          ? `<circle cx="${cx}" cy="${cy}" r="22" fill="${C.lapiz}"/>`
          : `<circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="rgba(246,243,234,0.18)" stroke-width="2.5"/>`;
      }
    }
    return (
      `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
      grid +
      `<g transform="translate(${(W - logo.width) / 2} ${H / 2 - 75})">${logo.svg}</g>` +
      T(mode, F.sora600, "Del lápiz al resultado, en segundos.", B + 45, H - B - 45, 22, C.lapiz)
    );
  };
  const back = (mode) =>
    `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
    `<rect y="${H - B - 14}" width="${W}" height="${B + 14}" fill="${C.lapiz}"/>` +
    T(mode, F.sora700, "Jhoger Olmos", B + 60, B + 110, 50, C.tinta, -0.03) +
    T(mode, F.atk400, "Fundador · ExamHub", B + 60, B + 152, 25, "#5A5D69") +
    mark("simple", { x: W - B - 60 - 58, y: B + 60, size: 58 }) +
    `<circle cx="${B + 70}" cy="${B + 300}" r="9" fill="${C.lapiz}" stroke="${C.tinta}" stroke-width="2.5"/>` +
    T(mode, F.atk400, "[correo]", B + 92, B + 309, 24, C.grafito) +
    `<circle cx="${B + 70}" cy="${B + 348}" r="9" fill="none" stroke="${C.tinta}" stroke-width="2.5"/>` +
    T(mode, F.atk400, "[WhatsApp]", B + 92, B + 357, 24, C.grafito) +
    `<circle cx="${B + 70}" cy="${B + 396}" r="9" fill="none" stroke="${C.tinta}" stroke-width="2.5"/>` +
    T(mode, F.atk400, "[sitio web]", B + 92, B + 405, 24, C.grafito) +
    `<rect x="${W - B - 60 - 150}" y="${B + 270}" width="150" height="150" rx="10" fill="none" stroke="${C.tinta}" stroke-width="2.5" stroke-dasharray="8 6"/>` +
    T(mode, F.atk700, "QR", W - B - 60 - 95, B + 355, 28, C.tinta);
  const ambassador = (mode) =>
    `<rect width="${W}" height="${H}" fill="${C.lapiz}"/>` +
    T(mode, F.sora700, "DOCENTE EMBAJADOR", B + 60, B + 90, 20, C.tinta, 0.16) +
    T(mode, F.sora700, "Califico mis simulacros", B + 60, B + 250, 44, C.tinta, -0.03) +
    T(mode, F.sora700, "con el celular.", B + 60, B + 305, 44, C.tinta, -0.03) +
    T(mode, F.atk400, "[Nombre del docente] · [Colegio]", B + 60, H - B - 70, 24, C.tinta) +
    textPath(F.sora700, WORD, W - B - 60 - measure(F.sora700, WORD, 34, TRACK).width, H - B - 70, 34, C.tinta, TRACK);

  for (const [name, fn] of Object.entries({ "tarjeta-frente": front, "tarjeta-reverso": back, "tarjeta-embajador": ambassador })) {
    writeFile(path.join(dir, "editables", `${name}.svg`), mm(fn, "live"));
    png(svgDoc(W, H, fn("path")), 1820, path.join(dir, `${name}.png`));
  }
}

// ---------------------------------------------------------------------
//  Paleta
// ---------------------------------------------------------------------

function buildPalette() {
  const dir = path.join(OUT, "color");
  const named = {
    Tinta: C.tinta,
    "Lápiz": C.lapiz,
    Papel: C.papel,
    Grafito: C.grafito,
    Aprobado: C.aprobado,
    Borrador: C.borrador,
  };
  writeFile(
    path.join(dir, "tokens.json"),
    JSON.stringify(
      {
        color: Object.fromEntries(Object.entries(named).map(([k, v]) => [k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), v])),
        font: { display: "Sora", body: "Atkinson Hyperlegible", mono: "JetBrains Mono" },
      },
      null,
      2
    ) + "\n"
  );
  writeFile(
    path.join(dir, "paleta.css"),
    ":root {\n" +
      Object.entries(named)
        .map(([k, v]) => `  --eh-${k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}: ${v};`)
        .join("\n") +
      "\n}\n"
  );
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  writeFile(
    path.join(dir, "examhub.gpl"),
    "GIMP Palette\nName: ExamHub\nColumns: 6\n#\n" +
      Object.entries(named)
        .map(([k, v]) => `${rgb(v).map((n) => String(n).padStart(3)).join(" ")}\t${k}`)
        .join("\n") +
      "\n"
  );
  // Muestra visual de la paleta.
  let x = 0;
  const sw = Object.entries(named)
    .map(([k, v]) => {
      const dark = [C.tinta, C.grafito, C.aprobado].includes(v);
      const s =
        `<rect x="${x}" width="300" height="300" fill="${v}"/>` +
        textPath(F.sora700, k, x + 24, 230, 34, dark ? C.papel : C.tinta) +
        textPath(F.atk400, v, x + 24, 270, 24, dark ? C.papel : C.tinta);
      x += 300;
      return s;
    })
    .join("");
  png(svgDoc(1800, 300, sw), 1800, path.join(dir, "paleta.png"));
}

module.exports = { C, F, T, measure, textPath, mark, svgDoc, png, writeFile, inlineLogo, bubbleRow, WORD, TRACK, ROOT };

if (require.main === module) {
  buildLogos();
  buildAppIcons();
  buildTemplates();
  buildCards();
  buildPalette();
  console.log("Kit de marca generado en docs/brand/");
}
