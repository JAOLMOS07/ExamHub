import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ConfirmService } from "../../../core/services/confirm.service";

/**
 * Diálogo de confirmación de marca (reemplaza SweetAlert2).
 * Se monta una sola vez en AppComponent; ConfirmService controla
 * cuándo se muestra y resuelve la promesa con la decisión.
 *
 * Accesibilidad: rol dialog, foco inicial en "Cancelar" (acción segura),
 * Escape cancela, click en el backdrop cancela.
 */
@Component({
  selector: "eh-confirm",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.active(); as active) {
      <div
        class="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="active.options.title"
      >
        <!-- Backdrop -->
        <div
          class="eh-confirm-backdrop absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          (click)="confirmService.settle(false)"
        ></div>

        <!-- Tarjeta -->
        <div
          class="eh-confirm-card relative w-full max-w-md rounded-2xl bg-white shadow-elevated border border-slate-200 p-6"
        >
          <div class="flex items-start gap-4">
            <!-- Ícono -->
            <span
              class="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full"
              [ngClass]="
                active.options.tone === 'danger'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-brand-100 text-brand-700'
              "
            >
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  [attr.d]="iconPath(active.options.icon)"
                />
              </svg>
            </span>

            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-slate-900 leading-snug">
                {{ active.options.title }}
              </h3>
              @if (active.options.message) {
                <p class="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {{ active.options.message }}
                </p>
              }
            </div>
          </div>

          <!-- Acciones -->
          <div class="mt-6 flex justify-end gap-3">
            <button
              #cancelBtn
              type="button"
              class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition"
              (click)="confirmService.settle(false)"
            >
              {{ active.options.cancelText }}
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition"
              [ngClass]="
                active.options.tone === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300'
                  : 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-300'
              "
              (click)="confirmService.settle(true)"
            >
              {{ active.options.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .eh-confirm-backdrop {
        animation: eh-fade-in 150ms ease-out both;
      }
      .eh-confirm-card {
        animation: eh-pop-in 200ms cubic-bezier(0.21, 1.02, 0.73, 1) both;
      }
      @keyframes eh-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes eh-pop-in {
        from {
          opacity: 0;
          transform: translateY(0.5rem) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .eh-confirm-backdrop,
        .eh-confirm-card {
          animation: none;
        }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  @ViewChild("cancelBtn") cancelBtn?: ElementRef<HTMLButtonElement>;

  constructor(public confirmService: ConfirmService) {
    // Al abrir, foco en la acción segura (Cancelar).
    effect(() => {
      if (this.confirmService.active()) {
        setTimeout(() => this.cancelBtn?.nativeElement?.focus(), 0);
      }
    });
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.confirmService.active()) {
      this.confirmService.settle(false);
    }
  }

  iconPath(icon: "warning" | "question" | "info"): string {
    switch (icon) {
      case "warning":
        return "M12 9v4m0 4h.01M10.3 4.2L2.9 17a2 2 0 001.7 3h14.8a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z";
      case "info":
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      default:
        return "M8.2 9a4 4 0 117.1 2.5c-.8.9-2 1.4-2.6 2.3-.3.4-.4.8-.4 1.4m0 3.3h.01";
    }
  }
}
