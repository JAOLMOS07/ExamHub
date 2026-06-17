import { Injectable, signal } from "@angular/core";

export type ToastKind = "success" | "warning" | "danger" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  title?: string;
  /** ms visible antes de auto-cerrar. */
  duration: number;
  /** true mientras corre la animación de salida. */
  leaving: boolean;
}

/**
 * Sistema de toasts propio de ExamHub.
 *
 * Reemplaza a ng-angular-popup con una API compatible (mismas firmas
 * posicionales: message, title, duration) para que la migración sea
 * transparente en los componentes.
 *
 * El render lo hace <eh-toasts> (ToastContainerComponent), montado una
 * sola vez en AppComponent.
 */
@Injectable({ providedIn: "root" })
export class ToastService {
  private seq = 0;
  /** Lista reactiva de toasts visibles (máx. MAX_VISIBLE). */
  readonly toasts = signal<Toast[]>([]);

  private static readonly MAX_VISIBLE = 4;
  private static readonly LEAVE_MS = 180;

  success(message: string, title = "Listo", duration = 3200): void {
    this.push("success", message, title, duration);
  }

  info(message: string, title = "Info", duration = 3200): void {
    this.push("info", message, title, duration);
  }

  warning(message: string, title = "Atención", duration = 4000): void {
    this.push("warning", message, title, duration);
  }

  danger(message: string, title = "Error", duration = 4500): void {
    this.push("danger", message, title, duration);
  }

  dismiss(id: number): void {
    const toast = this.toasts().find((t) => t.id === id);
    if (!toast || toast.leaving) return;
    // Disparamos animación de salida y recién después removemos.
    this.toasts.update((list) =>
      list.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, ToastService.LEAVE_MS);
  }

  private push(
    kind: ToastKind,
    message: string,
    title: string,
    duration: number
  ): void {
    const id = ++this.seq;
    this.toasts.update((list) => {
      const next = [...list, { id, kind, message, title, duration, leaving: false }];
      // Si hay demasiados, vamos sacando los más viejos.
      return next.length > ToastService.MAX_VISIBLE
        ? next.slice(next.length - ToastService.MAX_VISIBLE)
        : next;
    });
    setTimeout(() => this.dismiss(id), duration);
  }
}
