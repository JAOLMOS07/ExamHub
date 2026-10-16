import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { BRAND_PRESETS, DARK_BRAND, SHADES, Scale } from "./palettes";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemePrefs {
  mode: ThemeMode;
  /** Id de BRAND_PRESETS o "custom". */
  brand: string;
  /** Color propio (#rrggbb) cuando brand === "custom". */
  custom?: string;
}

const STORAGE_KEY = "eh-theme";
/** Variables ya calculadas: las aplica el script de index.html antes de arrancar. */
const BOOT_KEY = "eh-theme-boot";
const DEFAULT: ThemePrefs = { mode: "system", brand: "indigo" };

/**
 * Modo claro/oscuro y color de marca, guardados en este dispositivo.
 * Todo se aplica con variables CSS (theme-colors.css + tailwind.config.js).
 */
@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly prefs$ = new BehaviorSubject<ThemePrefs>(this.load());
  readonly isDark$ = new BehaviorSubject<boolean>(false);
  private media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;

  constructor() {
    this.media?.addEventListener?.("change", () => {
      if (this.prefs.mode === "system") this.apply();
    });
    this.apply();
  }

  get prefs(): ThemePrefs {
    return this.prefs$.value;
  }

  get isDark(): boolean {
    return this.isDark$.value;
  }

  set(patch: Partial<ThemePrefs>): void {
    const next = { ...this.prefs, ...patch };
    this.prefs$.next(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento bloqueado: solo esta sesión */
    }
    this.apply();
  }

  /** Alterna claro/oscuro (fija el modo, deja de seguir al sistema). */
  toggleDark(): void {
    this.set({ mode: this.isDark ? "light" : "dark" });
  }

  scaleFor(prefs: ThemePrefs = this.prefs): Scale {
    if (prefs.brand === "custom" && prefs.custom && /^#[0-9a-f]{6}$/i.test(prefs.custom)) {
      return scaleFromHex(prefs.custom);
    }
    return (BRAND_PRESETS.find((p) => p.id === prefs.brand) ?? BRAND_PRESETS[0]).scale;
  }

  private apply(): void {
    if (typeof document === "undefined") return;
    const prefs = this.prefs;
    const dark = prefs.mode === "dark" || (prefs.mode === "system" && !!this.media?.matches);
    const scale = this.scaleFor(prefs);
    const vars: Record<string, string> = {};
    for (const s of SHADES) vars[`--c-brand-${s}`] = scale[dark ? DARK_BRAND[s] : s];

    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "examhub-dark" : "examhub");
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", dark ? "#0f172a" : `rgb(${scale[700]})`);
    this.isDark$.next(dark);

    try {
      localStorage.setItem(BOOT_KEY, JSON.stringify({ dark, vars }));
    } catch {
      /* sin almacenamiento */
    }
  }

  private load(): ThemePrefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  }
}

/**
 * Escala 50–950 a partir de un color (que se toma como el tono 600):
 * mezcla con blanco hacia los claros y con negro hacia los oscuros.
 */
export function scaleFromHex(hex: string): Scale {
  const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (target: number, t: number) =>
    base.map((c) => Math.round(c + (target - c) * t)).join(" ");
  const toWhite: Record<number, number> = { 50: 0.94, 100: 0.87, 200: 0.74, 300: 0.56, 400: 0.34, 500: 0.15 };
  const toBlack: Record<number, number> = { 700: 0.14, 800: 0.3, 900: 0.45, 950: 0.65 };
  const scale: Scale = {};
  for (const s of SHADES) {
    if (s in toWhite) scale[s] = mix(255, toWhite[s]);
    else if (s in toBlack) scale[s] = mix(0, toBlack[s]);
    else scale[s] = base.join(" ");
  }
  return scale;
}
