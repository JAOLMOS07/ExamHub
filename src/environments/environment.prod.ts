/**
 * Configuración de ambiente — PRODUCCIÓN.
 *
 * En el build de prod, Angular reemplaza automáticamente
 * environment.ts por este archivo (configurado en angular.json →
 * "fileReplacements"). Acá deberían ir los valores del proyecto
 * Firebase de producción cuando exista.
 *
 * Mientras tanto, dejá los mismos valores que dev o pegá los del
 * nuevo proyecto cuando lo crees.
 */
export const environment = {
  production: true,
  firebase: {
    projectId: "",
    appId: "",
    storageBucket: "",
    apiKey: "",
    authDomain: "",
    messagingSenderId: "",
    measurementId: "",
  },
  features: {
    /** Ver descripción en environment.ts. Activar cuando el plan
     *  contemple Firebase Storage. */
    enableImages: false,
  },
};
