/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Roboto",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // Serif para textos editoriales (lecturas largas)
        serif: ["'Source Serif Pro'", "'Times New Roman'", "serif"],
      },
      colors: {
        // Paleta de marca ExamHub — sobria, académica, moderna.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca", // primario
          800: "#3730a3",
          900: "#312e81",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706", // ámbar lecturas/destaque
          700: "#b45309",
        },
      },
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
          primary: "#4338ca",
          "primary-content": "#ffffff",
          secondary: "#d97706",
          "secondary-content": "#ffffff",
          accent: "#10b981",
          "accent-content": "#ffffff",
          neutral: "#1f2937",
          "neutral-content": "#f1f5f9",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#e2e8f0",
          "base-content": "#0f172a",
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
      "light",
    ],
  },
};
