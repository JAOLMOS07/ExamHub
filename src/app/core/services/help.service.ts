import { Injectable } from "@angular/core";
import { DriveStep, driver } from "driver.js";
import { DriverHint, Hints, hints } from "driver.js/hints";

/**
 * Ayuda en la app con Driver.js (MIT):
 *   - Recorridos guiados por pantalla (botón "?" y bienvenida automática).
 *   - Tips puntuales junto a un campo (<eh-tip>).
 *   - Puntos de "novedad" que palpitan sobre funciones nuevas.
 *
 * Los pasos apuntan a elementos con `data-tour="clave"`. Si una clave
 * existe dos veces (barra lateral en escritorio y barra inferior en el
 * celular) se usa la que se ve; los pasos sin elemento visible se omiten.
 */

export type TourId = "welcome" | "catalog" | "grades" | "exam" | "scan";

interface StepDef {
  /** data-tour del elemento; sin él, el paso sale centrado. */
  at?: string;
  title: string;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
}

const TOURS: Record<TourId, StepDef[]> = {
  welcome: [
    { title: "¡Bienvenido a ExamHub!", text: "En un minuto te mostramos cómo pasar del lápiz al resultado. Puedes cerrar este recorrido cuando quieras y volver a verlo desde tu menú." },
    { at: "nav-home", title: "Tu banco de preguntas", text: "Aquí organizas las preguntas y lecturas de tu institución en carpetas.", side: "right" },
    { at: "home-new", title: "Crea preguntas", text: "Escríbelas una a una, pégalas desde Word o genera un banco completo con tu IA gratis (ChatGPT, Gemini o Claude).", side: "bottom" },
    { at: "nav-catalog", title: "Banco ExamHub", text: "Preguntas tipo Saber 11 listas para usar. Arma un simulacro completo en segundos.", side: "right" },
    { at: "nav-grade", title: "Evaluaciones", text: "Cuando generas un examen queda aquí: hojas con el nombre de cada estudiante, calificación con el celular e informes.", side: "right" },
    { at: "nav-scan", title: "Escanear", text: "Apunta la cámara al QR de la hoja: ExamHub sabe de qué estudiante es y la califica. Funciona sin internet.", side: "top" },
    { at: "nav-students", title: "Estudiantes", text: "Carga los listados desde Excel para imprimir hojas personalizadas y ver resultados por grupo.", side: "right" },
    { at: "install-app", title: "Instálala en tu celular", text: "Queda como una app y califica incluso en salones sin señal.", side: "right" },
    { at: "user-menu", title: "Tu cuenta", text: "Modo oscuro, colores de tu colegio y este recorrido cuando lo necesites.", side: "top" },
  ],
  catalog: [
    { at: "cat-tabs", title: "Banco ExamHub", text: "Explora preguntas, arma un simulacro automático o revisa las preguntas que has aportado.", side: "bottom" },
    { at: "cat-tests", title: "Elige la prueba", text: "Las preguntas se cargan por prueba del Saber 11.", side: "bottom" },
    { at: "cat-filters", title: "Filtra", text: "Por competencia, dificultad, tipo (sueltas o lecturas) o por texto.", side: "bottom" },
    { at: "cat-list", title: "Revisa y selecciona", text: "Abre cada pregunta para ver las opciones, la respuesta y la justificación. Selecciónalas y cópialas a tu banco o arma el examen directo.", side: "top" },
  ],
  grades: [
    { at: "grade-list", title: "Tus evaluaciones", text: "Cada examen que generas aparece aquí con su avance de calificación.", side: "top" },
    { at: "grade-scan", title: "Escanear hojas", text: "Abre la cámara: el QR de cada hoja dice la evaluación, la forma y el estudiante.", side: "bottom" },
    { at: "grade-new", title: "Nuevo examen", text: "Se arma desde el banco: eliges las preguntas y generas los cuadernillos y las hojas.", side: "bottom" },
  ],
  exam: [
    { at: "ed-grade", title: "Calificar", text: "Toma fotos de las hojas o marca las respuestas a mano.", side: "bottom" },
    { at: "ed-export", title: "Informes", text: "Informe para rectoría, boletines para las familias, planilla y libro de Excel.", side: "bottom" },
    { at: "ed-metrics", title: "Resultados del grupo", text: "Filtra por grupo y mira promedio, mejor y peor nota y el puntaje global estimado.", side: "bottom" },
    { at: "ed-tabs", title: "Análisis", text: "Resultados por prueba y competencia y las preguntas con menos aciertos: la pista de qué reforzar.", side: "bottom" },
  ],
  scan: [
    { at: "scan-camera", title: "Activa la cámara", text: "Apunta al QR de la hoja; ExamHub abre la evaluación y el estudiante solos.", side: "bottom" },
    { at: "scan-photo", title: "¿Ya tienes la foto?", text: "También puedes leer el QR desde una imagen de la galería.", side: "top" },
    { at: "scan-offline", title: "Sin conexión", text: "Abre esta pantalla con internet una vez y podrás calificar sin señal; las notas se suben después.", side: "top" },
  ],
};

