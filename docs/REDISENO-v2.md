# ExamHub v2 — Rediseño de producto y arquitectura

> Objetivo: pasar de "herramienta para un docente" a **plataforma institucional de evaluación tipo ICFES**
> que se venda por colegio (y por redes/secretarías), con lógica más sólida y una capa de IA útil y controlada.

## Estado de implementación (rama `v2/rediseno`)

| Fase | Estado |
|---|---|
| 0. Fundaciones | ✅ Capa `core/domain/` pura con 34 tests (Jest). ⏳ Actualizar Angular y tests de reglas con emulador |
| 1. Multi-tenant | ✅ Organizaciones, roles, invitaciones, grupos, estudiantes (CSV/SIMAT), banco plano, reglas, migración v1 |
| 2. Simulacros ICFES | ✅ Taxonomía Saber 11, formas con semilla y snapshot, hoja multipágina con código, OMR generalizado, puntajes por prueba/competencia/global, reportes, boletines |
| 3. IA | ✅ Generar, revisar y alinear ítems; informe pedagógico; créditos por organización (detrás del flag `enableAi`) |
| 4. Analítica y expansión | ✅ Análisis de ítems por evaluación. ⏳ Evolución entre simulacros, portal de familias, modo online, Saber 3/5/9 |

Despliegue: ver [DEPLOY-v2.md](DEPLOY-v2.md).

---

## 1. Diagnóstico del MVP actual

| Área | Estado actual | Problema |
|---|---|---|
| Tenancy | Banco en `/{uid}/{folderId}/content/...` (colección raíz = UID) | No existe "colegio"; imposible compartir banco, roles o reportes institucionales |
| Banco | Árbol anidado de subcolecciones; `passageContext` copiado en cada pregunta | No se puede consultar por materia/competencia en todo el banco; borrado recursivo en cliente; lecturas desincronizadas |
| Taxonomía | `subject`, `grade` como texto libre; dificultad 1–3 | Sin competencias/afirmaciones/evidencias ICFES → sin reportes útiles |
| Armado de examen | `QuestionService` en memoria | Se pierde al recargar; no hay borrador ni historial |
| Clave de respuestas | `AnswerKey.answers: ["B","A",…]` | **No sabe qué ítem es cada posición** → no hay análisis por ítem, competencia ni área |
| Snapshot | El examen generado no guarda las preguntas | Editar el banco rompe reimpresión/auditoría |
| OMR | Máx. 36 preguntas (18×2), 1 página | Un simulacro Saber 11 tiene >100 preguntas por sesión |
| Estudiantes | `studentName` texto libre | Sin roster, sin histórico por estudiante, sin identificación automática |
| Calificación | Lineal `correct/total × maxScore` | Sin puntaje por prueba (0–100), sin global (0–500), sin niveles de desempeño |
| Planes | `planAtCreation: "free"` hardcodeado | Sin licenciamiento real |
| Código | Lógica de negocio en componentes (generate-exam-dialog: 1.114 líneas) | Difícil de testear y evolucionar; Angular 17 (fuera de soporte) |
| Backend | Ninguno (solo cliente + reglas) | No se puede: IA con llaves seguras, invitar docentes, agregados, licencias |
| Seguridad | Firma QR djb2 con sal en el cliente | Aceptable como "anti-tonto"; la seguridad real debe ser las reglas + backend |

Lo que **sí** vale oro y se conserva: generación de formas barajadas en PDF, hoja de respuestas con QR + fiduciales, OMR con OpenCV en el navegador, editor matemático (KaTeX/MathLive), importación de bancos, lecturas/contextos.

---

## 2. Propuesta de valor por segmento

| Segmento | Qué compra | Diferenciador |
|---|---|---|
| **Colegio** (cliente principal) | Licencia anual por estudiante | Simulacros Saber 11 / 9 / 5 / 3 institucionales en papel, calificados con el celular, con reportes por competencia y evolución entre simulacros |
| **Docente individual** | Freemium → Pro | Banco + generación + calificación rápida |
| **Red / Secretaría de Educación** | Multi-colegio | Comparativos entre instituciones, banco compartido |

