# ExamHub

Plataforma de evaluación tipo ICFES para colegios: banco institucional de preguntas,
simulacros impresos con hoja de respuestas de lectura óptica, calificación con la
cámara del celular y reportes por prueba, competencia y pregunta.

- **Rediseño v2 (producto y arquitectura):** [docs/REDISENO-v2.md](docs/REDISENO-v2.md)
- **Despliegue:** [docs/DEPLOY-v2.md](docs/DEPLOY-v2.md)
- **Entorno local desde cero:** [src/SETUP.md](src/SETUP.md)

## Comandos

```bash
npm start              # servidor de desarrollo en http://localhost:4200
npm run build          # build de producción
npm run test:domain    # tests de la capa de dominio (Jest)
npm --prefix functions run build   # compila las Cloud Functions de IA
```

## Estructura

```
src/app/core/domain/     lógica pura y testeada: formas, puntajes, psicometría,
                         layout de la hoja OMR, taxonomía Saber 11, CSV
src/app/core/models/     modelos (org.model, assessment.model, folder.model…)
src/app/core/services/   acceso a Firebase por organización (TenantService,
                         ExamService, GradingService, OrgService, OmrService, AiService)
src/app/ui/              pantallas Angular
functions/               Cloud Functions de IA (Claude)
firestore.rules          permisos por organización y rol
```
