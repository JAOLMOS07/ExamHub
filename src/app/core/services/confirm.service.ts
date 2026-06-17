import { Injectable, signal } from "@angular/core";

export interface ConfirmOptions {
  title: string;
  /** Texto secundario, opcional. */
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** "danger" para acciones destructivas (botón rojo), "primary" para el resto. */
  tone?: "danger" | "primary";
  /** Ícono mostrado en el header del diálogo. */
  icon?: "warning" | "question" | "info";
}

interface ActiveConfirm {
  options: Required<ConfirmOptions>;
  resolve: (confirmed: boolean) => void;
}

/**
 * Diálogos de confirmación propios de ExamHub — reemplazan a SweetAlert2.
 *
 * Uso:
 *   const ok = await this.confirm.ask({
 *     title: "¿Eliminar esta pregunta?",
 *     message: "No se puede deshacer.",
 *     tone: "danger",
 *   });
 *   if (ok) { ... }
 *
 * El render lo hace <eh-confirm> (ConfirmDialogComponent), montado una
 * sola vez en AppComponent.
 */
@Injectable({ providedIn: "root" })
export class ConfirmService {
  readonly active = signal<ActiveConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // Si ya hay uno abierto, lo resolvemos como cancelado para no
    // encolar diálogos fantasma.
    this.active()?.resolve(false);

    return new Promise<boolean>((resolve) => {
      this.active.set({
        options: {
          title: options.title,
          message: options.message ?? "",
          confirmText: options.confirmText ?? "Confirmar",
          cancelText: options.cancelText ?? "Cancelar",
          tone: options.tone ?? "primary",
          icon: options.icon ?? (options.tone === "danger" ? "warning" : "question"),
        },
        resolve,
      });
    });
  }

  /** Resuelve el diálogo activo. Llamado por el componente de UI. */
  settle(confirmed: boolean): void {
    const current = this.active();
    if (!current) return;
    this.active.set(null);
    current.resolve(confirmed);
  }
}
