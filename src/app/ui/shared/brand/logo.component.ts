import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

/**
 * Logo "ExamHub" — un libro abierto estilizado con un tilde de
 * "completado" arriba. Combinación de los dos significantes del
 * producto: lectura/estudio + corrección/aprobación.
 *
 * El logo es 100% SVG inline; no depende de ningún asset externo,
 * escala perfecto a cualquier tamaño y respeta el color de marca.
 *
 * Uso:
 *   <eh-logo />                            (size 28px, con wordmark)
 *   <eh-logo [size]="40" [showText]="false" />  (solo isotipo)
 *   <eh-logo [size]="48" variant="light" /> (sobre fondos oscuros)
 */
@Component({
  selector: "eh-logo",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center gap-2 select-none">
      <svg
        [attr.width]="size"
        [attr.height]="size"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        [class.text-white]="variant === 'light'"
        [class.text-brand-700]="variant !== 'light'"
        aria-hidden="true"
      >
        <!-- Libro abierto (dos páginas) -->
        <path
          d="M6 12c0-1.1.9-2 2-2h13c1.66 0 3 1.34 3 3v25c0-1.66-1.34-3-3-3H8a2 2 0 01-2-2V12z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M42 12c0-1.1-.9-2-2-2H27c-1.66 0-3 1.34-3 3v25c0-1.66 1.34-3 3-3h13a2 2 0 002-2V12z"
          fill="currentColor"
          opacity="0.28"
        />
        <!-- Líneas internas (texto) -->
        <line
          x1="10"
          y1="16"
          x2="20"
          y2="16"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.55"
        />
        <line
          x1="10"
          y1="20"
          x2="20"
          y2="20"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.55"
        />
        <line
          x1="10"
          y1="24"
          x2="18"
          y2="24"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.55"
        />
        <line
          x1="28"
          y1="16"
          x2="38"
          y2="16"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.55"
        />
        <line
          x1="28"
          y1="20"
          x2="38"
          y2="20"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.55"
        />
        <!-- Check mark "aprobado" — distintivo del producto -->
        <circle
          cx="36"
          cy="12"
          r="7"
          fill="#10b981"
          stroke="#fff"
          stroke-width="1.5"
        />
        <path
          d="M33 12.5l2 2 4-4"
          stroke="#fff"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      @if (showText) {
        <span
          class="font-bold text-lg tracking-tight"
          [class.text-white]="variant === 'light'"
          [class.text-brand-700]="variant !== 'light'"
        >
          Exam<span class="text-accent-600">Hub</span>
        </span>
      }
    </div>
  `,
  styles: [
    `
      .text-brand-700 {
        color: #4338ca;
      }
      .text-accent-600 {
        color: #d97706;
      }
    `,
  ],
})
export class LogoComponent {
  /** Tamaño en píxeles del isotipo (libro + check). */
  @Input() size: number = 28;
  /** Mostrar el wordmark "ExamHub" al lado del isotipo. */
  @Input() showText: boolean = true;
  /** Variante de color: 'default' (sobre fondos claros) o 'light' (oscuros). */
  @Input() variant: "default" | "light" = "default";
}
