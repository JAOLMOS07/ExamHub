/**
 * Piezas para arrancar en redes: perfiles, portadas con la medida de cada
 * red, serie de lanzamiento (9 publicaciones 4:5), 2 carruseles,
 * historias, portadas de destacadas e imagen para compartir enlaces.
 *
 *   cd scripts/brand && npm install && node build-social.js
 *
 * Salida: docs/marketing/redes/ (PNG para subir) y
 * docs/marketing/redes/editables/ (SVG con texto editable en Figma).
 */
const fs = require("fs");
const path = require("path");
const K = require("./build-brand-kit.js");
const { C, F, measure, mark, svgDoc, png, writeFile, inlineLogo, bubbleRow } = K;

const OUT = path.join(K.ROOT, "docs", "marketing", "redes");
const TEST = {
  lectura_critica: "#8B5CF6",
  matematicas: "#3B82F6",
  sociales: "#F97316",
  ciencias: "#10B981",
  ingles: "#F43F5E",
};

// ---------------------------------------------------------------------
//  Texto con saltos de línea automáticos
// ---------------------------------------------------------------------

function wrap(font, text, size, maxW, tracking = 0) {
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (line && measure(font, test, size, tracking).width > maxW) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

/** Párrafo: devuelve el SVG y la y de la última línea. */
function P(mode, font, text, x, y, size, fill, { maxW = 900, lh = 1.2, tracking = 0, anchor = "start" } = {}) {
  const lines = wrap(font, text, size, maxW, tracking);
  let svg = "";
  lines.forEach((l, i) => (svg += K.T(mode, font, l, x, y + i * size * lh, size, fill, tracking, anchor)));
  return { svg, bottom: y + (lines.length - 1) * size * lh };
}

const pill = (mode, text, x, y, size, bg, fg) => {
  const w = measure(F.sora700, text, size).width + size * 1.6;
  const h = size * 2.2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/>` + K.T(mode, F.sora700, text, x + size * 0.8, y + h * 0.66, size, fg);
};

const label = (mode, text, x, y, color, size = 28) => K.T(mode, F.sora700, text.toUpperCase(), x, y, size, color, 0.16);

function logoAt(x, y, H, onDark = true) {
  const l = inlineLogo(0, 0, H, onDark ? "negative" : "positive", onDark ? C.papel : C.tinta);
  return { svg: `<g transform="translate(${x} ${y})">${l.svg}</g>`, width: l.width };
}

/** Pie común: logo abajo a la izquierda y, si hay, contador de lámina. */
function footer(w, h, onDark, counter, dot = C.lapiz) {
  const logo = logoAt(80, h - 130, 56, onDark);
  let svg = logo.svg;
  if (counter) {
    const [i, n] = counter;
    const d = 22;
    const gap = 12;
    const total = n * d + (n - 1) * gap;
    svg += bubbleRow(w - 80 - total, h - 113, n, d, gap, [i - 1], onDark ? "rgba(246,243,234,0.35)" : "rgba(22,32,90,0.3)", dot);
  }
  return svg;
}

/** "Desliza" con flecha dibujada (Sora no trae el carácter →). */
const swipe = (mode, w, y, color) =>
  K.T(mode, F.sora700, "Desliza", w - 136, y, 32, color, 0, "end") +
  `<path d="M${w - 122} ${y - 11}h38M${w - 98} ${y - 24}l14 13-14 13" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

// Pequeños íconos de línea (trazo redondo).
const icon = {
  print: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V6h24v12"/><rect x="5" y="18" width="38" height="16" rx="4"/><path d="M12 28h24v14H12z"/></g>`,
  phone: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="3" width="24" height="42" rx="5"/><path d="M20 38h8"/><rect x="18" y="12" width="12" height="12" rx="1.5"/></g>`,
  chart: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 42h36"/><path d="M12 36V24M22 36V12M32 36V28M40 36V18"/></g>`,
  bank: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="36" height="32" rx="4"/><path d="M14 18h20M14 26h20M14 34h12"/></g>`,
  play: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="19"/><path d="M20 16l12 8-12 8z" fill="${c}"/></g>`,
  bulb: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 32c-4-3-7-7-7-12a14 14 0 0 1 28 0c0 5-3 9-7 12v4H17z"/><path d="M19 42h10"/></g>`,
  school: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18L24 8l20 10-20 10z"/><path d="M12 22v10c0 4 6 7 12 7s12-3 12-7V22"/><path d="M44 18v12"/></g>`,
  tag: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 24V8a2 2 0 0 1 2-2h16l18 18-18 18z"/><circle cx="15" cy="15" r="3"/></g>`,
  chat: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h32a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H20l-9 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z"/><path d="M15 21h18M15 27h12"/></g>`,
  wifiOff: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s / 48})" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18a30 30 0 0 1 40 0M10 25a21 21 0 0 1 28 0M16 32a12 12 0 0 1 16 0"/><circle cx="24" cy="39" r="2" fill="${c}"/><path d="M8 6l32 36"/></g>`,
};

// ---------------------------------------------------------------------
//  Serie de lanzamiento: 9 publicaciones 1080 × 1350
// ---------------------------------------------------------------------

const W = 1080;
const H = 1350;

const FEED = {
  "01-hola-profe": (m) =>
    `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
    mark("negative", { x: 80, y: 120, size: 300 }) +
    K.T(m, F.sora700, "Hola, profe.", 80, 620, 128, C.papel, -0.04) +
    P(m, F.atk400, "Somos ExamHub: simulacros tipo Saber 11 en papel, calificados con el celular en segundos.", 80, 720, 48, "rgba(246,243,234,0.88)", { maxW: 900, lh: 1.3 }).svg +
    bubbleRow(80, 1000, 8, 56, 22, [5], "rgba(246,243,234,0.25)", C.lapiz) +
    footer(W, H, true),

  "02-cuarenta-hojas": (m) =>
    `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
    bubbleRow(80, 110, 5, 66, 28, [1], "rgba(246,243,234,0.3)", C.lapiz) +
    K.T(m, F.sora700, "40 hojas.", 80, 640, 168, C.papel, -0.04) +
    K.T(m, F.sora700, "10 minutos.", 80, 810, 168, C.papel, -0.04) +
    K.T(m, F.sora700, "1 celular.", 80, 980, 168, C.lapiz, -0.04) +
    K.T(m, F.atk400, "Así se califica un simulacro con ExamHub.", 80, 1090, 40, "rgba(246,243,234,0.85)") +
    footer(W, H, true),

  "03-asi-funciona": (m) => {
    const step = (y, n, title, desc, ic) =>
      `<rect x="80" y="${y}" width="920" height="230" rx="36" fill="#FFFFFF"/>` +
      `<circle cx="170" cy="${y + 115}" r="54" fill="${C.lapiz}"/>` +
      K.T(m, F.sora700, String(n), 170, y + 137, 60, C.tinta, 0, "end").replace(/<path/, "<path") +
      ic(860, y + 70, 90, C.tinta) +
      K.T(m, F.sora700, title, 260, y + 100, 52, C.tinta, -0.03) +
      P(m, F.atk400, desc, 260, y + 155, 32, "#3A3D49", { maxW: 560, lh: 1.25 }).svg;
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      label(m, "Así funciona", 80, 150, C.tinta) +
      K.T(m, F.sora700, "Tres pasos.", 80, 270, 104, C.tinta, -0.04) +
      step(340, 1, "Imprime", "Cuadernillos y hojas con el nombre de cada estudiante.", icon.print) +
      step(600, 2, "Escanea", "Una foto con el celular y la nota sale al instante.", icon.phone) +
      step(860, 3, "Mejora", "Informes por competencia para cada estudiante y grupo.", icon.chart) +
      footer(W, H, false)
    );
  },

  "04-hoja-con-nombre": (m) => {
    let qr = "";
    const cells = [
      "1111111011", "1000001010", "1011101001", "1011101110", "1011101010",
      "1000001001", "1111111011", "0000000010", "1101011101", "0110110011",
    ];
    cells.forEach((row, r) =>
      [...row].forEach((v, c) => {
        if (v === "1") qr += `<rect x="${760 + c * 14}" y="${470 + r * 14}" width="14" height="14" fill="${C.grafito}"/>`;
      })
    );
    let bubbles = "";
    for (let r = 0; r < 3; r++) {
      bubbles += K.T(m, F.atk700, String(r + 1), 190, 770 + r * 70, 30, C.grafito, 0, "end");
      for (let c = 0; c < 4; c++) {
        const filled = (r === 0 && c === 1) || (r === 1 && c === 3) || (r === 2 && c === 0);
        bubbles += filled
          ? `<circle cx="${240 + c * 70}" cy="${760 + r * 70}" r="22" fill="${C.grafito}"/>`
          : `<circle cx="${240 + c * 70}" cy="${760 + r * 70}" r="21" fill="none" stroke="${C.grafito}" stroke-width="3"/>`;
      }
    }
    return (
      `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
      K.T(m, F.sora700, "Cada hoja ya sabe", 80, 200, 84, C.papel, -0.04) +
      K.T(m, F.sora700, "de quién es.", 80, 295, 84, C.lapiz, -0.04) +
      `<g transform="rotate(-3 540 750)"><rect x="120" y="420" width="840" height="560" rx="18" fill="#FFFFFF"/>` +
      K.T(m, F.sora700, "Hoja de respuestas · Forma B", 170, 500, 34, C.grafito) +
      K.T(m, F.atk400, "Estudiante:", 170, 560, 30, "#5A5D69") +
      K.T(m, F.sora700, "Valentina Rodríguez", 170, 610, 44, C.grafito, -0.02) +
      K.T(m, F.atk400, "11-A · Página 1 de 2", 170, 660, 28, "#5A5D69") +
      qr +
      `<rect x="150" y="690" width="780" height="2" fill="${C.grafito}"/>` +
      bubbles +
      `</g>` +
      P(m, F.atk400, "Nadie rellena códigos. Nadie se equivoca de hoja.", 80, 1100, 44, "rgba(246,243,234,0.9)", { maxW: 920, lh: 1.3 }).svg +
      footer(W, H, true)
    );
  },

  "05-puntaje-global": (m) => {
    const rows = [
      ["Lectura Crítica", "×3", TEST.lectura_critica],
      ["Matemáticas", "×3", TEST.matematicas],
      ["Sociales y Ciudadanas", "×3", TEST.sociales],
      ["Ciencias Naturales", "×3", TEST.ciencias],
      ["Inglés", "×1", TEST.ingles],
    ];
    let y = 470;
    let list = "";
    for (const [name, w, color] of rows) {
      list +=
        `<circle cx="120" cy="${y - 16}" r="22" fill="${color}"/>` +
        K.T(m, F.sora600, name, 170, y, 46, C.grafito, -0.02) +
        K.T(m, F.sora700, w, 1000, y, 52, C.tinta, 0, "end") +
        `<rect x="80" y="${y + 36}" width="920" height="2" fill="#E6E1D3"/>`;
      y += 108;
    }
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      label(m, "Saber 11 en 1 minuto", 80, 150, C.tinta) +
      K.T(m, F.sora700, "¿Cómo se calcula", 80, 260, 84, C.tinta, -0.04) +
      K.T(m, F.sora700, "el puntaje global?", 80, 355, 84, C.tinta, -0.04) +
      list +
      `<rect x="80" y="1010" width="920" height="120" rx="28" fill="${C.tinta}"/>` +
      stickerless(m, "Promedio ponderado × 5 = 0 a 500", 540, 1086, 40, C.papel, F.sora700) +
      K.T(m, F.atk400, "Fuente: guía de resultados del ICFES.", 80, 1180, 26, "#8A8D99") +
      footer(W, H, false)
    );
  },

  "06-manifiesto": (m) =>
    `<rect width="${W}" height="${H}" fill="${C.lapiz}"/>` +
    bubbleRow(80, 110, 6, 50, 20, [0, 1, 2, 3, 4, 5], "", C.tinta).replace(/fill="#16205A"/g, `fill="${C.tinta}" fill-opacity="0.12"`) +
    K.T(m, F.sora700, "“", 80, 420, 220, C.tinta) +
    P(m, F.sora700, "Ningún profe debería pasar el domingo calificando.", 80, 520, 96, C.tinta, { maxW: 920, lh: 1.08, tracking: -0.035 }).svg +
    K.T(m, F.atk700, "Por eso creamos ExamHub.", 80, 1040, 44, C.tinta) +
    footer(W, H, false),

  "07-sin-internet": (m) =>
    `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
    `<circle cx="540" cy="390" r="190" fill="rgba(246,243,234,0.08)"/>` +
    icon.wifiOff(420, 270, 240, C.lapiz) +
    P(m, F.sora700, "¿Sin señal en el salón? Igual calificas.", 80, 720, 84, C.papel, { maxW: 920, lh: 1.1, tracking: -0.035 }).svg +
    P(m, F.atk400, "Las notas se guardan en el celular y se suben solas cuando vuelve el internet.", 80, 950, 44, "rgba(246,243,234,0.88)", { maxW: 900, lh: 1.3 }).svg +
    footer(W, H, true),

  "08-informe-rector": (m) => {
    const bars = [
      ["Lectura", 62, TEST.lectura_critica],
      ["Matemáticas", 55, TEST.matematicas],
      ["Sociales", 48, TEST.sociales],
      ["Ciencias", 51, TEST.ciencias],
      ["Inglés", 66, TEST.ingles],
    ];
    let b = "";
    bars.forEach(([n, v, c], i) => {
      const y = 620 + i * 78;
      b +=
        K.T(m, F.atk700, n, 160, y, 30, C.grafito) +
        `<rect x="400" y="${y - 24}" width="440" height="26" rx="13" fill="#ECE7DA"/>` +
        `<rect x="400" y="${y - 24}" width="${4.4 * v}" height="26" rx="13" fill="${c}"/>` +
        K.T(m, F.sora700, String(v), 920, y, 32, C.grafito, 0, "end");
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      K.T(m, F.sora700, "El informe que tu", 80, 200, 84, C.tinta, -0.04) +
      K.T(m, F.sora700, "rector sí va a leer.", 80, 295, 84, C.tinta, -0.04) +
      `<rect x="120" y="390" width="840" height="620" rx="24" fill="#FFFFFF"/>` +
      `<rect x="120" y="390" width="840" height="130" rx="24" fill="${C.tinta}"/><rect x="120" y="480" width="840" height="40" fill="${C.tinta}"/>` +
      K.T(m, F.sora700, "Informe institucional · Simulacro 3", 160, 470, 34, C.papel) +
      b +
      K.T(m, F.atk400, "Datos de ejemplo", 160, 975, 24, "#8A8D99") +
      P(m, F.atk400, "Resultados por grupo y competencia, plan de mejora y estudiantes que necesitan apoyo.", 80, 1090, 38, "#3A3D49", { maxW: 920, lh: 1.3 }).svg +
      footer(W, H, false)
    );
  },

  "09-simulacro-gratis": (m) => {
    const t = P(m, F.sora700, "Tu primer simulacro, gratis.", 80, 330, 112, C.tinta, { maxW: 920, lh: 1.05, tracking: -0.04 });
    return `<rect width="${W}" height="${H}" fill="${C.lapiz}"/>` +
    label(m, "Colegios fundadores", 80, 150, C.tinta) +
    t.svg +
    P(m, F.atk400, "Para grado 10: lo configuramos contigo, tus docentes califican con el celular y recibes el informe por competencia.", 80, t.bottom + 130, 44, C.tinta, { maxW: 900, lh: 1.3 }).svg +
    pill(m, "Escríbenos por WhatsApp", 80, 930, 40, C.tinta, C.papel) +
    K.T(m, F.atk700, "Cupos limitados", 80, 1110, 34, C.tinta) +
    footer(W, H, false);
  },
};

// ---------------------------------------------------------------------
//  Carruseles
// ---------------------------------------------------------------------

function slide(m, n, total, { bg, title, body, ic, cover, cta }) {
  const dark = bg === C.tinta;
  const fg = dark ? C.papel : C.tinta;
  const sub = dark ? "rgba(246,243,234,0.88)" : "#3A3D49";
  let s = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  if (cover) {
    s += bubbleRow(80, 110, 6, 50, 20, [2], dark ? "rgba(246,243,234,0.3)" : "rgba(22,32,90,0.3)", bg === C.lapiz ? C.tinta : C.lapiz);
    s += P(m, F.sora700, title, 80, 520, 112, fg, { maxW: 920, lh: 1.05, tracking: -0.04 }).svg;
    if (body) s += P(m, F.atk400, body, 80, 920, 44, sub, { maxW: 900, lh: 1.3 }).svg;
    s += swipe(m, W, 1150, fg);
  } else {
    if (ic) s += ic(80, 150, 120, dark ? C.lapiz : C.tinta);
    const t = P(m, F.sora700, title, 80, 400, 92, fg, { maxW: 920, lh: 1.08, tracking: -0.035 });
    s += t.svg;
    s += P(m, F.atk400, body, 80, t.bottom + 110, 46, sub, { maxW: 900, lh: 1.32 }).svg;
    if (cta) s += pill(m, cta, 80, 1010, 38, dark ? C.lapiz : C.tinta, dark ? C.tinta : C.papel);
  }
  return s + footer(W, H, dark, [n, total], dark ? C.lapiz : C.tinta);
}

const CAROUSELS = {
  "como-funciona": [
    { bg: C.tinta, cover: true, title: "Del lápiz al resultado en 4 pasos.", body: "Así hace un colegio sus simulacros tipo Saber 11 con ExamHub." },
    { bg: C.papel, ic: icon.bank, title: "1. Arma el simulacro", body: "Elige preguntas de tu banco o créalas con IA gratis. ExamHub arma varias formas para evitar la copia." },
    { bg: C.papel, ic: icon.print, title: "2. Imprime", body: "Cuadernillos y hojas con el nombre de cada estudiante, listos para fotocopiar." },
    { bg: C.papel, ic: icon.phone, title: "3. Califica con el celular", body: "Una foto a la hoja: ExamHub lee las burbujas y el QR. Funciona incluso sin internet." },
    { bg: C.tinta, ic: icon.chart, title: "4. Mejora con datos", body: "Informe por competencia, boletines para las familias y plan de mejora para el colegio.", cta: "Pide tu simulacro gratis" },
  ],
  "leer-resultados-saber11": [
    { bg: C.lapiz, cover: true, title: "Cómo leer los resultados del Saber 11.", body: "Sin perderte en los números. Guárdalo para la próxima reunión de área." },
    { bg: C.papel, title: "Puntaje global: de 0 a 500", body: "Es el promedio ponderado de las 5 pruebas, multiplicado por 5. Lectura, Matemáticas, Sociales y Ciencias pesan 3; Inglés pesa 1." },
    { bg: C.papel, title: "Cada prueba: de 0 a 100", body: "Compara con el promedio de tu colegio y del país, no solo con el año anterior." },
    { bg: C.papel, title: "Niveles de desempeño", body: "Dicen qué sabe hacer el estudiante, no solo cuánto sacó. Inglés usa los niveles del Marco Común Europeo (A-, A1, A2, B1…)." },
    { bg: C.papel, title: "Competencias: la pista", body: "Lectura, Matemáticas, Sociales y Ciencias evalúan tres competencias cada una. Ahí ves qué enseñar distinto, por ejemplo Argumentación." },
    { bg: C.tinta, title: "Míralo en cada simulacro", body: "ExamHub te muestra todo esto por estudiante y por grupo, en minutos.", cta: "Pide tu simulacro gratis" },
  ],
};

// ---------------------------------------------------------------------
//  Historias, destacadas, perfiles, portadas y enlace
// ---------------------------------------------------------------------

const SW = 1080;
const SH = 1920;
const sticker = (m, text, y, color) =>
  `<rect x="190" y="${y}" width="700" height="150" rx="30" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="14 10"/>` +
  K.T(m, F.atk700, text, 540, y + 88, 34, color, 0, "end").replace(/^/, "");

const STORIES = {
  "historia-1-lanzamiento": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.tinta}"/>` +
    mark("negative", { x: 340, y: 300, size: 400 }) +
    K.T(m, F.sora700, "Ya llegó", 90, 960, 120, C.papel, -0.04) +
    K.T(m, F.sora700, "ExamHub.", 90, 1090, 120, C.lapiz, -0.04) +
    P(m, F.atk400, "Simulacros tipo Saber 11 calificados con el celular.", 90, 1200, 48, "rgba(246,243,234,0.88)", { maxW: 900, lh: 1.3 }).svg +
    stickerBox(m, "[Sticker de enlace]", 1450, C.papel),
  "historia-2-encuesta": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.papel}"/>` +
    label(m, "Encuesta para profes", 90, 260, C.tinta, 34) +
    P(m, F.sora700, "¿Cuántas horas te toma calificar un simulacro?", 90, 520, 104, C.tinta, { maxW: 900, lh: 1.08, tracking: -0.04 }).svg +
    stickerBox(m, "[Sticker de encuesta]", 1100, C.tinta) +
    `<g transform="translate(90 1700)">${inlineLogo(0, 0, 64, "positive", C.tinta).svg}</g>`,
  "historia-3-oferta": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.lapiz}"/>` +
    label(m, "Colegios fundadores", 90, 260, C.tinta, 34) +
    P(m, F.sora700, "Simulacro diagnóstico gratis para grado 10.", 90, 520, 110, C.tinta, { maxW: 900, lh: 1.05, tracking: -0.04 }).svg +
    P(m, F.atk400, "Lo configuramos contigo. Tú recibes el informe por competencia.", 90, 1000, 48, C.tinta, { maxW: 900, lh: 1.3 }).svg +
    stickerBox(m, "[Sticker de enlace a WhatsApp]", 1300, C.tinta) +
    `<g transform="translate(90 1700)">${inlineLogo(0, 0, 64, "positive", C.tinta).svg}</g>`,
};

