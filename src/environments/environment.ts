/**
 * Configuración de ambiente — DESARROLLO.
 *
 * Reemplazá estos valores con los de tu proyecto Firebase.
 * Para obtenerlos:
 *   1. Andá a https://console.firebase.google.com/
 *   2. Seleccioná tu proyecto (o creá uno nuevo).
 *   3. ⚙️ Configuración del proyecto → "Tus apps" → ícono web (</>).
 *   4. Copiá el objeto `firebaseConfig` y pegalo abajo.
 *
 * ⚠️ Este archivo NO debe versionarse en producción.
 *    Está en git solo porque es la config de desarrollo del MVP.
 *    Cuando lances a producción, agregalo a .gitignore y usá
 *    environment.prod.ts con secretos inyectados por CI/CD.
 */
export const environment = {
  production: false,
  firebase: {
    projectId: "exam-hub-cert",
    appId: "1:422770687174:web:14eb393bd99fc4e38c6bc7",
    storageBucket: "exam-hub-cert.firebasestorage.app",
    apiKey: "AIzaSyC9XDQF0sUXWlRl-LtEyx2JtDMsi-x5LHA",
    authDomain: "exam-hub-cert.firebaseapp.com",
    messagingSenderId: "422770687174",
    measurementId: "G-XDZWFREHMS",
  },
  /**
   * Feature flags — banderas para activar/desactivar features
   * completas sin tocar código de aplicación.
   */
  features: {
    /**
     * Subida y visualización de imágenes en preguntas.
     *
     * REQUIERE:
     *   1. Firebase Storage habilitado en la consola de Firebase
     *      (Build → Storage → Get started).
     *   2. Reglas de Storage publicadas (ver docs/IMAGES.md cuando
     *      lo activemos).
     *   3. Plan Blaze (pay-as-you-go) si esperás más de 5 GB de
     *      tráfico mensual. El plan Spark gratuito tiene cuota.
     *
     * Mientras esté en `false`:
     *   - El UI para subir imágenes NO aparece en el diálogo de
     *     crear pregunta.
     *   - Las imágenes ya guardadas en preguntas existentes tampoco
     *     se muestran (ni en banco ni en PDF). Quedan persistidas en
     *     Firestore pero "ocultas".
     *   - El código del servicio sigue compilado pero nunca se
     *     invoca, así que no genera tráfico ni costos.
     *
     * Para activar en el futuro: cambiar este flag a `true` y
     * publicar las reglas de Storage. Sin más cambios.
     */
    enableImages: false,
  },
};
