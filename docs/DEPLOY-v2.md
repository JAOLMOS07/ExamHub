# Despliegue de ExamHub v2

Guía para publicar la rama `v2/rediseno`. Orden recomendado: reglas → app → (opcional) IA.

> Las reglas v2 **conservan** las reglas v1 (`/{uid}/...` y `/exams`), así que la versión
> anterior de la app sigue funcionando mientras se hace la transición.

## 0. Herramientas

```powershell
npm install -g firebase-tools
firebase login
firebase use exam-hub
```

## 1. Reglas, índices y Storage

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

- `firestore.indexes.json` habilita la consulta de invitaciones pendientes
  (`collectionGroup("invites")`); el índice tarda unos minutos en construirse.
- `storage.rules` consulta Firestore para validar la membresía. En el primer
  despliegue, Firebase pide autorizar a Storage para leer Firestore: acéptalo.
- **Authentication → Sign-in method → Email/Password** debe permitir registro
  (la app ahora tiene "Crear cuenta").

## 2. App web

```powershell
npm ci
npm run test:domain   # 34 tests de la capa de dominio
npm run build
```

Publica `dist/` donde ya lo hacías (el proyecto trae `src/_redirects` para Netlify).

### Primer ingreso de cada docente

1. Al iniciar sesión se crea su **espacio personal** (`orgs/p_<uid>`).
2. Si tenía datos de la versión anterior, el banco muestra **"Migrar ahora"**
   (también en *Institución → Copiar mis datos aquí*). La migración copia el banco,
   los exámenes y las calificaciones; no borra nada de v1 y se puede repetir.

### Alta de un colegio

1. El rector o coordinador entra a **Institución → Crear colegio** (queda en plan
   `trial`, 100 estudiantes, 200 créditos de IA).
2. Invita a los docentes por correo y rol. Cada docente entra con ese correo y acepta
   la invitación en *Institución*.
3. Carga los estudiantes en **Estudiantes → Importar** (Excel o CSV de SIMAT:
   código, nombre, grupo).
4. **Plan, cupos y créditos los cambia solo ExamHub**: edítalos en la consola de
   Firestore (`orgs/{id}`: `plan`, `seats`, `aiCreditsMonthly`). Las reglas impiden
   que el cliente los modifique.

## 3. IA (opcional)

Requiere plan **Blaze** de Firebase y una API key de Anthropic.

```powershell
cd functions
npm ci
firebase functions:secrets:set ANTHROPIC_API_KEY
cd ..
firebase deploy --only functions
```

Luego activa el flag en `src/environments/environment.prod.ts` (y `environment.ts`
para desarrollo):

```ts
features: { enableImages: false, enableAi: true }
```

- Modelo: `claude-opus-5-5` (cambiable con la variable `CLAUDE_MODEL` de la función).
  El esfuerzo se ajusta por tarea: alto para generar ítems, medio para revisar e
  informes, bajo para alinear.
- Salida JSON garantizada (`output_config.format`), caché del system prompt y
  fallback del lado del servidor si el modelo rechaza una solicitud.
- Créditos por organización y mes en `orgs/{id}/usage/{AAAA-MM}`:
  generar = 1 por pregunta, revisar = 1, alinear = 1 por cada 10, informe = 3.
- El informe de resultados solo envía **agregados** (sin nombres ni códigos).

## 4. Verificación manual sugerida

- [ ] Registro de cuenta nueva → se crea el espacio personal.
- [ ] Crear colegio, invitar a un segundo correo, aceptar la invitación con esa cuenta.
- [ ] Docente vs. coordinador: el docente no puede editar estudiantes.
- [ ] Generar un simulacro con preguntas alineadas, 2 formas, código de 6 dígitos.
- [ ] Imprimir y fotografiar 2–3 hojas reales con el celular (luz normal, sobre una mesa).
- [ ] El estudiante se reconoce por su código; el puntaje por prueba aparece.
- [ ] Reportes: por competencia, análisis de preguntas, boletines PDF y CSV.
- [ ] Un examen v1 migrado se sigue pudiendo calificar con su hoja vieja.

## Pendiente conocido

- Pruebas automáticas de las reglas con el emulador (requiere Java; no se corrieron).
- Actualizar Angular 17 (fuera de soporte) a la versión vigente, en una rama aparte.
- La lectura OMR se validó con hojas generadas por el PDF real y fotos simuladas
  (girada hasta 8°, baja resolución, fondo oscuro); falta validarla con fotos reales
  de celular en distintas condiciones de luz.
