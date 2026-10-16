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
const DARK_NEUTRAL = { 50: 950, 100: 800, 200: 700, 300: 600, 400: 500, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 50 };
const DARK_COLORED = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 500, 600: 500, 700: 400, 800: 300, 900: 200, 950: 100 };
/** La marca se usa mucho como fondo de botones con texto blanco: no aclarar tanto. */
const DARK_BRAND = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 400, 600: 500, 700: 500, 800: 600, 900: 300, 950: 200 };

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
// Marca por defecto (índigo) y acento (ámbar).
for (const s of SHADES) {
  light.push(`  --c-brand-${s}: ${rgb(colors.indigo[s])};`);
  dark.push(`  --c-brand-${s}: ${rgb(colors.indigo[DARK_BRAND[s]])};`);
  light.push(`  --c-accent-${s}: ${rgb(colors.amber[s])};`);
  dark.push(`  --c-accent-${s}: ${rgb(colors.amber[DARK_COLORED[s]])};`);
}
// Superficies (lo que en claro es blanco) y fondo de página.
light.push("  --c-surface: 255 255 255;", "  --c-page: 248 250 252;", "  --c-ink: 15 23 42;");
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
  "export const BRAND_PRESETS: { id: string; label: string; scale: Scale }[] = [",
  ...PRESETS.map(([id, label, src]) => {
    const scale = Object.fromEntries(SHADES.map((s) => [s, rgb(colors[src][s])]));
    return `  { id: ${JSON.stringify(id)}, label: ${JSON.stringify(label)}, scale: ${JSON.stringify(scale)} },`;
  }),
  "];",
  "",
];
fs.mkdirSync(path.join(__dirname, "..", "src", "app", "core", "theme"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "src", "app", "core", "theme", "palettes.ts"), ts.join("\n"));
console.log("tema generado");
