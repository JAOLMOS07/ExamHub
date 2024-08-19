import { Component } from "@angular/core";
import { SharedModule } from "../../shared/shared.module";
import { FormsModule } from "@angular/forms";
import { Document, Option } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { MatDialog } from "@angular/material/dialog";
import { CreateFolderComponent } from "./components/create-folder/create-folder.component";
import { CommonModule } from "@angular/common";
import { CreateQuestionDialogComponent } from "../../exam/create-question-dialog/create-question.component";
import { QuestionService } from "../../../core/services/questionService.service";
import { PrincipalModule } from "../principal.module";
import { GenerateExamDialogComponent } from "../../exam/generate-exam-dialog/generate-exam-dialog.component";
import { ExamService } from "../../../core/services/ExamService.service";
import { NgToastService } from "ng-angular-popup";
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

  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService,
    private examService: ExamService,
    private toast: NgToastService
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });
    this.loadDocuments();
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

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.examService
          .createDocument(this.currentPath, result)
          .then(() => {
            this.toast.success("Pregunta creada con éxito", "ExamHub", 2000);
            this.addFolderToPath(result);
          })
          .catch(() => {
            this.toast.danger("Error al creada la pregunta", "ExamHub", 2000);
          })
          .finally(() => {
            this.loadDocuments();
          });
      }
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
        this.toast.danger("Error al creada la carpeta", "ExamHub", 2000);
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
      this.loadDocuments();
    }
  }
}
