import { Component } from "@angular/core";
import { SharedModule } from "../../shared/shared.module";
import { FormsModule } from "@angular/forms";
import { Document, Option } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { MatDialog } from "@angular/material/dialog";
import { CreateFolderComponent } from "./components/create-folder/create-folder.component";
import { CommonModule } from "@angular/common";
import { CreateQuestionDialogComponent } from "../../exam/create-question-dialog/create-question.component";
import { CreatePassageDialogComponent } from "./components/create-passage/create-passage.component";
import { QuestionService } from "../../../core/services/questionService.service";
import { PrincipalModule } from "../principal.module";
import { GenerateExamDialogComponent } from "../../exam/generate-exam-dialog/generate-exam-dialog.component";
import { ExamService } from "../../../core/services/ExamService.service";
import { UserService } from "../../../core/services/UserService.service";
import { NgToastService } from "ng-angular-popup";
import { filter, take } from "rxjs/operators";
import {
  SweetAlert2LoaderService,
  SweetAlert2Module,
} from "@sweetalert2/ngx-sweetalert2";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
    CommonModule,
    PrincipalModule,
    SweetAlert2Module,
  ],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.css"],
})
export class HomeComponent {
  objectType = objectType;
  isLoading: boolean = false;
  showCurrentExam: boolean = false;
  questionsSelected: Document[] = [];
  documents: Document[] = [];

  paths: string[] = ["Inicio"];

  currentPath: string[] = ["1"];

  /**
   * Pista de los tipos de cada nivel del path (paralelo a currentPath).
   * Sirve para saber si el usuario está navegando DENTRO de una
   * lectura — en ese caso ocultamos el botón "Crear Lectura" porque
   * no permitimos anidar lecturas.
   */
  pathTypes: objectType[] = [objectType.FOLDER];

  /**
   * Si estamos navegando DENTRO de una lectura, guardamos su Document
   * completo (incluyendo passageText) para poder asociar las preguntas
   * que se creen acá — les seteamos passageId y copiamos passageContext.
   */
  currentPassage: Document | null = null;

  get isInsidePassage(): boolean {
    return this.pathTypes[this.pathTypes.length - 1] === objectType.PASSAGE;
  }