Argumentos de venta al rector/coordinador:
1. **Funciona en papel y sin internet estable** (clave en zonas rurales). El celular del docente es el lector.
2. **Reportes con la misma estructura del ICFES** (pruebas → competencias → afirmaciones), con puntaje global estimado.
3. **Banco institucional** que crece año a año (el conocimiento no se va cuando el docente se va).
4. **IA que genera y revisa ítems tipo ICFES**, siempre con aprobación del docente.
5. **Cumplimiento Ley 1581 de 2012 (Habeas Data)** con datos de menores: datos mínimos, contrato de encargo de tratamiento, borrado por solicitud.

---

## 3. Modelo de dominio

### 3.1 Principio clave: todo pertenece a una organización

Un docente individual es **una organización de un solo miembro** ("espacio personal").
Así no hay dos modelos de datos: el upgrade de docente → colegio es mover/invitar, no migrar.

```
Organization (colegio)
 ├── Members (usuarios con rol: admin | coordinator | teacher)
 ├── AcademicYear → Groups (11-A, 11-B…) → Enrollments → Students
 ├── Bank: Folders, Stimuli (lecturas/contextos), Items (preguntas)
 ├── Assessments (quiz | simulacro)
 │     ├── Sections (una por prueba: Matemáticas, Lectura Crítica…)
 │     ├── Forms (versiones barajadas, con snapshot inmutable de ítems)
 │     └── Responses (una por estudiante × forma)
 └── Reports (agregados calculados en backend)

Catálogo global (de ExamHub): taxonomía ICFES + banco curado premium
```

### 3.2 Colecciones Firestore propuestas

```
/users/{uid}                              perfil, orgIds[], defaultOrgId
/orgs/{orgId}                             nombre, NIT, código DANE, ciudad, plan, seats, settings
/orgs/{orgId}/members/{uid}               role, subjects[], groupIds[], status
/orgs/{orgId}/invites/{inviteId}          email, role, expiresAt
/orgs/{orgId}/groups/{groupId}            year, grade (11), name ("11-A"), shift (jornada), campus (sede)
/orgs/{orgId}/students/{studentId}        code, fullName, groupId, year, active   ← importable desde SIMAT/CSV
/orgs/{orgId}/folders/{folderId}          parentId, name, path[] (para breadcrumbs y queries)
/orgs/{orgId}/stimuli/{stimulusId}        texto/imagen/tabla compartida por varios ítems
/orgs/{orgId}/items/{itemId}              PLANO (no anidado) → queries por área/competencia/grado
/orgs/{orgId}/assessments/{aId}           metadata, secciones, estado, grupos asignados
/orgs/{orgId}/assessments/{aId}/forms/{formId}          snapshot + permutación + clave
/orgs/{orgId}/assessments/{aId}/responses/{respId}      respuestas + puntajes calculados
/orgs/{orgId}/stats/{...}                 agregados escritos solo por Cloud Functions
/taxonomies/{taxonomyId}                  ej. "saber11-2026": pruebas, competencias, afirmaciones, evidencias
/catalog/items/{itemId}                   banco curado ExamHub (lectura según plan)
```

Roles vía **custom claims** (`token.orgs = { [orgId]: "admin" | "coordinator" | "teacher" }`), asignados por Cloud Function al aceptar invitación. Las reglas validan `request.auth.token.orgs[orgId]`.

### 3.3 Tipos principales (TypeScript)

