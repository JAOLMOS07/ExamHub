/**
 * Convierte los colores fijos (#rrggbb) de un CSS a variables del tema
 * (`rgb(var(--c-slate-200))`). Uso único durante la migración al modo
 * oscuro; se deja por si se agregan estilos nuevos con hex.
 *
 *   node scripts/css-hex-to-vars.js src/styles.css
 *
 * Reglas: el índigo de marca → --c-brand-*; el blanco de fondos y
 * bordes → --c-surface; el blanco de textos se queda blanco.
 */
const fs = require("fs");
const colors = require("tailwindcss/colors");

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ORDER = ["slate", "indigo", "violet", "blue", "emerald", "amber", "red", "orange", "rose", "sky", "teal", "green", "gray"];
const byHex = new Map();
for (const name of ORDER) {
  for (const s of SHADES) {
    const hex = colors[name][s].toLowerCase();
    if (!byHex.has(hex)) byHex.set(hex, `${name === "indigo" ? "brand" : name}-${s}`);
  }
}
// Tonos sueltos que no son de Tailwind.
const EXTRA = { "#e9edf3": "slate-200", "#f5f7ff": "brand-50" };

const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").split("\n");
let changed = 0;
const missing = new Set();
const out = lines.map((line) => {
  // Las variables heredadas de :root y los comentarios se dejan.
  if (/^\s*--brand-|^\s*\/?\*/.test(line)) return line;
  const prop = (line.match(/^\s*([a-z-]+)\s*:/) || [])[1] || "";
  return line.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) => {
    let hex = m.toLowerCase();
    if (hex.length === 4) hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
    if (hex === "#ffffff") {
      if (prop === "color") return m;
      changed++;
      return "rgb(var(--c-surface))";
    }
    if (hex === "#000000") return m;
    const key = EXTRA[hex] || byHex.get(hex);
    if (!key) {
      missing.add(hex);
      return m;
    }
    changed++;
    return `rgb(var(--c-${key}))`;
  });
});
fs.writeFileSync(file, out.join("\n"));
console.log(`${changed} colores convertidos`, missing.size ? `sin equivalente: ${[...missing].join(", ")}` : "");