function stickerBox(m, text, y, color) {
  const w = measure(F.atk700, text, 34).width;
  return (
    `<rect x="140" y="${y}" width="800" height="150" rx="30" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="14 10"/>` +
    K.T(m, F.atk700, text, 540 - w / 2, y + 88, 34, color)
  );
}

const HIGHLIGHTS = {
  "destacada-como-funciona": icon.play,
  "destacada-tips": icon.bulb,
  "destacada-colegios": icon.school,
  "destacada-precios": icon.tag,
  "destacada-contacto": icon.chat,
};

const COVERS = {
  // Facebook recorta los lados en celular: el contenido va en el centro.
  "portada-facebook-1640x624": {
    w: 1640,
    h: 624,
    draw: (m) => {
      const l = logoAt(0, 0, 100, true);
      return (
        `<rect width="1640" height="624" fill="${C.tinta}"/>` +
        bubbleRow(1180, 60, 5, 60, 22, [1], "rgba(246,243,234,0.2)", C.lapiz) +
        `<g transform="translate(${820 - l.width / 2} 150)">${l.svg}</g>` +
        stickerless(m, "Del lápiz al resultado, en segundos.", 820, 370, 52, C.lapiz) +
        stickerless(m, "Simulacros Saber 11 en papel · calificación con el celular · informes por competencia", 820, 440, 28, "rgba(246,243,234,0.8)", F.atk400)
      );
    },
  },
  // Página de empresa en LinkedIn: 1128 × 191.
  "portada-linkedin-empresa-1128x191": {
    w: 1128,
    h: 191,
    draw: (m) =>
      `<rect width="1128" height="191" fill="${C.tinta}"/>` +
      bubbleRow(860, 30, 6, 30, 14, [3], "rgba(246,243,234,0.2)", C.lapiz) +
      K.T(m, F.sora700, "Simulacros tipo Saber 11, calificados con el celular.", 300, 112, 30, C.papel, -0.02),
  },
  // Perfil personal (fundador): 1584 × 396. La foto tapa la esquina inferior izquierda.
  "portada-linkedin-fundador-1584x396": {
    w: 1584,
    h: 396,
    draw: (m) =>
      `<rect width="1584" height="396" fill="${C.tinta}"/>` +
      bubbleRow(1180, 40, 6, 40, 18, [3], "rgba(246,243,234,0.2)", C.lapiz) +
      mark("negative", { x: 560, y: 120, size: 110 }) +
      K.T(m, F.sora700, "Construyo ExamHub:", 710, 170, 46, C.papel, -0.02) +
      K.T(m, F.sora700, "simulacros Saber 11 para colegios de Colombia.", 710, 232, 38, C.lapiz, -0.02) +
      K.T(m, F.atk400, "Del lápiz al resultado, en segundos.", 710, 290, 28, "rgba(246,243,234,0.8)"),
  },
  // YouTube: 2560 × 1440; zona segura central de 1546 × 423.
  "portada-youtube-2560x1440": {
    w: 2560,
    h: 1440,
    draw: (m) => {
      const l = logoAt(0, 0, 150, true);
      return (
        `<rect width="2560" height="1440" fill="${C.tinta}"/>` +
        bubbleRow(500, 330, 14, 90, 30, [9], "rgba(246,243,234,0.12)", C.lapiz) +
        bubbleRow(500, 1020, 14, 90, 30, [3], "rgba(246,243,234,0.12)", C.papel) +
        `<g transform="translate(${1280 - l.width / 2} 560)">${l.svg}</g>` +
        stickerless(m, "Tutoriales de simulacros Saber 11 para docentes", 1280, 820, 44, C.lapiz)
      );
    },
  },
  "portada-x-1500x500": {
    w: 1500,
    h: 500,
    draw: (m) =>
      `<rect width="1500" height="500" fill="${C.tinta}"/>` +
      bubbleRow(1080, 50, 5, 56, 20, [1], "rgba(246,243,234,0.2)", C.lapiz) +
      K.T(m, F.sora700, "Del lápiz al resultado,", 520, 250, 64, C.papel, -0.03) +
      K.T(m, F.sora700, "en segundos.", 520, 330, 64, C.lapiz, -0.03),
  },
  // Perfil de empresa en Google: 16:9.
  "portada-google-negocio-1080x608": {
    w: 1080,
    h: 608,
    draw: (m) => {
      const l = logoAt(0, 0, 90, true);
      return (
        `<rect width="1080" height="608" fill="${C.tinta}"/>` +
        `<g transform="translate(${540 - l.width / 2} 200)">${l.svg}</g>` +
        stickerless(m, "Simulacros tipo Saber 11 para colegios", 540, 400, 38, C.lapiz)
      );
    },
  },
};

