/**
 * Mes 2 en redes: publicaciones de funciones nuevas (Banco ExamHub, IA,
 * boletines, formas, app), retos tipo Saber 11, carruseles educativos e
 * historias. Usa las mismas piezas de build-social.js.
 *
 *   cd scripts/brand && npm install && node build-social-2.js
 *
 * Salida: docs/marketing/redes/08-feed-mes-2, 09-carruseles-mes-2,
 * 10-historias-mes-2 (y sus SVG editables).
 */
const path = require("path");
const K = require("./build-brand-kit.js");
const S = require("./build-social.js");
const { C, F, measure, mark, svgDoc, png, inlineLogo, bubbleRow } = K;
const { OUT, TEST, W, H, SW, SH, P, pill, label, footer, swipe, icon, slide, stickerBox, stickerless, out } = S;

const SUB_DARK = "rgba(246,243,234,0.88)";
const SUB_LIGHT = "#3A3D49";

/** Texto centrado horizontalmente. */
const center = (m, font, text, cx, y, size, fill) => stickerless(m, text, cx, y, size, fill, font);

// ---------------------------------------------------------------------
//  Publicaciones 4:5
// ---------------------------------------------------------------------

const MIX = [
  ["Lectura Crítica", 20, TEST.lectura_critica],
  ["Matemáticas", 20, TEST.matematicas],
  ["Sociales", 20, TEST.sociales],
  ["Ciencias", 22, TEST.ciencias],
  ["Inglés", 18, TEST.ingles],
];

