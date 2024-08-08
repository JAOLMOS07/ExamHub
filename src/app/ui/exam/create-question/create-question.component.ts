import { Component, output, Output } from "@angular/core";
import { Option, Question } from "../../../core/models/question.model";

@Component({
  selector: "app-create-question",
  templateUrl: "./create-question.component.html",
  styleUrl: "./create-question.component.css",
})
export class CreateQuestionComponent {
  questions: Question[] = [];
  newQuestion!: Question;
  onPushNewQuestion = output<Question>();
  constructor() {
    this.resetNewQuestion();
  }

  ngOnInit() {}

  resetNewQuestion() {
    this.newQuestion = new Question("", "", [new Option("", "", false)]);
  }

  addOption() {
    this.newQuestion.options.push(new Option("", "", false));
  }

  removeOption(index: number) {
    this.newQuestion.options.splice(index, 1);
  }

  addQuestion() {
    const hasCorrectOption = this.newQuestion.options.some(
      (opt) => opt.correct
    );

    const newQuestionCopy = new Question(
      this.generateId(),
      this.newQuestion.content,
      this.newQuestion.options.map(
        (opt) => new Option(this.generateId(), opt.content, opt.correct)
      )
    );

    if (hasCorrectOption || this.newQuestion.options.length === 0) {
      this.onPushNewQuestion.emit(newQuestionCopy);
      this.resetNewQuestion();
    } else {
      alert(
        "Debe haber al menos una opción correcta o ninguna opción para preguntas abiertas."
      );
    }
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
