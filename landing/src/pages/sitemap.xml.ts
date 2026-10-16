import type { APIRoute } from "astro";
import { GUIDES } from "../data/guides";

/** Mapa del sitio para Google y Bing. */
export const GET: APIRoute = ({ site }) => {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { path: "/", priority: "1.0", lastmod: today },
    { path: "/guias", priority: "0.8", lastmod: today },
    ...GUIDES.map((g) => ({ path: `/guias/${g.slug}`, priority: "0.7", lastmod: g.updated })),
  ];
  const urls = pages
    .map(
      (p) =>
        `<url><loc>${new URL(p.path, site).href.replace(/\/$/, p.path === "/" ? "/" : "")}</loc><lastmod>${p.lastmod}</lastmod><priority>${p.priority}</priority></url>`
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } }
  );
};
