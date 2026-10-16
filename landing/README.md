# ExamHub — Landing page

Sitio estático en [Astro](https://astro.build) 5, sin frameworks de UI:
HTML y CSS, con unas pocas líneas de JavaScript para lo interactivo.
Carga muy rápido en cualquier celular y se publica gratis.

## Qué tiene

- **Hero animado**: la hoja de respuestas se llena, pasa el celular y aparece la nota.
- **Pruébalo aquí**: mini simulacro jugable de 5 preguntas (una por prueba del Saber 11); se responde en las tarjetas o en la hoja y se "califica" como en ExamHub.
- **Cómo funciona**: 4 pasos con una línea que se llena al bajar.
- **Calculadora de ahorro**: horas, jornadas y pesos que se ahorran calificando con el celular.
- **Funciones** (cuadrícula tipo bento), **precios**, **preguntas frecuentes** y cierre con la oferta de colegios fundadores.
- Respeta "reducir movimiento" del sistema, se usa con teclado y funciona desde 320 px de ancho.

## Antes de publicar

Edita `src/config.ts`:

- `whatsapp`: tu número de WhatsApp Business con indicativo (ej. `573001234567`).
- `email`, `instagram`, `tiktok`.
- `PLANS`: precios y beneficios.

Y en `astro.config.mjs`, `site` con tu dominio definitivo.

## Comandos

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # genera dist/
npm run preview   # sirve dist/
```

Requiere Node 18.20+ o 20.3+.

## Publicar gratis

Cualquiera de estas sirve. Si vas a cobrar, evita el plan Hobby de Vercel (es para uso no comercial):

- **Cloudflare Pages** (recomendado: gratis y permite uso comercial). Nuevo proyecto › conectar el repositorio › directorio raíz `landing`, comando `npm run build`, salida `dist`.
- **Netlify**: mismo esquema (base `landing`, build `npm run build`, publish `landing/dist`).
- **Firebase Hosting**: `npm run build` y `firebase deploy --only hosting` con `public: "landing/dist"` en un sitio aparte del de la app.

Con un dominio propio (`examhub.co` o similar, unos $60.000 al año) la landing va en la raíz y la app en `app.` del mismo dominio.

## Posicionamiento (SEO)

- **Dirección del sitio**: se toma sola del dominio de producción de Vercel. Con dominio propio, crea en Vercel la variable de entorno `SITE_URL=https://tudominio.co` y vuelve a desplegar.
- `sitemap.xml` y `robots.txt` se generan solos (incluyen las guías).
- Datos estructurados (schema.org): organización, la app con sus precios, preguntas frecuentes (FAQPage), artículos y migas de pan.
- **Guías** en `src/pages/guias/` (contenido que atrae búsquedas): calculadora del puntaje global, cómo leer los resultados y cómo hacer un simulacro. Para una guía nueva: agrégala en `src/data/guides.ts` y crea su página.
- Lighthouse (celular, octubre 2026): 100 en rendimiento, accesibilidad, buenas prácticas y SEO.

**Después de publicar**:
1. Google Search Console (gratis): agrega la propiedad con tu dominio, verifica y envía `https://tudominio/sitemap.xml`.
2. Bing Webmaster Tools: importa desde Search Console.
3. Google Business Profile: usa la URL de la landing como sitio web.
