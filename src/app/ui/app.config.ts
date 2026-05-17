import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { getAuth, provideAuth } from "@angular/fire/auth";
import { getFirestore, provideFirestore } from "@angular/fire/firestore";
import { getStorage, provideStorage } from "@angular/fire/storage";

import { routes } from "./app.routes";
import { environment } from "../../environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
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
