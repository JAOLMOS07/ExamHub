// @ts-check
import { defineConfig } from "astro/config";

// Sitio estático: se publica gratis en Vercel, Netlify o Firebase Hosting.
export default defineConfig({
  site: "https://examhub.co",
  build: { inlineStylesheets: "always" },
});
