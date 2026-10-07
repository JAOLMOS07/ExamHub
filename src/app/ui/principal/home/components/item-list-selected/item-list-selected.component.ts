import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Document } from "../../../../../core/models/folder.model";
import { objectType } from "../../../../../core/models/objectType.enum";
import { getTest } from "../../../../../core/domain/taxonomy/saber11";
import { ALPHABET } from "../../../../../core/utils/alphabet.const";

/**
 * Fila del examen en curso: número, prueba y enunciado (2 líneas).
 * Al tocarla se expande y muestra las opciones; "Ver respuesta"
 * resalta la correcta.
 */
@Component({
  selector: "app-item-list-selected",
  templateUrl: "./item-list-selected.component.html",
  styleUrl: "./item-list-selected.component.css",
})
export class ItemListSelectedComponent {
  @Input() question!: Document;
  /** Número de pregunta en el examen (null para lecturas). */
  @Input() index: number | null = null;
  @Output() deleteEvent = new EventEmitter<Document>();

  readonly ALPHABET = ALPHABET;
  expanded = false;
  showAnswer = false;

  get isPassage(): boolean {
    return this.question.type === objectType.PASSAGE;
  }

  get testShort(): string {
    return getTest(this.question.test)?.shortLabel ?? "";
  }

  removeQuestion(question: Document) {
    this.deleteEvent.emit(question);
  }
}
