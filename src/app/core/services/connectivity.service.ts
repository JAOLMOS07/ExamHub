import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";

/**
 * Estado de la conexión y escrituras pendientes de subir.
 *
 * Con la caché persistente de Firestore (app.config.ts) una escritura
 * hecha sin internet queda guardada en el dispositivo y se envía sola
 * al volver la red; su promesa solo se resuelve cuando el servidor la
 * confirma. Aquí contamos esas promesas para mostrarle al docente
 * cuántas calificaciones faltan por subir.
 */
@Injectable({ providedIn: "root" })
export class ConnectivityService {
  readonly online$ = new BehaviorSubject<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  readonly pending$ = new BehaviorSubject<number>(0);

  constructor(zone: NgZone) {
    if (typeof window === "undefined") return;
    const update = () => zone.run(() => this.online$.next(navigator.onLine));
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
  }

  get online(): boolean {
    return this.online$.value;
  }

  /**
   * Registra una escritura. Sin conexión no conviene esperarla (se
   * quedaría colgada hasta que vuelva la red): el llamador decide con
   * `online` si la espera o sigue de largo.
   */
  track<T>(write: Promise<T>): Promise<T> {
    this.pending$.next(this.pending$.value + 1);
    const done = () => this.pending$.next(Math.max(0, this.pending$.value - 1));
    write.then(done, (err) => {
      done();
      console.error("[Sincronización] una escritura falló:", err);
    });
    return write;
  }
}
