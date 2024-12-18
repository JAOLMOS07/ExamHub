import { Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { QuestionService } from "../../../../../core/services/questionService.service";
import { Document } from "../../../../../core/models/folder.model";

@Component({
  selector: "question-list",
  templateUrl: "./question-list.component.html",
  styleUrl: "./question-list.component.css",
})
export class QuestionListComponent {
  showAnswer: boolean = false;
  questionsSelected: Document[] = [];
  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });
  }
  onHoldStart(): void {
    this.showAnswer = true;
  }

  onHoldEnd(): void {
    this.showAnswer = false;
  }
  removeQuestion(question: Document) {
    this.questionService.removeQuestion(question.id);
  }
}