```ts
type Role = "admin" | "coordinator" | "teacher";
type ItemKind = "mcq" | "true_false" | "open" | "numeric" | "matching";
type ItemStatus = "draft" | "in_review" | "approved" | "archived";
type ItemSource = "manual" | "import" | "ai" | "catalog";

interface Organization {
  id: string;
  name: string;
  nit?: string;
  daneCode?: string;          // código DANE del establecimiento
  city?: string;
  plan: "personal_free" | "personal_pro" | "school" | "network";
  seats: number;              // estudiantes licenciados
  aiCreditsMonthly: number;
  createdAt: number;
}

interface Student {
  id: string;
  code: string;               // código que el estudiante rellena en burbujas
  fullName: string;
  groupId: string;
  year: number;
  active: boolean;
  // NO guardamos documento de identidad en claro (Habeas Data)
}

/** Referencia a la taxonomía ICFES (o una propia del colegio). */
interface Alignment {
  taxonomyId: string;         // "saber11-2026"
  test: string;               // "matematicas" | "lectura_critica" | "sociales" | "ciencias" | "ingles"
  competency?: string;        // "formulacion_ejecucion"
  assertion?: string;         // afirmación
  evidence?: string;          // evidencia
  component?: string;         // ej. ciencias: "biologico" | "quimico" | "fisico" | "cts"
}

interface Item {
  id: string;
  orgId: string;
  folderId: string | null;
  stimulusId?: string;        // referencia, NO copia
  kind: ItemKind;
  stem: string;               // markdown + LaTeX
  media?: { url: string; path: string; alt?: string }[];
  options?: { id: string; text: string; rationale?: string }[]; // rationale = por qué el distractor es incorrecto
  correctOptionId?: string;   // una sola fuente de verdad (no `correct: boolean` por opción)
  numeric?: { value: number; tolerance: number };
  rubric?: string;            // para abiertas (y calificación asistida por IA)
  alignment?: Alignment;
  grade?: number;             // 3, 5, 9, 11…
  declaredDifficulty?: 1 | 2 | 3;
  stats?: ItemStats;          // calculado por backend con datos reales
  status: ItemStatus;
  source: ItemSource;
  ai?: { model: string; promptVersion: string; reviewedBy?: string };
  visibility: "private" | "org";
  createdBy: string;
  updatedAt: number;
  revision: number;
}

interface ItemStats {        // Teoría Clásica de los Tests
  n: number;                  // respuestas acumuladas
  pValue: number;             // proporción de aciertos (dificultad empírica)
  discrimination: number;     // correlación punto-biserial
  optionShare: Record<string, number>; // análisis de distractores
}

interface Assessment {
  id: string;
  orgId: string;
  title: string;
  type: "quiz" | "simulacro";
  taxonomyId?: string;
  sections: { id: string; test?: string; title: string; itemIds: string[] }[];
  groupIds: string[];
  status: "draft" | "published" | "closed";
  scoring: ScoringConfig;
  createdBy: string;
  createdAt: number;
}

/** Forma = versión impresa. Inmutable una vez publicada. */
interface Form {
  id: string;                 // "A", "B"…
  seed: number;               // RNG con semilla → reproducible
  itemsSnapshot: Item[];      // copia congelada de lo que se imprimió
  order: string[];            // itemIds en el orden de esta forma
  optionOrder: Record<string, string[]>; // itemId → orden de optionIds
  key: { itemId: string; letter: string | null }[]; // posición → ítem → letra
}

interface Response {
  id: string;
  formId: string;
  studentId?: string;         // resuelto por código en burbujas o selección manual
  answers: (string | null | "MULTI")[];
  manualScores?: Record<number, number>;
  source: "omr" | "assisted" | "mixed" | "online";
  scores?: {                  // calculado en backend (fuente de verdad)
    raw: number; total: number;
    byTest: Record<string, number>;        // 0–100
    byCompetency: Record<string, number>;  // % aciertos
    global?: number;                        // 0–500 estimado
    level?: Record<string, 1 | 2 | 3 | 4>;  // nivel de desempeño estimado
  };
  scannedBy: string;
  scannedAt: number;
}
```

### 3.4 Puntaje tipo ICFES

- Por prueba: escala 0–100.
- Global (Saber 11): `((LC×3) + (M×3) + (SC×3) + (CN×3) + (I×1)) / 13 × 5` → 0–500.
- Inglés: niveles A-, A1, A2, B1, B+.
- El ICFES usa TRI (teoría de respuesta al ítem); nosotros mostramos **"puntaje estimado"** con disclaimer explícito.
  - v2.0: transformación lineal + niveles de desempeño por umbrales configurables.
  - v2.x: modelo Rasch/1PL en Cloud Function cuando haya suficientes respuestas por ítem.

---

## 4. Arquitectura técnica

