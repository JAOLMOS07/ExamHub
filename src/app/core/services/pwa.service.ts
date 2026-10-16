import { Injectable, NgZone } from "@angular/core";
import { SwUpdate, VersionReadyEvent } from "@angular/service-worker";
import { filter } from "rxjs/operators";

/**
 * App instalable: aviso de instalación (Android/Chrome/Edge), guía para
 * iPhone (Safari no tiene botón automático) y nueva versión disponible.
 * Se instancia en AppComponent para no perder `beforeinstallprompt`.
 */
@Injectable({ providedIn: "root" })
export class PwaService {
  /** El navegador ofreció instalar y aún no se usó el aviso. */
  canInstall = false;
  /** Hay una versión nueva descargada; aplica al recargar. */
  updateReady = false;
  readonly isStandalone: boolean;
  readonly isIos: boolean;

  private deferred: any = null;

  constructor(private zone: NgZone, private sw: SwUpdate) {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : {};
    this.isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true);
    this.isIos = /iphone|ipad|ipod/i.test(nav.userAgent ?? "") && !/crios|fxios/i.test(nav.userAgent ?? "");

    if (typeof window !== "undefined") {
      window.addEventListener("beforeinstallprompt", (e: Event) => {
        e.preventDefault();
        this.zone.run(() => {
          this.deferred = e;
          this.canInstall = true;
        });
      });
      window.addEventListener("appinstalled", () =>
        this.zone.run(() => {
          this.deferred = null;
          this.canInstall = false;
        })
      );
    }

    if (sw.isEnabled) {
      sw.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === "VERSION_READY"))
        .subscribe(() => (this.updateReady = true));
      // Versión rota en caché (ej. tras borrar archivos del servidor).
      sw.unrecoverable.subscribe(() => location.reload());
      // Buscar actualizaciones cada 30 minutos con la app abierta.
      setInterval(() => sw.checkForUpdate().catch(() => undefined), 30 * 60 * 1000);
    }
  }

  /** Mostrar la opción "Instalar app" (o la guía en iPhone). */
  get showInstall(): boolean {
    return !this.isStandalone && (this.canInstall || this.isIos);
  }

  /** true si se mostró el aviso nativo; false si hay que guiar (iPhone). */
  async install(): Promise<boolean> {
    if (!this.deferred) return false;
    this.deferred.prompt();
    const choice = await this.deferred.userChoice.catch(() => null);
    this.zone.run(() => {
      this.deferred = null;
      this.canInstall = false;
    });
    return choice?.outcome === "accepted";
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      location.reload();
    }
  }
}
