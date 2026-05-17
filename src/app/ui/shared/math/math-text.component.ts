import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import renderMathInElement from "katex/contrib/auto-render";

/**
 * Renderiza un texto que puede contener fórmulas LaTeX delimitadas:
 *   - $...$    para fórmulas inline
 *   - $$...$$  para fórmulas en bloque
 *
 * IMPORTANTE: el template NO usa `{{ content }}` — el contenido se
 * inyecta exclusivamente desde código. Si el template tuviese
 * interpolación, Angular en cada ciclo de detección de cambios
 * reescribiría el text node del span y sobreescribiría (o duplicaría)
 * lo que KaTeX dejó montado. Mutar el DOM directamente y dejar que
 * Angular respete ese host es la única forma estable.
 */
@Component({
  selector: "math-text",
  standalone: true,
  imports: [CommonModule],
  template: `<span #target class="math-text"></span>`,
  styles: [
    `
      :host {
        display: inline;
      }
      .math-text {
        white-space: pre-wrap;
        word-break: break-word;
      }
      :host ::ng-deep .katex-display {
        margin: 0.4em 0;
      }
    `,
  ],
})
export class MathTextComponent implements OnChanges, AfterViewInit {
  @Input() content: string = "";
  @ViewChild("target", { static: true })
  targetRef!: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.renderInto(this.targetRef.nativeElement, this.content);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.targetRef) {
      this.renderInto(this.targetRef.nativeElement, this.content);
    }
  }

  /**
   * Limpia el elemento y vuelve a montar el texto + fórmulas KaTeX
   * de cero. Es idempotente: llamarlo N veces deja el mismo resultado.
   */
  private renderInto(el: HTMLElement, text: string): void {
    // Limpiamos cualquier hijo previo (incluyendo HTML inyectado por
    // un render anterior).
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
    el.appendChild(document.createTextNode(text ?? ""));
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        errorColor: "#cc0000",
      });
    } catch {
      // Silencioso: si una fórmula es inválida, KaTeX ya la pinta en rojo.
    }
  }

  /**
   * Helper estático: devuelve el HTML resultado de aplicar el render.
   * Usado por el generador de PDF para meter el HTML dentro del iframe
   * aislado.
   */
  static renderToHtml(text: string): string {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text ?? ""));
    try {
      renderMathInElement(div, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        errorColor: "#cc0000",
      });
    } catch {
      // Ignorar
    }
    return div.innerHTML;
  }
}