```
┌─────────────── Angular (actualizado a la versión LTS vigente) ───────────────┐
│  features/  (bank, assessments, scan, reports, org-admin, students)          │
│  data/      repositorios Firestore (único lugar que conoce las rutas)        │
│  domain/    TypeScript puro y testeable: barajado con semilla, clave,        │
│             puntajes, layout de la hoja OMR, psicometría                      │
│  workers/   Web Workers: generación de PDF, OMR (OpenCV)                     │
└──────────────────────────────────────────────────────────────────────────────┘
                │ Firestore (offline persistence)       │ callable functions
                ▼                                        ▼
┌──── Firestore + Storage ────┐        ┌──────────── Cloud Functions ────────────┐
│ reglas por org + rol        │◄──────►│ invitaciones y custom claims            │
│ datos de dominio            │        │ onResponseWrite → puntajes + agregados  │
└─────────────────────────────┘        │ estadísticas de ítems (programado)      │
                                       │ IA (Claude API) con cuotas por org      │
                                       │ licencias / seats / facturación         │
                                       │ migración v1 → v2                       │
                                       └─────────────────────────────────────────┘
```

### 4.1 Cambios de código concretos

1. **Capa `domain/` pura** extraída de los componentes:
   - `formBuilder.ts`: arma formas a partir de secciones, respeta grupos de estímulo, RNG con semilla (`mulberry32`) en lugar de `Math.random` → misma semilla = misma forma (reimpresión exacta).
   - `answerKey.ts`: clave por `itemId`, no solo letras.
   - `scoring.ts`: puntaje por prueba/competencia/global; abiertas con `manualScores`.
   - `answerSheetLayout.ts`: layout **dinámico** (N columnas, multipágina, bloque de código del estudiante en burbujas), sucesor de `omrLayout.const.ts`. Tanto el PDF como el OMR lo consumen (se mantiene la idea actual de fuente única de verdad).
   - `psychometrics.ts`: p-value, punto-biserial, distractores.
2. **Repositorios** (`ItemRepository`, `AssessmentRepository`…) que reciben `orgId` de un `TenantContext` (signal) → se elimina el patrón repetido `userUUID` + `onAuthStateChanged` de cada servicio.
3. **Sesión**: un único `AuthStore` con signals (`user`, `activeOrg`, `role`) + guards por rol.
4. **Borrador de examen persistido** (`assessments` con `status: draft`) en lugar de `QuestionService` en memoria.
5. **PDF y OMR en Web Workers** → la interfaz no se congela con exámenes grandes.
6. **Hoja de respuestas v2**: hasta ~120 ítems por página en 4–5 columnas, código del estudiante en burbujas (identificación automática contra el roster), QR protocolo v2 `EH|2|orgId|assessmentId|formId|page|total|sig`.
7. **Puntajes calculados en backend** (`onResponseWrite`): el cliente muestra una vista previa, pero la fuente de verdad es el servidor (consistencia + agregados).
8. **Tests**: unitarios para `domain/` (Jest, ya instalado), reglas con Firebase Emulator, e2e de los flujos crear examen → escanear → reporte.
9. **Actualizar Angular** (17 está fuera de soporte), completar la migración a standalone y quitar Karma o Jest (hoy conviven ambos).

---

## 5. IA aplicada a exámenes tipo ICFES

Todas las llamadas pasan por **Cloud Functions** (la API key nunca va al cliente), con cuota de créditos por organización según el plan y registro de uso.

Modelo: **Claude Opus 5.5** (`claude-opus-5-5`, configurable con `CLAUDE_MODEL`), con el nivel de esfuerzo
ajustado por tarea en lugar de cambiar de modelo.

| # | Funcionalidad | Entrada | Salida | Esfuerzo | Estado |
|---|---|---|---|---|---|
| 1 | **Generador de ítems ICFES** | prueba + competencia + grado + tema | ítems con 4 opciones, clave y justificación de cada distractor; entran "sin revisar" | alto | ✅ |
| 2 | **Generador de estímulos** | tema | contexto común + ítems asociados | alto | ✅ (opción del generador) |
| 3 | **Auto-etiquetado** | ítems sin alinear | prueba, competencia, dificultad | bajo | ✅ |
| 4 | **Revisor de calidad** | ítem | puntaje de calidad, alertas y alineación sugerida | medio | ✅ |
| 5 | **Digitalizar exámenes** | PDF o foto de un examen viejo | ítems estructurados | — | ⏳ |
| 6 | **Variantes isomorfas** | ítem aprobado | ítems paralelos | — | ⏳ |
| 7 | **Informes en lenguaje natural** | agregados de una evaluación/grupo | fortalezas, debilidades y acciones | medio | ✅ |
| 8 | **Calificación asistida de abiertas** | respuesta + rúbrica | puntaje sugerido | — | ⏳ |

