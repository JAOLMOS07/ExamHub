import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { NgToastService } from "ng-angular-popup";
import { SharedModule } from "../../../../shared/shared.module";
import {
  BankImportService,
  ParseResult,
} from "../../../../../core/services/bankImport.service";
import { Document } from "../../../../../core/models/folder.model";

type Step = 1 | 2 | 3;

/**
 * Diálogo "Importar banco" — guía al profesor en 3 pasos:
 *
 *   1. Copiar el prompt diseñado para una IA externa.
 *   2. Pegar el JSON que devolvió esa IA.
 *   3. Revisar el preview de las preguntas detectadas y confirmar.
 *
 * No tocamos servidores: la IA la elige el profe (ChatGPT, Claude, Gemini,
 * etc.) y nosotros solo validamos + importamos el resultado.
 */
@Component({
  selector: "app-import-bank-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, SharedModule],
  templateUrl: "./import-bank-dialog.component.html",
})
export class ImportBankDialogComponent {
  step: number = 1;
  /** Texto del prompt + flag de "copiado" para feedback visual. */
  prompt = BankImportService.PROMPT_TEMPLATE;
  promptCopied = false;

  /** JSON pegado por el usuario en el paso 2. */
  jsonText = "";

  /** Resultado del parseo — se llena al pasar al paso 3. */
  parseResult: ParseResult | null = null;

  /** Importando a Firestore (loading). */
  importing = false;

  constructor(
    private dialogRef: MatDialogRef<ImportBankDialogComponent>,
    private importService: BankImportService,
    private toast: NgToastService,
    @Inject(MAT_DIALOG_DATA) public data: { path: string[] }
  ) {}

  // ========== Paso 1 ==========
  async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.prompt);
      this.promptCopied = true;
      this.toast.success("Prompt copiado al portapapeles", "ExamHub", 1500);
      setTimeout(() => (this.promptCopied = false), 2500);
    } catch {
      this.toast.warning(
        "No pudimos copiar automáticamente — seleccioná y copia manualmente.",
        "ExamHub",
        3000
      );
    }
  }

  goToStep(s: Step): void {
    this.step = s;
  }

  // ========== Paso 2 ==========
  validate(): void {
    if (!this.jsonText.trim()) {
      this.toast.warning(
        "Pegá el JSON que te devolvió la IA antes de validar.",
        "ExamHub",
        2500
      );
      return;
    }
    this.parseResult = this.importService.parse(this.jsonText);
    if (this.parseResult.ok) {
      this.step = 3;
    } else {
      this.toast.danger(
        "Encontramos errores en el JSON. Mirá los detalles abajo.",
        "ExamHub",
        4000
      );
    }
  }

  // ========== Paso 3 ==========
  /** Quita una pregunta suelta del preview antes de importar. */
  removeLooseQuestion(i: number): void {
    if (!this.parseResult) return;
    this.parseResult.looseQuestions.splice(i, 1);
  }

  /** Quita una pregunta de dentro de una lectura. */
  removePassageQuestion(pi: number, qi: number): void {
    if (!this.parseResult) return;
    this.parseResult.passages[pi].questions.splice(qi, 1);
  }

  /** Quita una lectura entera (y sus preguntas). */
  removePassage(pi: number): void {
    if (!this.parseResult) return;
    this.parseResult.passages.splice(pi, 1);
  }

  /** Etiqueta legible del tipo de pregunta. */
  kindLabel(q: Document): string {
    switch (q.kind) {
      case "multiple-choice-single" as any:
        return "Opción múltiple";
      case "true-false" as any:
        return "Verdadero / Falso";
      case "open" as any:
        return "Respuesta abierta";
      case "numeric" as any:
        return "Numérica";
      default:
        return "Pregunta";
    }
  }

  /** Total de elementos que se van a importar. */
  get totalToImport(): number {
    if (!this.parseResult) return 0;
    return (
      this.parseResult.looseQuestions.length +
      this.parseResult.passages.length +
      this.parseResult.passages.reduce((a, p) => a + p.questions.length, 0)
    );
  }

  async confirmImport(): Promise<void> {
    if (!this.parseResult) return;
    this.importing = true;
    try {
      const { insertedQuestions, insertedPassages } =
        await this.importService.importToFirestore(
          this.parseResult,
          this.data.path
        );
      this.toast.success(
        `Importado: ${insertedQuestions} pregunta(s) y ${insertedPassages} lectura(s).`,
        "ExamHub",
        3500
      );
      this.dialogRef.close({ imported: true });
    } catch (e: any) {
      this.toast.danger(
        "Error al importar: " + (e?.message ?? "desconocido"),
        "ExamHub",
        4000
      );
    } finally {
      this.importing = false;
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