  /** Contadores rápidos para mostrar en el header del nivel actual. */
  get folderCount(): number {
    return this.documents.filter((d) => d.type === objectType.FOLDER).length;
  }
  get passageCount(): number {
    return this.documents.filter((d) => d.type === objectType.PASSAGE).length;
  }
  get questionCount(): number {
    return this.documents.filter((d) => d.type === objectType.QUESTION).length;
  }
  get isEmpty(): boolean {
    return !this.isLoading && this.documents.length === 0;
  }

  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService,
    private examService: ExamService,
    private userService: UserService,
    private toast: NgToastService
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });

    // Esperamos a que Firebase confirme el usuario antes de pedirle a
    // Firestore. Si HomeComponent se construye antes de que
    // onAuthStateChanged emita (caso típico en navegación
    // /login → /home), evitamos el error "no hay usuario autenticado".
    this.userService.currentUser$
      .pipe(
        filter((user) => !!user),
        take(1)
      )
      .subscribe(() => this.loadDocuments());
  }
  loadDocuments(): void {
    this.isLoading = true;
    this.examService.getDocuments(this.currentPath).subscribe((docs) => {
      this.documents = docs;
      this.isLoading = false;
    });
  }
  folderName: string = "";

  get currentFolders(): Document[] {
    let folders = this.documents;
    for (const id of this.currentPath) {
      const foundFolder = folders.find(
        (f) => f.id === id && f.type === objectType.FOLDER
      );
      if (foundFolder && foundFolder.content) {
        folders = foundFolder.content;
      } else {
        return [];
      }
    }
    return folders;
  }

  deleteQuestion(question: Document[]): void {}
  questionSelected(question: Document): boolean {
    return this.questionsSelected.some((q) => q.id === question.id);
  }
  editDocument(docuent: Document) {
    this.examService
      .updateDocument(this.currentPath, docuent.id, docuent)
      .then(() => {
        this.toast.success("Modificado con éxito", "ExamHub", 2000);
      })
      .catch(() => {
        this.toast.danger("Error al editar", "ExamHub", 2000);
      })
      .finally(() => {
        this.loadDocuments();
      });
  }
  createFolderDialog(): void {
    const dialogRef = this.dialog.open(CreateFolderComponent, {
      data: {},
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addFolder(result);
      }
    });
  }

  /**
   * Abre el diálogo para crear una nueva lectura. Una lectura es un
   * Document con type=PASSAGE: tiene un texto introductorio y un
   * arreglo de preguntas hijas. Se navega adentro como una carpeta.
   */
  createPassageDialog(): void {
    const dialogRef = this.dialog.open(CreatePassageDialogComponent, {
      data: {},
    });
    dialogRef.afterClosed().subscribe((result: Document) => {
      if (!result) return;
      this.examService
        .createDocument(this.currentPath, result)
        .then(() => {
          this.toast.success("Lectura creada con éxito", "ExamHub", 2000);
        })
        .catch(() => {
          this.toast.danger("Error al crear la lectura", "ExamHub", 2000);
        })
        .finally(() => {
          this.loadDocuments();
        });
    });
  }

  /**
   * Editar el título y/o texto de una lectura existente.
   */
  editPassageDialog(passage: Document): void {
    const dialogRef = this.dialog.open(CreatePassageDialogComponent, {
      data: { passage },
    });
    dialogRef.afterClosed().subscribe((result: Document) => {
      if (!result) return;
      // Conservamos el contenido (preguntas hijas) — el diálogo solo
      // edita título y texto.
      result.content = passage.content;
      this.editDocument(result);
    });
  }

  /**
   * Agrega una lectura completa al examen actual: incluye la lectura
   * misma (como bloque de texto) y todas sus preguntas hijas.
   *
   * IMPORTANTE: las preguntas hijas NO están en `passage.content`
   * porque en Firestore viven en una SUBCOLECCIÓN (`/<uid>/.../passageId/content/`).
   * Tenemos que pedirlas explícitamente al service.
   */
  addPassageToExam(passage: Document): void {
    this.questionService.addQuestion(passage);
    const childPath = [...this.currentPath, passage.id];
    this.examService
      .getDocuments(childPath)
      .pipe(take(1))
      .subscribe((children) => {
        let added = 0;
        for (const child of children) {
          if (child.type === objectType.QUESTION) {
            // Defensa en profundidad: si la pregunta no tiene
            // passageId/Context (porque se creó antes de este fix),
            // se los seteamos al vuelo. Así el generator puede
            // armar el bloque de contexto correctamente.
            if (!child.passageId) child.passageId = passage.id;
            if (!child.passageContext && passage.passageText) {
              child.passageContext = passage.passageText;
            }
            this.questionService.addQuestion(child);
            added++;
          }
        }
        this.toast.success(
          `Lectura + ${added} pregunta(s) agregadas al examen`,
          "ExamHub",
          2500
        );
      });
  }
  editFolderDialog(folder: Document): void {
    const dialogRef = this.dialog.open(CreateFolderComponent, {
      data: { folder: folder },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.editDocument(result);
      }
    });
  }
  createQuestionDialog(): void {
    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      data: {},
    });

    dialogRef.afterClosed().subscribe((result: Document) => {
      if (!result) return;

      // Si estamos creando dentro de una lectura, asociamos la
      // pregunta a esa lectura: guardamos el id de la lectura
      // (passageId) y una copia del texto de contexto (passageContext).
      // Eso permite que, al armar el examen con esta pregunta sola,
      // se pueda imprimir su contexto incluso si no agregamos la
      // lectura entera.
      if (this.isInsidePassage && this.currentPassage) {
        result.passageId = this.currentPassage.id;
        result.passageContext = this.currentPassage.passageText;
      }

      this.examService
        .createDocument(this.currentPath, result)
        .then(() => {
          this.toast.success("Pregunta creada con éxito", "ExamHub", 2000);
          this.addFolderToPath(result);
        })
        .catch(() => {
          this.toast.danger("Error al crear la pregunta", "ExamHub", 2000);
        })
        .finally(() => {
          this.loadDocuments();
        });
    });
  }

  addFolder(name: string): void {
    const newFolder: Document = {
      id: crypto.randomUUID(),
      type: objectType.FOLDER,
      name,
      content: [],
    };

    this.examService
      .createDocument(this.currentPath, newFolder)
      .then(() => {
        this.toast.success("Carpeta creada con éxito", "ExamHub", 2000);
        this.addFolderToPath(newFolder);
      })
      .catch(() => {
        this.toast.danger("Error al crear la carpeta", "ExamHub", 2000);
      })
      .finally(() => {
        this.loadDocuments();
      });
  }

  addFolderToPath(folder: Document): void {}

  deleteDocument(document: Document): void {
    this.examService
      .deleteDocumentAndCollection(this.currentPath, document.id)
      .then(() => {
        this.toast.success("Eliminada con éxito", "ExamHub", 2000);
      })
      .catch(() => {
        this.toast.danger("Error al eliminar", "ExamHub", 2000);
      })
      .finally(() => {
        this.loadDocuments();
      });
  }
  navigateToFolder(folder: Document): void {
    this.documents = [];
    this.currentPath.push(folder.id);
    this.paths.push(folder.name);
    this.pathTypes.push(folder.type);
    // Si entramos en una lectura, la guardamos para asociar preguntas
    // creadas adentro. Si entramos en una carpeta, limpiamos
    // (estamos saliendo de cualquier contexto de lectura).
    if (folder.type === objectType.PASSAGE) {
      this.currentPassage = folder;
    } else {
      this.currentPassage = null;
    }
    this.loadDocuments();
  }
  protected showModalGenerateExam(): void {
    this.dialog.open(GenerateExamDialogComponent, {
      width: "900px",
    });
  }
  discardExam() {
    this.questionService.discardExam();
  }
  goBack(): void {
    if (this.currentPath.length > 1) {
      this.currentPath.pop();
      this.paths.pop();
      this.pathTypes.pop();
      // Si subimos de nivel y ya no estamos dentro de una lectura,
      // limpiamos el contexto.
      if (!this.isInsidePassage) {
        this.currentPassage = null;
      }
      this.loadDocuments();
    }
  }
}
