# ExamHub — Kit de marca

Guía visual completa (concepto, logo, color, tipografía, voz y
aplicaciones): https://claude.ai/artifact/TGcM6B8P11GMVyuZkopG1j

Todo lo de esta carpeta se regenera con:

```bash
cd scripts/brand && npm install && node build-brand-kit.js
```

(también actualiza los íconos de la app en `src/assets/icons/` y `src/favicon.ico`).

## El concepto: el check de burbujas

Una cuadrícula de 4 × 3 burbujas, como un bloque de la hoja de respuestas
del ICFES. Cuatro burbujas marcadas dibujan un ✓. La última, en amarillo
lápiz, es el momento en que ExamHub lee la marca.

Eslogan principal: **Del lápiz al resultado, en segundos.**

## Qué hay aquí

| Carpeta | Contenido | Para qué |
|---|---|---|
| `logo/` | SVG con el texto en curvas: horizontal, apilado, símbolo, símbolo simple (≤ 32 px), cada uno en positivo, negativo, negro y blanco | Web, documentos, imprenta. No necesitan fuentes instaladas |
| `logo/png/` | Los mismos en PNG (2000 px el horizontal, 1024/512/256 el símbolo) | Word, PowerPoint, Canva, WhatsApp |
| `redes/` | Publicaciones listas en PNG | Subir tal cual |
| `redes/editables/` | Las mismas en SVG con **texto editable** | Cambiar textos y cifras (ver abajo) |
| `tarjetas/` | Frente, reverso y tarjeta de "Docente embajador" (85 × 55 mm + 3 mm de rebase) | Imprenta |
| `color/` | `tokens.json`, `paleta.css`, `examhub.gpl` (Inkscape/GIMP) y `paleta.png` | Diseño y desarrollo |
| `app/` | Ícono de la app 1024 px | Tiendas de apps, perfiles |

## Colores

| Nombre | Hex | Uso |
|---|---|---|
| Tinta | `#16205A` | Principal (≈ 50 %): fondos de marca, botones, títulos |
| Lápiz | `#FFC531` | Acento (≈ 10 %): la burbuja marcada, cifras, llamados a la acción. Sobre él se escribe con Tinta, nunca en blanco |
| Papel | `#F6F3EA` | Fondo (≈ 30 %) |
| Grafito | `#1C1E26` | Texto y piezas a una tinta (hojas de respuestas, fotocopias) |
| Aprobado | `#1F8A5B` | Aciertos |
| Borrador | `#F2789F` | Errores y alertas, con moderación |

Imprenta: Tinta en CMYK 100 88 20 35; Lápiz ≈ Pantone 123 C.

## Tipografía (gratis en Google Fonts)

- **Sora** 600/700: títulos, logo y cifras grandes. Interletrado −2 % a −4 %.
- **Atkinson Hyperlegible** 400/700: textos, preguntas y reportes.
- **JetBrains Mono**: códigos y datos tabulares (opcional).

Instálalas en tu computador (fonts.google.com) para editar las plantillas.

## Cómo editar las plantillas (todo gratis)

- **Figma** (figma.com): arrastra el `.svg` de `editables/`. El texto queda
  editable y Figma ya trae Sora y Atkinson. Exporta en PNG 1×.
- **Canva**: sube el PNG como fondo y escribe encima con Sora, o recrea la
  pieza con los colores de arriba (Canva › Marca › paleta). Canva no edita
  el texto de un SVG.
- **Inkscape** (inkscape.org): para las tarjetas. Abre el SVG de
  `tarjetas/editables/`, cambia los datos, selecciona todo › Trayecto ›
  Objeto a trayecto (convierte el texto en curvas) y guarda como PDF para
  la imprenta.

## Reglas rápidas

- No girar, deformar, recolorear ni reordenar las burbujas del símbolo.
- Zona de respeto: una burbuja alrededor del logo. Mínimo 24 px / 8 mm.
- Por debajo de 32 px, el símbolo simple.
- En texto corrido se escribe **ExamHub**; **examhub** solo dentro del logo.
- Tuteamos, en español de Colombia; la cifra primero; nunca culpamos al estudiante.