const FEED = {
  "10-banco-examhub": (m) => {
    const sub = P(m, F.atk400, "Preguntas tipo Saber 11 listas para usar. Arma un simulacro completo en segundos.", 80, 650, 44, SUB_DARK, { maxW: 900, lh: 1.3 });
    // Barra con la mezcla de las 5 pruebas.
    const total = MIX.reduce((a, [, n]) => a + n, 0);
    const gap = 8;
    let x = 80;
    let bar = "";
    for (const [, n, color] of MIX) {
      const w = ((920 - gap * (MIX.length - 1)) * n) / total;
      bar += `<rect x="${x}" y="900" width="${w}" height="64" rx="18" fill="${color}"/>`;
      x += w + gap;
    }
    // Leyenda en dos filas.
    let legend = "";
    const rows = [MIX.slice(0, 3), MIX.slice(3)];
    rows.forEach((row, r) => {
      let lx = 80;
      for (const [name, , color] of row) {
        const y = 1035 + r * 56;
        legend += `<circle cx="${lx + 12}" cy="${y - 11}" r="12" fill="${color}"/>` + K.T(m, F.atk400, name, lx + 36, y, 32, SUB_DARK);
        lx += 36 + measure(F.atk400, name, 32).width + 44;
      }
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
      pill(m, "Nuevo", 80, 110, 32, C.lapiz, C.tinta) +
      K.T(m, F.sora700, "Banco", 80, 400, 150, C.papel, -0.04) +
      K.T(m, F.sora700, "ExamHub.", 80, 550, 150, C.lapiz, -0.04) +
      sub.svg +
      K.T(m, F.atk700, "Simulacro automático: las 5 pruebas", 80, 870, 32, C.lapiz) +
      bar +
      legend +
      footer(W, H, true)
    );
  },

  "11-ia-gratis": (m) => {
    const t = P(m, F.sora700, "Tu banco de preguntas, con la IA que ya usas.", 80, 260, 88, C.tinta, { maxW: 920, lh: 1.08, tracking: -0.035 });
    const y0 = t.bottom + 70;
    const prompt = P(m, F.atk400, "Genera 10 preguntas tipo Saber 11 de Ciencias Naturales sobre ecosistemas, con su justificación...", 170, y0 + 135, 34, C.papel, { maxW: 740, lh: 1.3 });
    const bubbleBottom = prompt.bottom + 45;
    const answerY = bubbleBottom + 60;
    const cardBottom = answerY + 110;
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      label(m, "Crea tu banco con IA", 80, 150, C.tinta) +
      t.svg +
      `<rect x="80" y="${y0}" width="920" height="${cardBottom - y0}" rx="32" fill="#FFFFFF"/>` +
      K.T(m, F.atk700, "Tu prompt", 130, y0 + 60, 26, "#8A8D99") +
      `<rect x="130" y="${y0 + 80}" width="820" height="${bubbleBottom - y0 - 80}" rx="24" fill="${C.tinta}"/>` +
      prompt.svg +
      K.T(m, F.atk700, "Respuesta de la IA", 130, answerY, 26, "#8A8D99") +
      [700, 520].map((w, i) => `<rect x="130" y="${answerY + 28 + i * 36}" width="${w}" height="18" rx="9" fill="#ECE7DA"/>`).join("") +
      K.T(m, F.atk400, "Con ChatGPT, Gemini o Claude. Gratis.", 80, cardBottom + 70, 36, SUB_LIGHT) +
      pill(m, "Pégala en ExamHub: carpetas listas", 80, cardBottom + 105, 34, C.lapiz, C.tinta) +
      footer(W, H, false)
    );
  },

  "12-mito-realidad": (m) =>
    `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
    `<rect y="660" width="${W}" height="${H - 660}" fill="${C.tinta}"/>` +
    pill(m, "Mito", 80, 100, 34, C.borrador, C.grafito) +
    P(m, F.sora700, "Para calificar con el celular se necesita internet.", 80, 330, 76, C.grafito, { maxW: 920, lh: 1.1, tracking: -0.03 }).svg +
    pill(m, "Realidad", 80, 740, 34, C.aprobado, "#FFFFFF") +
    P(m, F.sora700, "ExamHub califica sin señal y sube las notas cuando vuelve la conexión.", 80, 950, 64, C.papel, { maxW: 920, lh: 1.12, tracking: -0.03 }).svg +
    footer(W, H, true),

  "13-ya-no-vas-a": (m) => {
    const items = ["Contar burbujas una por una", "Pasar notas a Excel", "Recortar plantillas de acetato", "Calificar el domingo en la noche"];
    let list = "";
    items.forEach((text, i) => {
      const y = 520 + i * 135;
      const w = measure(F.atk700, text, 46).width;
      list +=
        `<rect x="80" y="${y - 52}" width="64" height="64" rx="14" fill="${C.tinta}"/>` +
        `<polyline points="${96},${y - 20} ${108},${y - 8} ${130},${y - 34}" fill="none" stroke="${C.lapiz}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
        K.T(m, F.atk700, text, 180, y, 46, "#6A6D79") +
        `<rect x="174" y="${y - 18}" width="${w + 12}" height="4" rx="2" fill="${C.borrador}"/>`;
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      label(m, "Profe, esto se acabó", 80, 150, C.tinta) +
      P(m, F.sora700, "Cosas que ya no vas a hacer:", 80, 270, 92, C.tinta, { maxW: 920, lh: 1.08, tracking: -0.035 }).svg +
      list +
      pill(m, "ExamHub lo hace por ti", 80, 1030, 38, C.tinta, C.papel) +
      footer(W, H, false)
    );
  },

  "14-boletin-familias": (m) => {
    const scores = [
      ["Lectura", 58, TEST.lectura_critica],
      ["Matemáticas", 52, TEST.matematicas],
      ["Sociales", 45, TEST.sociales],
      ["Ciencias", 50, TEST.ciencias],
      ["Inglés", 70, TEST.ingles],
    ];
    // Global = promedio ponderado (3,3,3,3,1) × 5.
    const global = Math.round(((58 + 52 + 45 + 50) * 3 + 70) / 13 * 5);
    let bars = "";
    scores.forEach(([n, v, c], i) => {
      const y = 650 + i * 58;
      bars +=
        K.T(m, F.atk700, n, 170, y, 28, C.grafito) +
        `<rect x="420" y="${y - 22}" width="400" height="24" rx="12" fill="#ECE7DA"/>` +
        `<rect x="420" y="${y - 22}" width="${4 * v}" height="24" rx="12" fill="${c}"/>` +
        K.T(m, F.sora700, String(v), 905, y, 30, C.grafito, 0, "end");
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
      K.T(m, F.sora700, "Un boletín para", 80, 200, 84, C.papel, -0.04) +
      K.T(m, F.sora700, "cada familia.", 80, 295, 84, C.lapiz, -0.04) +
      `<g transform="rotate(-2 540 700)">` +
      `<rect x="120" y="380" width="840" height="660" rx="24" fill="#FFFFFF"/>` +
      K.T(m, F.sora700, "Boletín de resultados · Simulacro 2", 170, 450, 30, C.grafito) +
      K.T(m, F.sora700, "Santiago Gómez", 170, 525, 50, C.grafito, -0.02) +
      K.T(m, F.atk400, `11-B · Puntaje global estimado: ${global}`, 170, 572, 28, "#5A5D69") +
      `<rect x="150" y="598" width="780" height="2" fill="#E6E1D3"/>` +
      bars +
      `<circle cx="182" cy="${948}" r="12" fill="${C.aprobado}"/>` +
      K.T(m, F.atk700, "Fortaleza: Inglés", 204, 958, 28, C.grafito) +
      `<circle cx="532" cy="${948}" r="12" fill="${C.borrador}"/>` +
      K.T(m, F.atk700, "Por reforzar: Sociales", 554, 958, 28, C.grafito) +
      K.T(m, F.atk400, "Datos de ejemplo", 170, 1010, 24, "#8A8D99") +
      `</g>` +
      P(m, F.atk400, "Listo para imprimir o enviar por WhatsApp, con lo que debe reforzar cada estudiante.", 80, 1120, 36, SUB_DARK, { maxW: 920, lh: 1.3 }).svg +
      footer(W, H, true)
    );
  },

  "15-cuatro-formas": (m) => {
    const second = "Cuatro formas.";
    const w2 = measure(F.sora700, second, 100, -0.04).width;
    // Cada forma marca otra posición en cada fila: otro orden.
    const keys = [
      [0, 2, 1, 3, 2],
      [2, 0, 3, 1, 0],
      [1, 3, 0, 2, 3],
      [3, 1, 2, 0, 1],
    ];
    let sheets = "";
    "ABCD".split("").forEach((letter, i) => {
      const x = 80 + i * 240;
      const rot = [-3, 2, -2, 3][i];
      let rows = "";
      keys[i].forEach((k, r) => {
        for (let c = 0; c < 4; c++) {
          const cx = x + 42 + c * 40;
          const cy = 660 + r * 44;
          rows += c === k ? `<circle cx="${cx}" cy="${cy}" r="12" fill="${C.grafito}"/>` : `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${C.grafito}" stroke-opacity="0.45" stroke-width="2.5"/>`;
        }
      });
      sheets +=
        `<g transform="rotate(${rot} ${x + 100} 690)">` +
        `<rect x="${x}" y="520" width="200" height="350" rx="18" fill="#FFFFFF" stroke="#E6E1D3" stroke-width="2"/>` +
        `<circle cx="${x + 100}" cy="580" r="32" fill="${C.tinta}"/>` +
        center(m, F.sora700, letter, x + 100, 593, 36, C.papel) +
        rows +
        `</g>`;
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
      label(m, "Contra la copia", 80, 150, C.tinta) +
      K.T(m, F.sora700, "Misma prueba.", 80, 280, 100, C.tinta, -0.04) +
      `<rect x="68" y="320" width="${w2 + 24}" height="88" rx="10" fill="${C.lapiz}"/>` +
      K.T(m, F.sora700, second, 80, 390, 100, C.tinta, -0.04) +
      sheets +
      P(m, F.atk400, "Cada forma trae otro orden y ExamHub califica cada una con su propia clave. Copiarle al de al lado ya no sirve.", 80, 970, 42, SUB_LIGHT, { maxW: 920, lh: 1.3 }).svg +
      footer(W, H, false)
    );
  },

  "16-ya-es-app": (m) => {
    const col = (y, title, text) => {
      const p = P(m, F.atk400, text, 80, y + 50, 34, C.tinta, { maxW: 470, lh: 1.3 });
      return { svg: K.T(m, F.sora700, title, 80, y, 38, C.tinta) + p.svg, bottom: p.bottom };
    };
    const a = col(560, "Android", "Menú del navegador y luego Instalar app.");
    const b = col(a.bottom + 110, "iPhone", "Compartir y luego Agregar a inicio.");
    const c = P(m, F.atk700, "Y califica aunque no haya señal.", 80, b.bottom + 110, 38, C.tinta, { maxW: 470, lh: 1.25 });
    return (
      `<rect width="${W}" height="${H}" fill="${C.lapiz}"/>` +
      label(m, "Sin tienda de apps", 80, 150, C.tinta) +
      K.T(m, F.sora700, "ExamHub ya", 80, 285, 110, C.tinta, -0.04) +
      K.T(m, F.sora700, "es app.", 80, 405, 110, C.tinta, -0.04) +
      a.svg +
      b.svg +
      c.svg +
      `<rect x="630" y="470" width="350" height="640" rx="54" fill="${C.tinta}"/>` +
      `<rect x="652" y="500" width="306" height="580" rx="36" fill="${C.papel}"/>` +
      `<rect x="765" y="482" width="80" height="8" rx="4" fill="rgba(246,243,234,0.35)"/>` +
      mark("positive", { x: 735, y: 640, size: 140 }) +
      center(m, F.sora700, "ExamHub", 805, 840, 38, C.tinta) +
      bubbleRow(700, 900, 5, 30, 12, [3], "rgba(22,32,90,0.3)", C.lapiz) +
      footer(W, H, false)
    );
  },

  "17-pregunta-profes": (m) => {
    const q = P(m, F.sora700, "¿Qué prueba del Saber 11 te cuesta más preparar?", 80, 280, 86, C.papel, { maxW: 920, lh: 1.08, tracking: -0.035 });
    let rows = "";
    const names = ["Lectura Crítica", "Matemáticas", "Sociales y Ciudadanas", "Ciencias Naturales", "Inglés"];
    const colors = [TEST.lectura_critica, TEST.matematicas, TEST.sociales, TEST.ciencias, TEST.ingles];
    names.forEach((n, i) => {
      const y = q.bottom + 100 + i * 100;
      rows +=
        `<rect x="80" y="${y}" width="920" height="80" rx="40" fill="rgba(246,243,234,0.09)"/>` +
        `<circle cx="130" cy="${y + 40}" r="20" fill="${colors[i]}"/>` +
        K.T(m, F.atk700, n, 172, y + 54, 40, C.papel);
    });
    return (
      `<rect width="${W}" height="${H}" fill="${C.tinta}"/>` +
      label(m, "Pregunta para profes", 80, 150, C.lapiz) +
      q.svg +
      rows +
      K.T(m, F.atk400, "Cuéntanos en los comentarios.", 80, q.bottom + 640, 36, SUB_DARK) +
      footer(W, H, true)
    );
  },
};

// ---------------------------------------------------------------------
//  Retos tipo Saber 11 (carrusel de 3: pregunta, respuesta, invitación)
// ---------------------------------------------------------------------

function retoQuestion(m, r, total) {
  let s = `<rect width="${W}" height="${H}" fill="${C.lapiz}"/>` + pill(m, `Reto Saber 11 · ${r.area}`, 80, 100, 30, r.color, "#FFFFFF");
  let y = 270;
  if (r.fragment) {
    const f = P(m, F.atk400, r.fragment, 130, y + 70, 38, C.grafito, { maxW: 820, lh: 1.3 });
    s += `<rect x="80" y="${y}" width="920" height="${f.bottom - y + 60}" rx="28" fill="rgba(255,255,255,0.75)"/>` + f.svg;
    y = f.bottom + 150;
  }
  const q = P(m, F.sora600, r.question, 80, y, r.fragment ? 44 : 50, C.tinta, { maxW: 920, lh: 1.25, tracking: -0.02 });
  s += q.svg;
  let oy = q.bottom + 60;
  const oh = 96;
  r.options.forEach((text, i) => {
    s +=
      `<rect x="80" y="${oy}" width="920" height="${oh}" rx="28" fill="#FFFFFF"/>` +
      `<circle cx="146" cy="${oy + oh / 2}" r="32" fill="${C.tinta}"/>` +
      center(m, F.sora700, "ABCD"[i], 146, oy + oh / 2 + 12, 34, C.papel) +
      K.T(m, F.atk700, text, 206, oy + oh / 2 + 14, 40, C.grafito);
    oy += oh + 20;
  });
  return s + swipe(m, W, 1180, C.tinta) + footer(W, H, false, [1, total], C.tinta);
}

function retoAnswer(m, r, total) {
  const exp = P(m, F.atk400, r.explanation, 80, 600, 44, SUB_LIGHT, { maxW: 920, lh: 1.32 });
  return (
    `<rect width="${W}" height="${H}" fill="${C.papel}"/>` +
    label(m, "Respuesta", 80, 150, C.tinta) +
    `<circle cx="170" cy="${380}" r="96" fill="${C.aprobado}"/>` +
    center(m, F.sora700, r.answer, 170, 418, 110, "#FFFFFF") +
    P(m, F.sora700, r.answerText, 310, 400, 60, C.tinta, { maxW: 690, lh: 1.1, tracking: -0.03 }).svg +
    exp.svg +
    `<rect x="80" y="${exp.bottom + 60}" width="920" height="2" fill="#E6E1D3"/>` +
    P(m, F.atk700, r.competence, 80, exp.bottom + 130, 32, C.tinta, { maxW: 920, lh: 1.3 }).svg +
    footer(W, H, false, [2, total], C.tinta)
  );
}

const RETOS = {
  "reto-matematicas": {
    area: "Matemáticas",
    color: TEST.matematicas,
    question: "En un colegio, 240 estudiantes presentaron un simulacro. El 35 % lo presentó en la mañana y el resto en la tarde. ¿Cuántos lo presentaron en la tarde?",
    options: ["84", "135", "156", "205"],
    answer: "C",
    answerText: "156 estudiantes",
    explanation: "En la tarde estuvo el 65 % (100 % - 35 %). El 65 % de 240 es 0,65 × 240 = 156. La trampa: 84 es el 35 %, los de la mañana. Lee bien qué te preguntan.",
    competence: "Competencia: formulación y ejecución.",
  },
  "reto-lectura-critica": {
    area: "Lectura Crítica",
    color: TEST.lectura_critica,
    fragment: "«Leer no es pasar los ojos por las palabras: es conversar con quien escribió, aceptarle unas ideas y discutirle otras.»",
    question: "Según el fragmento, leer es principalmente:",
    options: ["memorizar lo que dice el autor.", "dialogar con las ideas del autor.", "repetir el texto en voz alta.", "leer rápido para terminar."],
    answer: "B",
    answerText: "Dialogar con las ideas del autor",
    explanation: "El fragmento compara leer con conversar: aceptar unas ideas y discutir otras. Eso es dialogar. A y C hablan de repetir, justo lo que el texto dice que no es leer.",
    competence: "Competencia: identificar y entender los contenidos locales del texto.",
  },
};

const retoClose = {
  bg: C.tinta,
  ic: icon.bank,
  title: "¿Quieres más como esta?",
  body: "En Banco ExamHub hay preguntas tipo Saber 11 de las 5 pruebas, listas para tu próximo simulacro. Comenta tu respuesta antes de deslizar.",
  cta: "Pide tu simulacro gratis",
};

// ---------------------------------------------------------------------
//  Carruseles educativos y de producto
// ---------------------------------------------------------------------

const CAROUSELS = {
  "banco-examhub": [
    { bg: C.tinta, cover: true, title: "Banco ExamHub: el simulacro ya está hecho.", body: "Preguntas tipo Saber 11 para todos los colegios. Así funciona." },
    { bg: C.papel, ic: icon.bank, title: "Las 5 pruebas", body: "Lectura Crítica, Matemáticas, Sociales, Ciencias e Inglés. Preguntas sueltas y lecturas completas, con su justificación." },
    { bg: C.papel, ic: icon.bulb, title: "Filtra a tu medida", body: "Por competencia, dificultad o tema. Abre cada pregunta y revísala antes de usarla." },
    { bg: C.papel, ic: icon.chart, title: "Simulacro automático", body: "Un clic y ExamHub arma la mezcla de un Saber 11: las 5 pruebas en una proporción parecida a la prueba real." },
    { bg: C.papel, ic: icon.print, title: "Cópialas a tu banco", body: "Edítalas, júntalas con tus preguntas e imprime el simulacro con hojas personalizadas." },
    { bg: C.tinta, ic: icon.school, title: "Crece con los profes", body: "Aporta tus preguntas: las revisamos y quedan disponibles para todos los colegios.", cta: "Pide tu simulacro gratis" },
  ],
  "banco-con-ia": [
    { bg: C.lapiz, cover: true, title: "Crea tu banco de preguntas con IA, gratis.", body: "De cualquier tema, en carpetas, listo para imprimir. Guárdalo." },
    { bg: C.papel, title: "1. Elige qué necesitas", body: "Prueba, tema, grado, cantidad de preguntas y dificultad. ExamHub arma el prompt por ti." },
    { bg: C.papel, title: "2. Cópialo en tu IA", body: "Pégalo en ChatGPT, Gemini o Claude. Sirve la versión gratuita de cualquiera." },
    { bg: C.papel, title: "3. Pega la respuesta", body: "ExamHub la convierte en carpetas con preguntas, opciones, respuesta y justificación." },
    { bg: C.papel, title: "¿Ya las tienes en Word?", body: "También las convierte: pega tu documento y quedan organizadas en tu banco." },
    { bg: C.tinta, ic: icon.phone, title: "Revisa e imprime", body: "Ajusta lo que quieras, arma el examen y califícalo con el celular.", cta: "Pruébalo gratis" },
  ],
  "errores-simulacro": [
    { bg: C.tinta, cover: true, title: "5 errores al hacer un simulacro Saber 11.", body: "Y cómo evitarlos. Compártelo con tu área." },
    { bg: C.papel, title: "1. Calificar semanas después", body: "La retroalimentación sirve si llega mientras el tema está fresco. Devuelve los resultados la misma semana." },
    { bg: C.papel, title: "2. Mirar solo la nota", body: "Un 60 no dice qué reforzar. Mira las competencias: ahí está el plan de clase." },
    { bg: C.papel, title: "3. Una sola forma para todos", body: "En salones llenos, el mismo orden invita a copiar. Usa varias formas del mismo examen." },
    { bg: C.papel, title: "4. No contarle a las familias", body: "Un boletín claro convierte la casa en aliada del colegio." },
    { bg: C.papel, title: "5. No comparar simulacros", body: "Un simulacro es una foto; tres son una película. Compara el avance de cada grupo." },
    { bg: C.tinta, ic: icon.chart, title: "ExamHub te ayuda con los 5", body: "Calificación en minutos, informes por competencia, varias formas y boletines para las familias.", cta: "Pide tu simulacro gratis" },
  ],
  "tips-lectura-critica": [
    { bg: C.lapiz, cover: true, title: "4 tips para Lectura Crítica.", body: "Para compartir con tus estudiantes de 10 y 11." },
    { bg: C.papel, title: "1. Lee primero la pregunta", body: "Así sabes qué buscar en el texto y no lo lees dos veces sin rumbo." },
    { bg: C.papel, title: "2. ¿Qué tipo de texto es?", body: "Un cuento, una columna de opinión o una infografía piden cosas distintas. Pregúntate qué quiere lograr el autor." },
    { bg: C.papel, title: "3. Responde con el texto", body: "No con lo que tú sabes del tema. La respuesta correcta siempre se puede sostener con el fragmento." },
    { bg: C.papel, title: "4. Ojo con los absolutos", body: "Opciones con «siempre», «nunca» o «todos» suelen exagerar lo que el texto dice." },
    { bg: C.tinta, ic: icon.bulb, title: "Practica con simulacros", body: "En Banco ExamHub hay lecturas tipo Saber 11 listas para tu próxima práctica.", cta: "Guárdalo y compártelo" },
  ],
};

// ---------------------------------------------------------------------
//  Historias 9:16
// ---------------------------------------------------------------------

const logoStory = (onDark) => `<g transform="translate(90 1700)">${inlineLogo(0, 0, 64, onDark ? "negative" : "positive", onDark ? C.papel : C.tinta).svg}</g>`;

const STORIES = {
  "historia-4-reto-del-dia": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.lapiz}"/>` +
    label(m, "Reto del día · Matemáticas", 90, 260, C.tinta, 34) +
    P(m, F.sora700, "El 35 % de 240 estudiantes presentó el simulacro en la mañana. ¿Cuántos lo presentaron en la tarde?", 90, 480, 78, C.tinta, { maxW: 900, lh: 1.12, tracking: -0.03 }).svg +
    stickerBox(m, "[Sticker de cuestionario]", 1180, C.tinta) +
    K.T(m, F.atk400, "Opciones: 84 · 135 · 156 · 205", 90, 1420, 40, C.tinta) +
    logoStory(false),
  "historia-5-respuesta": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.papel}"/>` +
    label(m, "Respuesta del reto", 90, 260, C.tinta, 34) +
    K.T(m, F.sora700, "156", 90, 640, 300, C.aprobado, -0.04) +
    P(m, F.atk400, "En la tarde estuvo el 65 %: 0,65 × 240 = 156. Si marcaste 84, calculaste los de la mañana. Lee bien qué te preguntan.", 90, 820, 52, SUB_LIGHT, { maxW: 900, lh: 1.32 }).svg +
    logoStory(false),
  "historia-6-banco": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.tinta}"/>` +
    mark("negative", { x: 90, y: 260, size: 220 }) +
    K.T(m, F.sora700, "Nuevo:", 90, 720, 110, C.papel, -0.04) +
    P(m, F.sora700, "Banco ExamHub", 90, 850, 110, C.lapiz, { maxW: 900, lh: 1.05, tracking: -0.04 }).svg +
    P(m, F.atk400, "Preguntas tipo Saber 11 y simulacros automáticos para tu colegio.", 90, 1100, 50, SUB_DARK, { maxW: 900, lh: 1.3 }).svg +
    stickerBox(m, "[Sticker de enlace]", 1400, C.papel) +
    logoStory(true),
  "historia-7-preguntas": (m) =>
    `<rect width="${SW}" height="${SH}" fill="${C.tinta}"/>` +
    label(m, "Caja de preguntas", 90, 260, C.lapiz, 34) +
    P(m, F.sora700, "Pregúntanos lo que quieras sobre el Saber 11.", 90, 520, 104, C.papel, { maxW: 900, lh: 1.08, tracking: -0.04 }).svg +
    stickerBox(m, "[Sticker de preguntas]", 1180, C.papel) +
    logoStory(true),
};

