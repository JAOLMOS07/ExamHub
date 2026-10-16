// @ts-check
import { defineConfig } from "astro/config";

/**
 * Dirección pública del sitio (canonical, sitemap, Open Graph).
 * 1. SITE_URL si la defines (ej. con tu dominio propio).
 * 2. En Vercel, el dominio de producción que Vercel entrega al construir.
 * 3. En local, localhost.
 */
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:4321");

export default defineConfig({
  site,
  trailingSlash: "never",
  build: { inlineStylesheets: "always", format: "file" },
});
