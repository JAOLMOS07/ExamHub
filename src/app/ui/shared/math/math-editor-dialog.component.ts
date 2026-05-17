import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  Inject,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";

// Registra el custom element <math-field> globalmente.
import "mathlive";

export interface MathEditorDialogData {
  latex?: string;
  displayMode?: boolean;
}

export interface MathEditorDialogResult {
  latex: string;
  displayMode: boolean;
}

/**
 * Diálogo con editor visual de ecuaciones (MathLive).
 *
 * Comportamiento del teclado virtual:
 *   - Por defecto en MathLive el teclado virtual aparece "on focus" en
 *     dispositivos táctiles, pero NO en desktop. El usuario reportó
 *     que no lo veía nunca → ahora hay un botón explícito para
 *     mostrarlo/ocultarlo y se redirige al container del modal con
 *     `mathVirtualKeyboard.container` para que quede dentro y no
 *     debajo del backdrop.
 *
 *   - La toolbar de atajos rápidos (símbolos clickeables que insertan
 *     LaTeX) se mantiene siempre visible — al usuario le gustó.
 */
@Component({
  selector: "app-math-editor-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h2 mat-dialog-title>Editor de ecuación</h2>
    <mat-dialog-content #dialogContent>
      <div class="space-y-3 p-2 min-w-[480px]">
        <p class="text-sm text-gray-600">
          Compone la fórmula con los botones de abajo o tipeando atajos:
          <code>/</code> fracción, <code>^</code> exponente,
          <code>_</code> subíndice, <code>sqrt</code> raíz.
        </p>

        <math-field
          #mathField
          math-virtual-keyboard-policy="manual"
          class="block w-full border border-gray-300 rounded-md p-3 text-2xl bg-white shadow-sm"
        ></math-field>

        <!-- Toolbar de símbolos rápidos -->
        <div>
          <div class="text-xs font-semibold text-gray-500 mb-1">
            Símbolos rápidos
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              class="btn btn-xs btn-outline"
              *ngFor="let s of quickSymbols"
              (click)="insertSymbol(s.latex)"
              [title]="s.title"
            >
              <span [innerHTML]="s.label"></span>
            </button>
          </div>
        </div>

        <!-- Toggle del teclado virtual completo -->
        <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            class="btn btn-xs btn-outline"
            (click)="toggleKeyboard()"
          >
            {{ keyboardVisible ? "Ocultar teclado" : "Mostrar teclado completo" }}
          </button>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              [(ngModel)]="displayMode"
              class="checkbox checkbox-sm"
            />
            Ecuación en bloque (centrada, más grande)
          </label>
        </div>

        <details class="text-xs text-gray-500">
          <summary class="cursor-pointer">Ver LaTeX generado</summary>
          <pre class="mt-2 bg-gray-100 p-2 rounded text-gray-700 overflow-x-auto">{{ getCurrentLatex() }}</pre>
        </details>

        <!-- Contenedor donde MathLive monta el teclado virtual -->
        <div #keyboardHost class="math-keyboard-host"></div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="justify-end gap-2">
      <button class="btn btn-sm btn-ghost" (click)="cancel()">Cancelar</button>
      <button class="btn btn-sm btn-primary" (click)="insert()">
        Insertar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .math-keyboard-host {
        min-height: 0;
      }
      .math-keyboard-host:empty {
        display: none;
      }
    `,
  ],
})
export class MathEditorDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild("mathField") mathFieldRef!: ElementRef<any>;
  @ViewChild("keyboardHost") keyboardHostRef!: ElementRef<HTMLDivElement>;

  initialLatex: string = "";
  displayMode: boolean = false;
  keyboardVisible: boolean = false;

  /** Atajos rápidos — al usuario le gustaron, los mantenemos. */
  quickSymbols = [
    { label: "x²", latex: "^{2}", title: "Cuadrado" },
    { label: "x³", latex: "^{3}", title: "Cubo" },
    { label: "xⁿ", latex: "^{#?}", title: "Exponente" },
    { label: "x₁", latex: "_{#?}", title: "Subíndice" },
    { label: "a/b", latex: "\\frac{#?}{#?}", title: "Fracción" },
    { label: "√", latex: "\\sqrt{#?}", title: "Raíz cuadrada" },
    { label: "ⁿ√", latex: "\\sqrt[#?]{#?}", title: "Raíz n-ésima" },
    { label: "π", latex: "\\pi", title: "Pi" },
    { label: "θ", latex: "\\theta", title: "Theta" },
    { label: "α", latex: "\\alpha", title: "Alfa" },
    { label: "β", latex: "\\beta", title: "Beta" },
    { label: "Δ", latex: "\\Delta", title: "Delta" },
    { label: "∞", latex: "\\infty", title: "Infinito" },
    { label: "∑", latex: "\\sum_{#?}^{#?}", title: "Sumatoria" },
    { label: "∫", latex: "\\int_{#?}^{#?}", title: "Integral" },
    { label: "lim", latex: "\\lim_{#?}", title: "Límite" },
    { label: "≤", latex: "\\le", title: "Menor o igual" },
    { label: "≥", latex: "\\ge", title: "Mayor o igual" },
    { label: "≠", latex: "\\ne", title: "Distinto" },
    { label: "≈", latex: "\\approx", title: "Aproximado" },
  ];

  private previousKeyboardContainer: HTMLElement | null = null;

  constructor(
    private dialogRef: MatDialogRef<
      MathEditorDialogComponent,
      MathEditorDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public data: MathEditorDialogData
  ) {
    this.initialLatex = data?.latex ?? "";
    this.displayMode = data?.displayMode ?? false;
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const field: any = this.mathFieldRef?.nativeElement;
      if (!field) return;

      // Cargar la fórmula inicial via API (no como texto del contenido)
      if (this.initialLatex) {
        field.value = this.initialLatex;
      }

      // Redirigir el teclado virtual al modal — así no queda flotante
      // debajo del backdrop con blur.
      const vk: any = (window as any).mathVirtualKeyboard;
      if (vk && this.keyboardHostRef?.nativeElement) {
        this.previousKeyboardContainer = vk.container ?? null;
        vk.container = this.keyboardHostRef.nativeElement;
      }

      field.focus?.();
    });
  }

  ngOnDestroy(): void {
    const vk: any = (window as any).mathVirtualKeyboard;
    if (vk) {
      vk.container = this.previousKeyboardContainer;
      try {
        vk.hide?.();
      } catch {
        // ignorar
      }
    }
  }

  toggleKeyboard(): void {
    const vk: any = (window as any).mathVirtualKeyboard;
    if (!vk) return;
    if (this.keyboardVisible) {
      vk.hide?.();
      this.keyboardVisible = false;
    } else {
      // Asegurar que el container apunte al modal antes de mostrar
      if (this.keyboardHostRef?.nativeElement) {
        vk.container = this.keyboardHostRef.nativeElement;
      }
      vk.show?.();
      this.keyboardVisible = true;
    }
  }

  insertSymbol(latex: string): void {
    const field: any = this.mathFieldRef?.nativeElement;
    if (!field) return;
    if (typeof field.insert === "function") {
      field.insert(latex, { focus: true, selectionMode: "placeholder" });
    } else {
      field.value = (field.value ?? "") + latex;
    }
  }

  getCurrentLatex(): string {
    const field: any = this.mathFieldRef?.nativeElement;
    return field?.value ?? this.initialLatex;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  insert(): void {
    const latex = this.getCurrentLatex().trim();
    if (!latex) {
      this.dialogRef.close();
      return;
    }
    this.dialogRef.close({ latex, displayMode: this.displayMode });
  }
}