// ---------------------------------------------------------------------
//  Escribir
// ---------------------------------------------------------------------

function build() {
  const covers = {};
  for (const [name, draw] of Object.entries(FEED)) covers[name] = out(`08-feed-mes-2/${name}`, W, H, draw);

  for (const [name, r] of Object.entries(RETOS)) {
    const dir = `09-carruseles-mes-2/${name}`;
    covers[name] = out(`${dir}/lamina-1`, W, H, (m) => retoQuestion(m, r, 3));
    out(`${dir}/lamina-2`, W, H, (m) => retoAnswer(m, r, 3));
    out(`${dir}/lamina-3`, W, H, (m) => slide(m, 3, 3, retoClose));
  }
  for (const [name, slides] of Object.entries(CAROUSELS)) {
    slides.forEach((s, i) => {
      const svg = out(`09-carruseles-mes-2/${name}/lamina-${i + 1}`, W, H, (m) => slide(m, i + 1, slides.length, s));
      if (i === 0) covers[name] = svg;
    });
  }
  for (const [name, draw] of Object.entries(STORIES)) out(`10-historias-mes-2/${name}`, SW, SH, draw);

  // Vista del perfil al terminar el mes (lo último publicado, arriba a la izquierda).
  const order = [
    "10-banco-examhub", "reto-matematicas", "13-ya-no-vas-a",
    "banco-examhub", "11-ia-gratis", "12-mito-realidad",
    "errores-simulacro", "15-cuatro-formas", "reto-lectura-critica",
    "14-boletin-familias", "banco-con-ia", "16-ya-es-app",
    "tips-lectura-critica", "17-pregunta-profes",
  ];
  const last9 = order.slice(-9).reverse().map((k) => covers[k]);
  const cw = 360;
  const ch = 480;
  let grid = `<rect width="${cw * 3 + 8}" height="${ch * 3 + 8}" fill="#FFFFFF"/>`;
  last9.forEach((svg, i) => {
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const x = (i % 3) * (cw + 4);
    const y = Math.floor(i / 3) * (ch + 4);
    grid += `<svg x="${x}" y="${y}" width="${cw}" height="${ch}" viewBox="0 ${(H - W * (4 / 3)) / 2} ${W} ${W * (4 / 3)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  });
  png(svgDoc(cw * 3 + 8, ch * 3 + 8, grid), 1088, path.join(OUT, "08-feed-mes-2", "00-vista-del-perfil.png"));
  console.log("Mes 2 generado en docs/marketing/redes/");
}

build();
