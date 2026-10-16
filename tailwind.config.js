/**
 * Los colores leen variables CSS (src/theme-colors.css, generado por
 * scripts/gen-theme.js): el modo oscuro y la paleta de marca elegida
 * solo cambian variables, sin tocar los templates.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTES = [
  "slate", "gray", "red", "orange", "amber", "yellow", "green", "emerald",
  "teal", "sky", "blue", "indigo", "violet", "purple", "rose", "brand", "accent",
];
const varColors = Object.fromEntries(
  PALETTES.map((name) => [
    name,
    Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`])),
  ])
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        // Marca: Atkinson Hyperlegible para textos, Sora para títulos.
        sans: ["'Atkinson Hyperlegible'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        // Serif para textos editoriales (lecturas largas)
        serif: ["'Source Serif Pro'", "'Times New Roman'", "serif"],
      },
      colors: varColors,
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        card: "0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
        elevated:
          "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    // Tema único de marca + fallback claro de DaisyUI por si algo falla.
    themes: [
      {
        examhub: {
          primary: "#1e2b74",
          "primary-content": "#ffffff",
          secondary: "#ffc531",
          "secondary-content": "#ffffff",
          accent: "#10b981",
          "accent-content": "#ffffff",
          neutral: "#1f2937",
          "neutral-content": "#f1f5f9",
          "base-100": "#ffffff",
          "base-200": "#f6f3ea",
          "base-300": "#e6e1d3",
          "base-content": "#1c1e26",
          info: "#0ea5e9",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          "--rounded-box": "0.75rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "0.5rem",
          "--btn-text-case": "none",
          "--border-btn": "1px",
        },
      },
      {
        "examhub-dark": {
          primary: "#4352ae",
          "primary-content": "#ffffff",
          secondary: "#f59e0b",
          "secondary-content": "#0f172a",
          accent: "#10b981",
          "accent-content": "#ffffff",
          neutral: "#1e293b",
          "neutral-content": "#e2e8f0",
          "base-100": "#0f172a",
          "base-200": "#020617",
          "base-300": "#1e293b",
          "base-content": "#e2e8f0",
          info: "#38bdf8",
          success: "#34d399",
          warning: "#fbbf24",
          error: "#f87171",
          "--rounded-box": "0.75rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "0.5rem",
          "--btn-text-case": "none",
          "--border-btn": "1px",
        },
      },
      "light",
    ],
  },
};
