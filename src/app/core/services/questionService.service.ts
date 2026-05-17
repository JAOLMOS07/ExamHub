import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { NgToastService } from "ng-angular-popup";
import { objectType } from "../models/objectType.enum";
import { Document } from "../models/folder.model";

/**
 * Maneja el "examen actual" — la lista de preguntas que el profesor
 * fue seleccionando del banco para generar el PDF.
 *
 * Estado in-memory por sesión. Si se recarga la página, se pierde.
 * (En v2 conviene persistirlo en localStorage o Firestore.)
 */
@Injectable({
  providedIn: "root",
})
export class QuestionService {
  private questionsSubject: BehaviorSubject<Document[]> = new BehaviorSubject<
    Document[]
  >([]);
  private questions: Document[] = [];

  constructor(private toast: NgToastService) {}

  getQuestions(): Observable<Document[]> {
    return this.questionsSubject.asObservable();
  }

  addQuestion(question: Document): void {
    // Aceptamos preguntas Y lecturas (passages) — los passages se
    // renderizan como bloques de contexto en el PDF, antes de las
    // preguntas hijas.
    if (
      question.type !== objectType.QUESTION &&
      question.type !== objectType.PASSAGE
    ) {
      console.error(
        "Solo se pueden agregar preguntas o lecturas al examen actual."
      );
      return;
    }

    const exists = this.questions.some((q) => q.id === question.id);
    if (exists) {
      // Si ya está, no lo agregamos otra vez — pero tampoco mostramos
      // toast porque es común agregar masivamente y los duplicados
      // son normales.
      return;
    }

    this.questions.push(question);
    this.questionsSubject.next(this.questions);
  }

  removeQuestion(questionId: string): void {
    const questionIndex = this.questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) {
      this.toast.warning(
        "No se encontró la pregunta a quitar.",
        "ExamHub",
        2000
      );
      return;
    }

    this.questions.splice(questionIndex, 1);
    this.questionsSubject.next(this.questions);
  }

  discardExam(): void {
    this.questions = [];
    this.questionsSubject.next(this.questions);
  }
}
