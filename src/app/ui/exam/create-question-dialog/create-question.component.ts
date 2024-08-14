import { Component, Inject, output, Output } from "@angular/core";
import { Option, Question } from "../../../core/models/question.model";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { FormBuilder } from "@angular/forms";
import { Document } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";

@Component({
  selector: "app-create-question",
  templateUrl: "./create-question.component.html",
  styleUrl: "./create-question.component.css",
})
export class CreateQuestionDialogComponent {
  questions: Question[] = [];

  newQuestion!: Document;
  onPushNewQuestion = output<Question>();
  options: Option[] = [new Option("", "", false)];
  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<CreateQuestionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { question: Document }
  ) {
    this.resetNewQuestion();
  }

  ngOnInit() {}

  resetNewQuestion() {
    this.newQuestion = {
      id: "",
      name: "",
      type: objectType.QUESTION,
      options: [],
    };
  }

  addOption() {
    this.options.push(new Option("", "", false));
  }

  removeOption(index: number) {
    this.options.splice(index, 1);
  }

  addQuestion() {
    const hasCorrectOption = this.options.some((opt) => opt.correct);

    if (hasCorrectOption || this.options.length === 0) {
      this.data.question = {
        id: crypto.randomUUID(),
        name: this.newQuestion.name,
        type: objectType.QUESTION,
        options: this.options.map(
          (opt) => new Option(crypto.randomUUID(), opt.content, opt.correct)
        ),
      };

      this.dialogRef.close(this.data.question);
      this.resetNewQuestion();
    } else {
      alert(
        "Debe haber al menos una opción correcta o ninguna opción para preguntas abiertas."
      );
    }
  }
}
