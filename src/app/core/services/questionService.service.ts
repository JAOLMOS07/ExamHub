import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { objectType } from "../models/objectType.enum";
import { Document } from "../models/folder.model";

@Injectable({
  providedIn: "root",
})
export class QuestionService {
  private questionsSubject: BehaviorSubject<Document[]> = new BehaviorSubject<
    Document[]
  >([]);
  private questions: Document[] = [];

  constructor() {}

  getQuestions(): Observable<Document[]> {
    return this.questionsSubject.asObservable();
  }

  addQuestion(question: Document): void {
    if (question.type !== objectType.question) {
      console.error("Only questions can be added");
      return;
    }

    const questionExists = this.questions.some((q) => q.id === question.id);
    if (questionExists) {
      alert("A question with the same ID already exists!");
      return;
    }

    this.questions.push(question);
    this.questionsSubject.next(this.questions);
  }
  removeQuestion(questionId: string): void {
    const questionIndex = this.questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) {
      alert("Question not found!");
      return;
    }

    this.questions.splice(questionIndex, 1);
    this.questionsSubject.next(this.questions);
  }
}
