/**
 * Genera las variables de color del tema (claro y oscuro).
 *
 *   node scripts/gen-theme.js
 *
 * Salida:
 *   src/theme-colors.css               variables --c-<paleta>-<tono> para :root y html.dark
 *   src/app/core/theme/palettes.ts     paletas de marca elegibles (personalización)
 *
 * tailwind.config.js usa esas variables (`rgb(var(--c-slate-500) / <alpha-value>)`),
 * así que cambiar de tema solo cambia variables: ningún template se toca.
 */
const fs = require("fs");
const path = require("path");
const colors = require("tailwindcss/colors");

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const NEUTRALS = ["slate", "gray"];
const COLORED = ["red", "orange", "amber", "yellow", "green", "emerald", "teal", "sky", "blue", "indigo", "violet", "purple", "rose"];

/** Tono que se usa en modo oscuro en lugar de cada tono claro. */
// 400 se queda en 400: los textos secundarios (text-slate-400) necesitan contraste.
const DARK_NEUTRAL = { 50: 950, 100: 800, 200: 700, 300: 600, 400: 400, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 50 };
const DARK_COLORED = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 500, 600: 500, 700: 400, 800: 300, 900: 200, 950: 100 };
/**
 * Marca en modo oscuro: los tonos que se usan como texto (600–900) pasan a
 * tonos claros para que se lean sobre fondo oscuro. Los fondos de botón
 * no usan esta escala: usan --c-brand-btn (abajo), elegido por contraste.
 */
const DARK_BRAND = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 400, 600: 300, 700: 300, 800: 200, 900: 200, 950: 100 };

/** Luminancia relativa (WCAG) de "#rrggbb". */
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const contrastWithWhite = (hex) => 1.05 / (luminance(hex) + 0.05);

/**
 * Fondo de botón en modo oscuro: el tono más claro (500 → 700) que aún
 * deja el texto blanco con contraste ≥ 4,5; así el botón se distingue del
 * fondo oscuro sin perder legibilidad.
 */
function darkButton(scale) {
  for (const s of [500, 600, 700, 800]) {
    if (contrastWithWhite(scale[s]) >= 4.5) return { btn: scale[s], hover: scale[Math.max(400, s - 100)] };
  }
  return { btn: scale[800], hover: scale[700] };
}

/** Tinta: el azul de ExamHub (#16205A en el 800). */
const TINTA = {
  50: "#eff1fb", 100: "#dfe3f6", 200: "#c0c7ec", 300: "#97a3dd", 400: "#6877c8", 500: "#4352ae",
  600: "#2b3a91", 700: "#1e2b74", 800: "#16205a", 900: "#10184a", 950: "#0a0f30",
};
const palette = (src) => (src === "tinta" ? TINTA : colors[src]);

const rgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
};

const lines = [];
const light = [];
const dark = [];
for (const name of [...NEUTRALS, ...COLORED]) {
  const map = NEUTRALS.includes(name) ? DARK_NEUTRAL : DARK_COLORED;
  for (const s of SHADES) {
    light.push(`  --c-${name}-${s}: ${rgb(colors[name][s])};`);
    dark.push(`  --c-${name}-${s}: ${rgb(colors[name][map[s]])};`);
  }
}
// Marca por defecto (Tinta) y acento (ámbar).
for (const s of SHADES) {
  light.push(`  --c-brand-${s}: ${rgb(TINTA[s])};`);
  dark.push(`  --c-brand-${s}: ${rgb(TINTA[DARK_BRAND[s]])};`);
  light.push(`  --c-accent-${s}: ${rgb(colors.amber[s])};`);
  dark.push(`  --c-accent-${s}: ${rgb(colors.amber[DARK_COLORED[s]])};`);
}
// Fondo de botones y chips activos de la marca.
light.push(`  --c-brand-btn: ${rgb(TINTA[700])};`, `  --c-brand-btn-hover: ${rgb(TINTA[800])};`);
{
  const b = darkButton(TINTA);
  dark.push(`  --c-brand-btn: ${rgb(b.btn)};`, `  --c-brand-btn-hover: ${rgb(b.hover)};`);
}
// Superficies (lo que en claro es blanco) y fondo de página.
light.push("  --c-surface: 255 255 255;", "  --c-page: 246 243 234;", "  --c-ink: 28 30 38;");
dark.push(`  --c-surface: ${rgb(colors.slate[900])};`, `  --c-page: ${rgb(colors.slate[950])};`, `  --c-ink: ${rgb(colors.slate[50])};`);

lines.push("/* Generado por scripts/gen-theme.js — no editar a mano. */");
lines.push(":root {", ...light, "}");
lines.push("html.dark {", "  color-scheme: dark;", ...dark, "}");
// Elementos que ya son oscuros en modo claro (bandeja del examen, avisos):
// dentro conservan los neutros del modo claro para no invertirse.
lines.push(
  "html.dark .eh-fixed-palette {",
  ...light.filter((l) => /--c-(slate|gray)-/.test(l)),
  "}"
);
fs.writeFileSync(path.join(__dirname, "..", "src", "theme-colors.css"), lines.join("\n") + "\n");

// Paletas de marca para la personalización.
const PRESETS = [
  ["tinta", "Tinta ExamHub", "tinta"],
  ["indigo", "Índigo", "indigo"],
  ["blue", "Azul", "blue"],
  ["sky", "Cielo", "sky"],
  ["teal", "Verde azulado", "teal"],
  ["emerald", "Esmeralda", "emerald"],
  ["violet", "Violeta", "violet"],
  ["rose", "Rosa", "rose"],
  ["orange", "Naranja", "orange"],
  ["slate", "Grafito", "slate"],
];
const ts = [
  "/* Generado por scripts/gen-theme.js — no editar a mano. */",
  "",
  "export type Scale = Record<number, string>;",
  "",
  `export const SHADES = ${JSON.stringify(SHADES)};`,
  `export const DARK_BRAND: Record<number, number> = ${JSON.stringify(DARK_BRAND)};`,
  "",
  "/** Paletas de marca: tono → \"r g b\". */",
  "export const BRAND_PRESETS: { id: string; label: string; scale: Scale; darkBtn: { btn: string; hover: string } }[] = [",
  ...PRESETS.map(([id, label, src]) => {
    const scale = Object.fromEntries(SHADES.map((s) => [s, rgb(palette(src)[s])]));
    const b = darkButton(palette(src));
    const darkBtn = { btn: rgb(b.btn), hover: rgb(b.hover) };
    return `  { id: ${JSON.stringify(id)}, label: ${JSON.stringify(label)}, scale: ${JSON.stringify(scale)}, darkBtn: ${JSON.stringify(darkBtn)} },`;
  }),
  "];",
  "",
];
fs.mkdirSync(path.join(__dirname, "..", "src", "app", "core", "theme"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "src", "app", "core", "theme", "palettes.ts"), ts.join("\n"));
console.log("tema generado");
