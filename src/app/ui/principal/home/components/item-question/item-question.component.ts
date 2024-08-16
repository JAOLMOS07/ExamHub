import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Document } from "../../../../../core/models/folder.model";
import { QuestionService } from "../../../../../core/services/questionService.service";

@Component({
  selector: "app-item-question",
  templateUrl: "./item-question.component.html",
  styleUrl: "./item-question.component.css",
})
export class ItemQuestionComponent {
  questionsSelected: Document[] = [];
  questionCopied: boolean = false;
  constructor(private questionService: QuestionService) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });
  }

  @Input() question!: Document;
  @Output() deleteEvent = new EventEmitter<Document>();

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
  }
}
