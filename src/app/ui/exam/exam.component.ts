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
    this.questions = [
      new Question("q1", "¿Cuál es la capital de Francia?", [
        new Option("o1", "Madrid", false),
        new Option("o2", "Berlin", false),
        new Option("o3", "París", true),
        new Option("o4", "Lisboa", false),
      ]),
      new Question("q2", "¿Cuál es el río más largo del mundo?", [
        new Option("o1", "Amazonas", true),
        new Option("o2", "Nilo", false),
        new Option("o3", "Yangtsé", false),
        new Option("o4", "Misisipi", false),
      ]),
      new Question("q3", "¿Quién pintó la Mona Lisa?", [
        new Option("o1", "Vincent van Gogh", false),
        new Option("o2", "Leonardo da Vinci", true),
        new Option("o3", "Pablo Picasso", false),
        new Option("o4", "Claude Monet", false),
      ]),
      new Question("q4", "¿Cuál es el elemento químico con símbolo O?", [
        new Option("o1", "Oro", false),
        new Option("o2", "Oxígeno", true),
        new Option("o3", "Osmio", false),
        new Option("o4", "Oganesón", false),
      ]),
    ];
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
