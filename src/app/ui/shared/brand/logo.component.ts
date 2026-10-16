import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

/**
 * Logo de ExamHub: "el check de burbujas". Una cuadrícula de 4 × 3
 * burbujas de hoja de respuestas donde cuatro marcadas dibujan un ✓;
 * la última, en amarillo lápiz, es el momento en que ExamHub lee la
 * marca. Guía completa y archivos: docs/brand/.
 *
 * Uso:
 *   <eh-logo />                                 (32 px, con el nombre)
 *   <eh-logo [size]="40" [showText]="false" />  (solo el símbolo)
 *   <eh-logo [size]="48" variant="light" />     (sobre fondos oscuros)
 *
 * Por debajo de 32 px usa el símbolo simplificado (sin las burbujas
 * vacías), como pide la guía.
 */
@Component({
  selector: "eh-logo",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center select-none" [style.gap.px]="size * 0.22">
      <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 120 120" aria-hidden="true">
        <rect width="120" height="120" rx="30" [attr.fill]="tile" />
        @if (size >= 32) {
          <g fill="none" [attr.stroke]="ink" [attr.stroke-opacity]="variant === 'light' ? 0.22 : 0.28" stroke-width="2">
            <circle cx="24" cy="36" r="7" /><circle cx="48" cy="36" r="7" /><circle cx="72" cy="36" r="7" />
            <circle cx="48" cy="60" r="7" /><circle cx="96" cy="60" r="7" />
            <circle cx="24" cy="84" r="7" /><circle cx="72" cy="84" r="7" /><circle cx="96" cy="84" r="7" />
          </g>
          <polyline points="24,60 48,84 72,60 96,36" fill="none" [attr.stroke]="ink" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          <g [attr.fill]="ink"><circle cx="24" cy="60" r="8.5" /><circle cx="48" cy="84" r="8.5" /><circle cx="72" cy="60" r="8.5" /></g>
          <circle cx="96" cy="36" r="9.5" fill="#FFC531" [attr.stroke]="tile" stroke-width="3" />
        } @else {
          <polyline points="24,60 48,84 72,60 96,36" fill="none" [attr.stroke]="ink" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="96" cy="36" r="14" fill="#FFC531" />
        }
      </svg>
      @if (showText) {
        <span class="eh-wordmark" [class.eh-wordmark--light]="variant === 'light'" [style.font-size.px]="size * 0.81">examhub</span>
      }
    </div>
  `,
  styles: [
    `
      .eh-wordmark {
        font-family: Sora, ui-sans-serif, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: -0.045em;
        line-height: 1;
        color: rgb(var(--c-brand-800));
      }
      .eh-wordmark--light {
        color: #f6f3ea;
      }
      :host-context(html.dark) .eh-wordmark:not(.eh-wordmark--light) {
        color: rgb(var(--c-slate-900));
      }
    `,
  ],
})
export class LogoComponent {
  /** Alto del símbolo en píxeles. */
  @Input() size: number = 32;
  /** Mostrar el nombre "examhub" al lado del símbolo. */
  @Input() showText: boolean = true;
  /** 'default' sobre fondos claros, 'light' sobre fondos oscuros. */
  @Input() variant: "default" | "light" = "default";

  /** Baldosa: Tinta (o el color de marca elegido); Papel sobre oscuros. */
  get tile(): string {
    return this.variant === "light" ? "#F6F3EA" : "rgb(var(--c-brand-800))";
  }

  get ink(): string {
    return this.variant === "light" ? "#16205A" : "#F6F3EA";
  }
}
