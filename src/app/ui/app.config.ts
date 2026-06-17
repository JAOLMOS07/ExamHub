import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { getApp, initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { getAuth, provideAuth } from "@angular/fire/auth";
import {
  initializeFirestore,
  provideFirestore,
} from "@angular/fire/firestore";
import { getStorage, provideStorage } from "@angular/fire/storage";

import { routes } from "./app.routes";
import { environment } from "../../environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    /**
     * `ignoreUndefinedProperties: true` evita que Firestore lance
     * "Unsupported field value: undefined" cuando un documento trae
     * campos opcionales sin valor (ej: `manualScores` al calificar sin
     * tocar las preguntas abiertas, o `subject`/`grade`/`studentCode`).
     * Antes esto rompía el guardado; ahora esos campos simplemente se
     * omiten del documento.
     */
    provideFirestore(() =>
      initializeFirestore(getApp(), { ignoreUndefinedProperties: true })
    ),
    /**
     * Firebase Storage para subir imágenes de preguntas.
     * Ruta de archivos: users/<uid>/questions/<questionId>/<filename>.
     * Las reglas de Storage (que se publican en Firebase Console)
     * deben permitir lectura/escritura solo al dueño:
     *   match /users/{uid}/{allPaths=**} {
     *     allow read, write: if request.auth.uid == uid;
     *   }
     */
    provideStorage(() => getStorage()),
  ],
};
