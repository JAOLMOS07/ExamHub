import { Component, Inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { Document } from "../../../../../core/models/folder.model";
import { objectType } from "../../../../../core/models/objectType.enum";

/**
 * Diálogo para crear o editar una "Lectura" — un texto largo que
 * sirve como contexto para varias preguntas (común en exámenes de
 * Lenguaje, Sociales y problemas de aplicación en Matemáticas).
 *
 * Devuelve un Document con type = PASSAGE, name = título de la
 * lectura, passageText = texto completo.
 */
@Component({
  selector: "app-create-passage",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <form class="flex flex-col max-h-[92vh] w-[min(720px,94vw)] bg-white" (ngSubmit)="isValid() && save()">
      <header class="px-6 pt-5 pb-3 border-b border-slate-200">
        <h2 class="text-lg font-semibold text-slate-900">{{ editMode ? "Editar lectura" : "Nueva lectura" }}</h2>
        <p class="text-sm text-slate-500 mt-0.5">
          Un texto o contexto común con varias preguntas asociadas. Se imprime una vez, antes de sus preguntas.
        </p>
      </header>
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <label class="eh-field">
          <span>Título</span>
          <input
            type="text"
            class="eh-input"
            placeholder="El agua en San Rafael"
            [(ngModel)]="title"
            name="title"
            required
            minlength="3"
            maxlength="120"
          />
          <small>Se muestra en el banco y como título del texto en el cuadernillo.</small>
        </label>
        <label class="eh-field">
          <span>Texto</span>
          <textarea
            class="eh-input min-h-[260px] resize-y leading-relaxed"
            placeholder="Pega aquí el texto que los estudiantes deben leer…"
            [(ngModel)]="passageText"
            name="passageText"
            required
            minlength="20"
            maxlength="6000"
          ></textarea>
          <small>{{ passageText.length || 0 }} / 6000 caracteres</small>
        </label>
      </div>
      <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
        <button type="button" class="eh-btn eh-btn--ghost" (click)="cancel()">Cancelar</button>
        <button type="submit" class="eh-btn eh-btn--primary" [disabled]="!isValid()">
          {{ editMode ? "Guardar cambios" : "Crear lectura" }}
        </button>
      </footer>
    </form>
  `,

})
export class CreatePassageDialogComponent implements OnInit {
  editMode = false;
  title = "";
  passageText = "";

  constructor(
    private dialogRef: MatDialogRef<CreatePassageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { passage?: Document }
  ) {}

  ngOnInit(): void {
    if (this.data?.passage) {
      this.editMode = true;
      this.title = this.data.passage.name;
      this.passageText = this.data.passage.passageText ?? "";
    }
  }

  isValid(): boolean {
    return (
      this.title.trim().length >= 3 &&
      this.passageText.trim().length >= 20
    );
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.isValid()) return;
    const result: Document = {
      id: this.editMode ? this.data.passage!.id : crypto.randomUUID(),
      name: this.title.trim(),
      type: objectType.PASSAGE,
      passageText: this.passageText.trim(),
      content: this.editMode ? this.data.passage!.content : [],
    } as Document;
    this.dialogRef.close(result);
  }
}
