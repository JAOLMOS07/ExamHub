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
    <h2 mat-dialog-title>
      {{ editMode ? "Editar lectura" : "Nueva lectura" }}
    </h2>
    <mat-dialog-content class="mat-typography">
      <form (ngSubmit)="save()" class="space-y-4 p-2 min-w-[520px]">
        <div>
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Título de la lectura
          </label>
          <input
            type="text"
            class="input input-bordered w-full border-gray-300 shadow-sm py-2 px-3"
            placeholder="Ej: La Revolución Francesa / Problema de cinemática 1"
            [(ngModel)]="title"
            name="title"
            required
            minlength="3"
            maxlength="120"
          />
          <p class="text-xs text-gray-500 mt-1">
            Es el nombre que ves en el banco. No se imprime en el examen.
          </p>
        </div>

        <div>
          <label class="block text-gray-700 text-sm font-bold mb-2">
            Texto / contexto
          </label>
          <textarea
            class="rounded-md shadow-sm w-full resize-y border border-gray-300 py-3 px-4 text-gray-700 leading-relaxed focus:outline-none focus:border-indigo-500 min-h-[180px]"
            placeholder="Pegá el texto que los estudiantes deben leer antes de responder las preguntas..."
            [(ngModel)]="passageText"
            name="passageText"
            required
            minlength="20"
            maxlength="6000"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">
            Este texto se imprime en el examen, antes de sus preguntas asociadas. Hasta 6000 caracteres.
          </p>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions class="justify-end gap-2">
      <button class="btn btn-sm btn-ghost" (click)="cancel()">Cancelar</button>
      <button
        class="btn btn-sm btn-primary"
        (click)="save()"
        [disabled]="!isValid()"
      >
        {{ editMode ? "Guardar cambios" : "Crear lectura" }}
      </button>
    </mat-dialog-actions>
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