/** Texto centrado (las portadas). */
function stickerless(m, text, cx, y, size, fill, font = F.sora600) {
  const w = measure(font, text, size).width;
  return K.T(m, font, text, cx - w / 2, y, size, fill);
}

const PROFILES = {
  "perfil-lapiz": `<rect width="1080" height="1080" fill="${C.lapiz}"/>` + mark("positive", { x: 290, y: 290, size: 500 }),
  "perfil-tinta": `<rect width="1080" height="1080" fill="${C.tinta}"/>` + mark("negative", { x: 290, y: 290, size: 500 }),
  "perfil-papel": `<rect width="1080" height="1080" fill="${C.papel}"/>` + mark("positive", { x: 290, y: 290, size: 500 }),
};

// ---------------------------------------------------------------------
//  Escribir
// ---------------------------------------------------------------------

function out(rel, w, h, draw) {
  writeFile(path.join(OUT, "editables", rel + ".svg"), svgDoc(w, h, draw("live")));
  const svg = svgDoc(w, h, draw("path"));
  png(svg, w, path.join(OUT, rel + ".png"));
  return svg;
}

function build() {
  for (const [name, body] of Object.entries(PROFILES)) out(`01-perfiles/${name}`, 1080, 1080, () => body);
  for (const [name, c] of Object.entries(COVERS)) out(`02-portadas/${name}`, c.w, c.h, c.draw);

  const feedSvgs = [];
  for (const [name, draw] of Object.entries(FEED)) feedSvgs.push(out(`03-feed-lanzamiento/${name}`, W, H, draw));

  for (const [name, slides] of Object.entries(CAROUSELS)) {
    slides.forEach((s, i) => out(`04-carruseles/${name}/lamina-${i + 1}`, W, H, (m) => slide(m, i + 1, slides.length, s)));
  }
  for (const [name, draw] of Object.entries(STORIES)) out(`05-historias/${name}`, SW, SH, draw);
  for (const [name, ic] of Object.entries(HIGHLIGHTS)) {
    out(`06-destacadas/${name}`, SW, SH, () => `<rect width="${SW}" height="${SH}" fill="${C.tinta}"/><circle cx="540" cy="960" r="300" fill="rgba(246,243,234,0.08)"/>` + ic(380, 800, 320, C.lapiz));
  }

  // Imagen al compartir el enlace (WhatsApp, Facebook, LinkedIn).
  const og = (m) => {
    const l = logoAt(0, 0, 96, true);
    return (
      `<rect width="1200" height="630" fill="${C.tinta}"/>` +
      bubbleRow(80, 70, 8, 44, 18, [5], "rgba(246,243,234,0.22)", C.lapiz) +
      `<g transform="translate(80 210)">${l.svg}</g>` +
      K.T(m, F.sora700, "Simulacros tipo Saber 11,", 80, 420, 56, C.papel, -0.03) +
      K.T(m, F.sora700, "calificados con el celular.", 80, 490, 56, C.lapiz, -0.03)
    );
  };
  const ogSvg = out("07-enlaces/imagen-para-compartir-1200x630", 1200, 630, og);
  png(ogSvg, 1200, path.join(K.ROOT, "src", "assets", "og-image.png"));

  // Vista previa del perfil de Instagram: lo último publicado va arriba a la izquierda.
  const order = [...feedSvgs].reverse();
  const cw = 360;
  const ch = 480;
  let grid = `<rect width="${cw * 3 + 8}" height="${ch * 3 + 8}" fill="#FFFFFF"/>`;
  order.forEach((svg, i) => {
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const x = (i % 3) * (cw + 4);
    const y = Math.floor(i / 3) * (ch + 4);
    // Instagram muestra la cuadrícula en 3:4: recorte centrado de la pieza 4:5.
    grid += `<svg x="${x}" y="${y}" width="${cw}" height="${ch}" viewBox="0 ${(H - W * (4 / 3)) / 2} ${W} ${W * (4 / 3)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  });
  png(svgDoc(cw * 3 + 8, ch * 3 + 8, grid), 1088, path.join(OUT, "03-feed-lanzamiento", "00-vista-del-perfil.png"));
  console.log("Piezas de redes generadas en docs/marketing/redes/");
}

build();
