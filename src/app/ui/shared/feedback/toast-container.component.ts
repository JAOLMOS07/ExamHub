import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Toast, ToastService } from "../../../core/services/toast.service";

/**
 * Contenedor de toasts de marca. Se monta una sola vez en AppComponent.
 *
 * Diseño: tarjetas compactas arriba a la derecha, con barra de acento
 * por tipo, ícono, título, mensaje y botón de cierre. Animación de
 * entrada (slide + fade) y salida (fade + shrink).
 */
@Component({
  selector: "eh-toasts",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="eh-toast pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-elevated"
          [class.eh-toast--leaving]="toast.leaving"
          [ngClass]="borderClass(toast)"
          role="status"
        >
          <!-- Ícono -->
          <span
            class="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full"
            [ngClass]="iconWrapClass(toast)"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                [attr.d]="iconPath(toast)"
              />
            </svg>
          </span>

          <!-- Texto -->
          <div class="min-w-0 flex-1">
            @if (toast.title) {
              <p class="text-sm font-semibold text-slate-900 leading-snug">
                {{ toast.title }}
              </p>
            }
            <p class="text-sm text-slate-600 leading-snug break-words">
              {{ toast.message }}
            </p>
          </div>

          <!-- Cerrar -->
          <button
            type="button"
            class="flex-none -m-1 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar notificación"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .eh-toast {
        animation: eh-toast-in 220ms cubic-bezier(0.21, 1.02, 0.73, 1) both;
      }
      .eh-toast--leaving {
        animation: eh-toast-out 180ms ease-in both;
      }
      @keyframes eh-toast-in {
        from {
          opacity: 0;
          transform: translateX(1.5rem) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      @keyframes eh-toast-out {
        from {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateX(0.75rem) scale(0.97);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .eh-toast,
        .eh-toast--leaving {
          animation: none;
        }
      }
    `,
  ],
})
export class ToastContainerComponent {
  constructor(public toastService: ToastService) {}

  borderClass(toast: Toast): string {
    switch (toast.kind) {
      case "success":
        return "border-emerald-200";
      case "warning":
        return "border-amber-200";
      case "danger":
        return "border-red-200";
      default:
        return "border-sky-200";
    }
  }

  iconWrapClass(toast: Toast): string {
    switch (toast.kind) {
      case "success":
        return "bg-emerald-100 text-emerald-700";
      case "warning":
        return "bg-amber-100 text-amber-700";
      case "danger":
        return "bg-red-100 text-red-700";
      default:
        return "bg-sky-100 text-sky-700";
    }
  }

  iconPath(toast: Toast): string {
    switch (toast.kind) {
      case "success":
        return "M5 13l4 4L19 7";
      case "warning":
        return "M12 9v4m0 4h.01M10.3 4.2L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z";
      case "danger":
        return "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      default:
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
    }
  }
}
