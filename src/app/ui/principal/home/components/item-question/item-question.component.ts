import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  Document,
  getQuestionKind,
} from "../../../../../core/models/folder.model";
import { environment } from "../../../../../../environments/environment";
import {
  QUESTION_KIND_ICON,
  QUESTION_KIND_LABEL,
} from "../../../../../core/models/questionKind.enum";
import {
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  Difficulty,
} from "../../../../../core/models/difficulty.enum";
import { QuestionService } from "../../../../../core/services/questionService.service";
import { MatDialog } from "@angular/material/dialog";
import { CreateQuestionDialogComponent } from "../../../../exam/create-question-dialog/create-question.component";
import { ToastService } from "../../../../../core/services/toast.service";
import { ConfirmService } from "../../../../../core/services/confirm.service";

@Component({
  selector: "app-item-question",
  templateUrl: "./item-question.component.html",
  styleUrl: "./item-question.component.css",
})
export class ItemQuestionComponent {
  questionsSelected: Document[] = [];
  questionCopied: boolean = false;
  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });
  }

  @Input() question!: Document;
  /** Sugerencias para autocompletar al editar (vienen del HomeComponent). */
  @Input() subjectSuggestions: string[] = [];
  @Input() gradeSuggestions: string[] = [];
  @Output() deleteEvent = new EventEmitter<Document>();
  @Output() editEvent = new EventEmitter<Document>();

  /** Feature flag: las imágenes están off en MVP. Cuando esté on, la
   *  tarjeta muestra el thumbnail y el badge de "tiene imagen". */
  imagesEnabled = environment.features?.enableImages === true;

  /** Etiqueta del tipo de pregunta para mostrar en el badge. */
  get kindLabel(): string {
    return QUESTION_KIND_LABEL[getQuestionKind(this.question)];
  }

  /** Ícono Material asociado al tipo. */
  get kindIcon(): string {
    return QUESTION_KIND_ICON[getQuestionKind(this.question)];
  }

  /** Color de fondo/texto/borde para el badge de dificultad. */
  get difficultyStyle(): { bg: string; text: string; border: string } | null {
    if (!this.question.difficulty) return null;
    return DIFFICULTY_COLOR[this.question.difficulty as Difficulty] ?? null;
  }
  get difficultyLabel(): string {
    if (!this.question.difficulty) return "";
    return DIFFICULTY_LABEL[this.question.difficulty as Difficulty] ?? "";
  }

  async confirmDelete(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "¿Eliminar esta pregunta?",
      message: "No se puede deshacer.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (confirmed) this.deleteDocument();
  }

  deleteDocument(): void {
    this.deleteEvent.emit(this.question);
  }
  questionSelected(): boolean {
    return this.questionsSelected.some((q) => q.id === this.question.id);
  }

  private convertDocumentToText(document: Document): string {
    let text = `${document.name}\n`;

    if (document.options) {
      document.options.forEach((option, index) => {
        text += `${this.getAlphabetLetter(index + 1)}. ${option.content}\n`;
      });
    }

    return text;
  }

  editQuestionDialog(): void {
    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      data: {
        question: this.question,
        subjectSuggestions: this.subjectSuggestions,
        gradeSuggestions: this.gradeSuggestions,
      },
    });

    dialogRef.afterClosed().subscribe((result: Document) => {
      if (result) {
        this.question.name = result.name;
        this.question.kind = result.kind;
        this.question.options = result.options;
        this.question.numericAnswer = result.numericAnswer;
        this.question.numericTolerance = result.numericTolerance;
        this.question.imageUrl = result.imageUrl;
        this.question.imagePath = result.imagePath;
        this.question.subject = result.subject;
        this.question.grade = result.grade;
        this.question.difficulty = result.difficulty;
        this.editEvent.emit(this.question);
      }
    });
  }

  addQuestionCurrentExam() {
    this.questionService.addQuestion(this.question);
  }
  removeQuestionCurrentExam() {
    this.questionService.removeQuestion(this.question.id);
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => {
        this.questionCopied = true;
        setTimeout(() => {
          this.questionCopied = false;
        }, 1500);
      },
      (err) => {}
    );
  }
  getAlphabetLetter(number: number): string {
    if (number < 1 || number > 26) {
      throw new Error("El número debe estar entre 1 y 26.");
    }

    return String.fromCharCode(65 + number - 1);
  }
  copyQuestions(): void {
    const text = this.convertDocumentToText(this.question);
    this.copyToClipboard(text);
    this.toast.info("Pregunta copiada en el portapapeles", "ExamHub", 1000);
  }
}
