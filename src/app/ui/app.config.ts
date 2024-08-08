import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";

import { routes } from "./app.routes";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { getAuth, provideAuth } from "@angular/fire/auth";
import { getFirestore, provideFirestore } from "@angular/fire/firestore";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideAnimationsAsync(),
    provideFirebaseApp(() =>
      initializeApp({
        projectId: "examhub-5679c",
        appId: "1:667352988613:web:b8011df03751a2354be9ac",
        storageBucket: "examhub-5679c.appspot.com",
        apiKey: "AIzaSyAsfs_j_nBOGG6lrJcX_3Y0lZ9f46E17LI",
        authDomain: "examhub-5679c.firebaseapp.com",
        messagingSenderId: "667352988613",
        measurementId: "G-4EWWXQ9T4N",
      })
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()), provideFirebaseApp(() => initializeApp({"projectId":"examhub-5679c","appId":"1:667352988613:web:b8011df03751a2354be9ac","storageBucket":"examhub-5679c.appspot.com","apiKey":"AIzaSyAsfs_j_nBOGG6lrJcX_3Y0lZ9f46E17LI","authDomain":"examhub-5679c.firebaseapp.com","messagingSenderId":"667352988613","measurementId":"G-4EWWXQ9T4N"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()),
  ],
};
