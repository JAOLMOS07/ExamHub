import { TestBed } from "@angular/core/testing";
import { Document } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { QuestionService } from "./questionService.service";

describe("QuestionService", () => {
  let service: QuestionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuestionService);
  });

  it("debería ser creado", () => {
    expect(service).toBeTruthy();
  });

  it("debería retornar un observable de preguntas", (done: DoneFn) => {
    service.getQuestions().subscribe((questions) => {
      expect(questions).toEqual([]);
      done();
    });
  });

  it("debería agregar una pregunta si es de tipo QUESTION", () => {
    const nuevaPregunta: Document = {
      id: "1",
      name: "Pregunta 1",
      type: objectType.QUESTION,
    };

    service.addQuestion(nuevaPregunta);

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(1);
      expect(questions[0]).toEqual(nuevaPregunta);
    });
  });

  it("no debería agregar una pregunta si no es de tipo QUESTION", () => {
    const documentoInvalido: Document = {
      id: "2",
      name: "No es una pregunta",
      type: objectType.FOLDER,
    };

    spyOn(console, "error");

    service.addQuestion(documentoInvalido);

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(0);
    });

    expect(console.error).toHaveBeenCalledWith("Only questions can be added");
  });

  it("no debería agregar una pregunta con un ID duplicado", () => {
    const pregunta: Document = {
      id: "1",
      name: "Pregunta 1",
      type: objectType.QUESTION,
    };

    service.addQuestion(pregunta);

    spyOn(window, "alert");
    service.addQuestion(pregunta);

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(1);
    });

    expect(window.alert).toHaveBeenCalledWith(
      "A question with the same ID already exists!"
    );
  });

  it("debería eliminar una pregunta por su ID", () => {
    const pregunta1: Document = {
      id: "1",
      name: "Pregunta 1",
      type: objectType.QUESTION,
    };
    const pregunta2: Document = {
      id: "2",
      name: "Pregunta 2",
      type: objectType.QUESTION,
    };

    service.addQuestion(pregunta1);
    service.addQuestion(pregunta2);

    service.removeQuestion("1");

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(1);
      expect(questions[0]).toEqual(pregunta2);
    });
  });

  it("no debería eliminar una pregunta si el ID no existe", () => {
    spyOn(window, "alert");

    service.removeQuestion("id-no-existente");

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(0);
    });

    expect(window.alert).toHaveBeenCalledWith("Question not found!");
  });

  it("debería descartar todas las preguntas", () => {
    const pregunta: Document = {
      id: "1",
      name: "Pregunta 1",
      type: objectType.QUESTION,
    };

    service.addQuestion(pregunta);

    service.discardExam();

    service.getQuestions().subscribe((questions) => {
      expect(questions.length).toBe(0);
    });
  });
});