/** Novedades que se marcan con un punto que palpita (se pueden descartar). */
const NEWS: { id: string; at: string; title: string; text: string }[] = [
  { id: "news-catalog", at: "nav-catalog", title: "Nuevo: Banco ExamHub", text: "Preguntas tipo Saber 11 listas y simulacros automáticos para tu colegio." },
  { id: "news-install", at: "install-app", title: "Califica sin internet", text: "Instala ExamHub en el celular y califica aunque el salón no tenga señal." },
];

const SEEN_KEY = "eh-help-seen";
const TOUR_VERSION = 1;

@Injectable({ providedIn: "root" })
export class HelpService {
  private hintsApi: Hints | null = null;

  /** Primer elemento visible con esa clave. */
  private find(key: string): HTMLElement | null {
    const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`));
    return all.find((el) => el.offsetParent !== null || el.getClientRects().length > 0) ?? null;
  }

  private seen(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
    } catch {
      return {};
    }
  }

  private markSeen(id: string): void {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ...this.seen(), [id]: TOUR_VERSION }));
    } catch {
      /* sin almacenamiento */
    }
  }

  hasSeen(id: string): boolean {
    return (this.seen()[id] ?? 0) >= TOUR_VERSION;
  }

  /** Recorrido de una pantalla. */
  start(id: TourId): void {
    this.hideNews();
    const steps: DriveStep[] = [];
    for (const s of TOURS[id]) {
      const el = s.at ? this.find(s.at) : undefined;
      if (s.at && !el) continue;
      steps.push({
        ...(el ? { element: el } : {}),
        popover: { title: s.title, description: s.text, side: s.side, align: "start" },
      });
    }
    if (!steps.length) return;
    const tour = driver({
      steps,
      showProgress: steps.length > 1,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Listo",
      closeBtnLabel: "Cerrar",
      popoverClass: "eh-tour",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
      allowKeyboardControl: true,
      onDestroyed: () => {
        this.markSeen(id);
        if (id === "welcome") setTimeout(() => this.showNews(), 600);
      },
    });
    tour.drive();
  }

  /** La primera vez en una pantalla, su recorrido sale solo. */
  autoStart(id: TourId, delayMs = 900): void {
    if (this.hasSeen(id)) {
      if (id === "welcome") setTimeout(() => this.showNews(), delayMs);
      return;
    }
    setTimeout(() => this.start(id), delayMs);
  }

  /** Tip puntual junto a un elemento. */
  tip(element: HTMLElement, title: string, text: string): void {
    const d = driver({
      popoverClass: "eh-tour eh-tour--tip",
      overlayOpacity: 0.25,
      stagePadding: 4,
      stageRadius: 10,
      showButtons: ["close"],
      allowKeyboardControl: true,
    });
    d.highlight({ element, popover: { title, description: text, side: "bottom", align: "start" } });
  }

  /** Puntos de novedad que el usuario aún no descartó. */
  showNews(): void {
    const pending: DriverHint[] = NEWS.filter((n) => !this.hasSeen(n.id))
      .map((n) => ({ n, el: this.find(n.at) }))
      .filter(({ el }) => !!el)
      .map(({ n, el }) => ({
        id: n.id,
        element: el!,
        beacon: { side: "right", align: "start", offsetX: -6, offsetY: 6 },
        popover: { title: n.title, description: n.text, showButton: true, buttonText: "Entendido" },
      }));
    if (!pending.length) return;
    this.hideNews();
    this.hintsApi = hints({
      hints: pending,
      popoverClass: "eh-tour eh-tour--tip",
      overlay: false,
      onButtonClick: (_el, hint, { hints: api }) => {
        if (hint.id) {
          this.markSeen(String(hint.id));
          api.dismiss(hint.id);
        }
      },
      onDismiss: (_el, hint) => hint.id && this.markSeen(String(hint.id)),
    });
    this.hintsApi.show();
  }

  hideNews(): void {
    this.hintsApi?.hide();
    this.hintsApi = null;
  }

  /** Para "Ver el recorrido de nuevo": olvida lo visto. */
  resetAll(): void {
    try {
      localStorage.removeItem(SEEN_KEY);
    } catch {
      /* sin almacenamiento */
    }
  }
}
