import { Component } from "@angular/core";
import { Question, Option } from "../../core/models/question.model";
import { PDFService } from "../../core/services/pdfService.service";
import { SharedModule } from "../shared/shared.module";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { GenerateExamDialogComponent } from "./generate-exam-dialog/generate-exam-dialog.component";

@Component({
  selector: "app-home",
  templateUrl: "./exam.component.html",
  styleUrls: ["./exam.component.css"],
})
export class ExamComponent {
  questions: Question[] = [];
  newQuestion!: Question;

  constructor(private pdfService: PDFService, private dialog: MatDialog) {
    this.resetNewQuestion();
  }

  ngOnInit() {
    // Las preguntas reales se cargan desde el banco del usuario.
    // (Antes había 4 preguntas demo hardcodeadas que se mostraban
    // siempre — quedaron como ruido visible en la pantalla.)
  }
  protected showModalGenerateExam(): void {
    this.dialog.open(GenerateExamDialogComponent, {
      data: { exam: this.questions },
      width: "900px",
    });
  }
  resetNewQuestion() {
    this.newQuestion = new Question("", "", [new Option("", "", false)]);
  }

  addOption() {
    this.newQuestion.options.push(new Option("", "", false));
  }

  removeOption(index: number) {
    this.newQuestion.options.splice(index, 1);
  }

  addQuestion(question: Question) {
    this.questions.push(question);
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
