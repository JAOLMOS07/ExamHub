# Setup — ExamHub en local

Guía para arrancar el proyecto desde cero después de mucho tiempo sin tocarlo.
Tiempo estimado total: **10–15 minutos** (la primera vez).

## 0. Instalar el entorno (una sola vez)

Necesitás:

- **Node.js 20 LTS** (mínimo 18.13). Descargá de [nodejs.org](https://nodejs.org/) → "LTS".
- **Angular CLI 17** instalado global (opcional pero cómodo):
  ```powershell
  npm install -g @angular/cli@17
  ```

Verificá que ambos funcionan:

```powershell
node -v    # debería ser >= v18.13
npm -v
ng version # opcional
```

Si `ng` no se reconoce en PowerShell, podés saltarte el global y usar siempre `npm start` / `npm run build`.

## 1. Instalar dependencias del proyecto

Abrí PowerShell en la **raíz del proyecto** (no en `src/`):

```powershell
cd C:\Users\PC\Documents\Jhoger\ExamHub
npm ci
```

> `npm ci` usa `package-lock.json` y es más rápido y reproducible que `npm install`. La primera vez tarda 2–4 minutos. Vas a ver warnings de peer-deps deprecadas — son normales, no detienen la instalación.

Si `npm ci` falla por inconsistencias del lock viejo, fallback:

```powershell
npm install
```

## 2. Conectar Firebase

Seguí los pasos 1–6 de la sección "Reconectar Firebase" más abajo (crear proyecto, habilitar Auth + Firestore, copiar credenciales en `src/environments/environment.ts`, publicar reglas).

## 3. Levantar el dev server

```powershell
npm start
```

A los ~30 segundos verás:

```
✔ Browser application bundle generation complete.
** Angular Live Development Server is listening on localhost:4200 **
```

Abrí [http://localhost:4200](http://localhost:4200) y deberías ir directo al login. Cada vez que guardes un archivo `.ts` o `.html`, la app recarga sola.

Para parar: `Ctrl + C` en la terminal.

## Troubleshooting de la instalación

**"npm ERR! Unsupported engine"** → tu Node es viejo. Instalá Node 20 LTS desde nodejs.org.

**"ng : The term 'ng' is not recognized"** → no instalaste Angular CLI global, o PowerShell tiene la política de scripts bloqueada. Solución rápida: usá `npm start` en lugar de `ng serve`. Solución profunda: corré PowerShell como admin y `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

**"Module not found: Error: Can't resolve '../../environments/environment'"** → la carpeta `src/environments/` no existe. Verificá que esté el archivo `src/environments/environment.ts` (lo creamos en el último refactor).

**Pantalla en blanco al abrir localhost:4200** → abrí la consola del navegador (F12). Si ves errores de Firebase del estilo `auth/invalid-api-key` o `Failed to fetch`, es que no pegaste tus credenciales reales en `environment.ts`. Volvé al paso 2.

**"Cannot read properties of null (reading 'uid')"** en Firestore → no hiciste login antes de crear una carpeta. Esto ya está cubierto por el fix del `ExamService` (ahora tira un error claro), pero asegurate de estar logueado.

---

# Reconectar Firebase

Guía corta para conectar el proyecto a una cuenta de Firebase (la vieja o una nueva).
Tiempo estimado: **5–8 minutos**.

## 1. Crear (o recuperar) el proyecto Firebase

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com/).
2. Si tu cuenta vieja sigue viva y el proyecto `examhub-5679c` aparece, podés reutilizarlo. Si no, **Add project** → nombre `examhub-dev` (o el que quieras).
3. Desactivá Google Analytics si te lo pregunta — para dev no hace falta.

## 2. Habilitar los servicios que usa la app

Dentro del proyecto, en el menú lateral:

- **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
- **Build → Firestore Database → Create database** → modo **producción** (vamos a poner reglas decentes) → ubicación cercana a tus usuarios (por ejemplo `southamerica-east1` para Brasil/Argentina/Chile o `us-central` para Colombia/México).

## 3. Registrar la app web

1. ⚙️ **Project settings** (engranaje arriba a la izquierda).
2. Pestaña **General** → sección **Your apps** → ícono **`</>`** (web).
3. Nombre de la app: `ExamHub Web`. **No** marques Firebase Hosting todavía.
4. Copiá el objeto `firebaseConfig` que te muestra.

## 4. Pegar la config en el proyecto

Abrí `src/environments/environment.ts` y reemplazá los valores del objeto `firebase` con los tuyos:

```ts
export const environment = {
  production: false,
  firebase: {
    projectId: "TU_PROJECT_ID",
    appId: "TU_APP_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    messagingSenderId: "TU_SENDER_ID",
    measurementId: "TU_MEASUREMENT_ID",
  },
};
```

Listo. Toda la app lee desde ese único archivo (ya no hay credenciales hardcodeadas en `app.config.ts` ni en ningún otro lado).

## 5. Crear tu primer usuario

En la consola de Firebase:

- **Authentication → Users → Add user** → email + contraseña.

Usá ese mismo email/contraseña para entrar a la app cuando la levantes.

## 6. Reglas mínimas de Firestore

⚠️ Por defecto Firestore en "modo producción" bloquea todo. Pegá estas reglas en **Firestore → Rules** para que la app funcione sin abrir la base al mundo:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada usuario solo puede leer/escribir bajo su propio UID.
    // La app guarda en /<uid>/<folderId>/content/...
    match /{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

> Estas reglas son suficientes para el MVP de un solo usuario. Cuando agreguemos organizaciones/escuelas en v2, las reescribimos.

## 7. Levantar la app

```bash
npm install
npm start          # o: ng serve
```

Abrí `http://localhost:4200`, andá a `/login`, entrá con el usuario que creaste en el paso 5 y deberías ver tu Home vacío listo para crear carpetas y preguntas.

---

## Troubleshooting

**"Missing or insufficient permissions"** al crear una carpeta
→ Revisá que las reglas del paso 6 estén publicadas y que estés logueado.

**El login pasa pero al volver a `/home` no carga nada**
→ Abrí la consola del navegador. Si ves errores de Firestore con paths `null/...`, era el bug viejo de `userUUID`. Ya está arreglado en `ExamService` (suscripción a `onAuthStateChanged`), pero si lo ves, asegurate de tener el código actualizado.

**Quiero usar otra cuenta de Firebase sin perder la actual**
→ Creá `environment.staging.ts` con la otra config y agregá un fileReplacement en `angular.json`. Para esta etapa probablemente no lo necesitás.
