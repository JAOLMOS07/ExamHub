import { Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { QuestionService } from "../../../../../core/services/questionService.service";
import { Document } from "../../../../../core/models/folder.model";
import { objectType } from "../../../../../core/models/objectType.enum";

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
  /** Número de la pregunta en el examen (las lecturas no se numeran). */
  numberAt(i: number): number | null {
    if (this.questionsSelected[i]?.type === objectType.PASSAGE) return null;
    return this.questionsSelected.slice(0, i + 1).filter((d) => d.type !== objectType.PASSAGE).length;
  }

  removeQuestion(question: Document) {
    this.questionService.removeQuestion(question.id);
  }
}
