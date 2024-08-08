import { Component, Input, output } from "@angular/core";
import { Question } from "../../../core/models/question.model";

@Component({
  selector: "app-questions-list-selected",
  templateUrl: "./questions-list-selected.component.html",
  styleUrl: "./questions-list-selected.component.css",
})
export class QuestionsListSelectedComponent {
  @Input() questions: Question[] = [];
  onDeleteQuestion = output<number>();
  constructor() {}

  ngOnInit() {}

  removeQuestion(index: number) {
    this.onDeleteQuestion.emit(index);
  }
}