Reglas de diseño:
- **Humano en el ciclo**: nada generado por IA entra a un examen sin `status: approved` y `reviewedBy`.
- **Salidas estructuradas** (JSON schema / tool use) validadas en el servidor antes de guardar.
- **Prompts versionados** (`promptVersion`) para poder medir calidad y comparar.
- **Ciclo de calidad**: con `ItemStats` reales se detectan ítems IA de baja discriminación → se usan para mejorar los prompts.
- No enviar datos personales de estudiantes al modelo: los informes usan agregados y seudónimos.
- Verificar los términos de uso antes de usar cuadernillos liberados del ICFES como ejemplos (few-shot).

---

## 6. Seguridad y cumplimiento

- Reglas de Firestore por `orgId` + rol (claims), probadas con el emulador.
- `stats/*` y `responses.scores` solo los escribe el backend.
- Docente: ve sus grupos; coordinador/admin: ve toda la institución.
- Habeas Data (Ley 1581/2012): datos mínimos del estudiante, política de tratamiento, contrato de encargo con el colegio, exportación y borrado por solicitud, TTL de imágenes de escaneo.
- Auditoría: `createdBy`, `updatedAt`, `revision` en entidades clave.

---

## 7. Modelo comercial sugerido

| Plan | Para | Incluye |
|---|---|---|
| Docente Free | 1 docente | banco personal, N exámenes/mes, OMR hasta 40 preguntas, créditos IA de prueba |
| Docente Pro | 1 docente | ilimitado, multipágina, IA mensual, plantillas |
| **Colegio** | por estudiante/año | docentes ilimitados, banco institucional, simulacros, roster/SIMAT, reportes por competencia, banco curado, IA por volumen |
| Red | secretarías/redes | multi-colegio, comparativos, soporte |

Estrategia de entrada: **piloto gratis de un simulacro para grado 11** → el reporte de resultados por competencia es lo que cierra la venta.

---

## 8. Migración desde v1

Script (Cloud Function de un solo uso o script con Admin SDK):
1. Por cada UID con datos: crear `orgs/{personalOrgId}` (plan `personal_free`) + member `admin`.
2. Recorrer el árbol `/{uid}/.../content` → `folders` (con `parentId`/`path`) + `items` planos; las lecturas pasan a `stimuli` y las preguntas guardan el `stimulusId`.
3. Mapear `subject`/`grade` de texto libre a `alignment.test` / `grade` numérico cuando sea posible (la IA de auto-etiquetado ayuda con el resto).
4. `/exams` → `assessments` + `forms` (sin `itemsSnapshot` para los viejos: se marcan como `legacy` y se pueden seguir calificando).
5. Durante la transición la app lee v2; v1 queda en solo lectura hasta validar.

---

## 9. Hoja de ruta

| Fase | Duración aprox. | Entregables |
|---|---|---|
| **0. Fundaciones** | 1–2 sem | Angular actualizado, capa `domain/` con tests, emulador + tests de reglas, CI |
| **1. Multi-tenant** | 3–4 sem | Organizaciones, miembros, invitaciones, roles, grupos, estudiantes (import CSV/SIMAT), nuevo modelo de ítems, migración |
| **2. Simulacros ICFES** | 3–4 sem | Taxonomía Saber 11, secciones, formas con snapshot, hoja OMR multipágina + código del estudiante, puntajes por prueba/competencia/global, reportes PDF por estudiante y grupo |
| **3. IA** | 3 sem | Generador de ítems, auto-etiquetado, revisor de calidad, informes; cuotas por plan |
| **4. Analítica y expansión** | continuo | Estadísticas de ítems, evolución entre simulacros, comparativos, portal para familias, modo online para estudiantes, Saber 3/5/9 |

---

## 10. Decisiones abiertas

- ¿Seguir en Firebase? **Recomendado sí** para v2 (ya hay inversión, offline nativo, OMR en cliente). Reconsiderar Postgres solo si los reportes analíticos crecen mucho (alternativa: exportar a BigQuery).
- ¿Modo online (estudiante responde en dispositivo) en v2 o después? Recomendado: después; el papel es el diferenciador.
- ¿Banco curado propio desde el inicio o primero solo IA + bancos de cada colegio?
