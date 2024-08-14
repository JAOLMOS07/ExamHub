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

@Component({
  selector: "app-home",
  standalone: true,
  imports: [FormsModule, SharedModule, CommonModule, PrincipalModule],
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
    private examService: ExamService
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

  openDialog(): void {
    const dialogRef = this.dialog.open(CreateFolderComponent, {
      data: { folderName: this.folderName },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addFolder(result);
      }
    });
  }
  createQuestionDialog(): void {
    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      data: {
        question: { id: "", name: "", type: objectType.QUESTION, options: [] },
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.examService.createDocument(this.currentPath, result);
        this.loadDocuments();
        this.addFolderToPath(result);
      }
    });
  }

  addQuestionCurrentExam(question: Document) {
    this.questionService.addQuestion(question);
  }
  removeQuestionCurrentExam(question: Document) {
    this.questionService.removeQuestion(question.id);
  }
  addFolder(name: string): void {
    const newFolder: Document = {
      id: crypto.randomUUID(),
      type: objectType.FOLDER,
      name,
      content: [],
    };

    this.examService.createDocument(this.currentPath, newFolder);
    this.loadDocuments();
    this.addFolderToPath(newFolder);
  }

  addFolderToPath(folder: Document): void {
    /*     let folders = this.documents;
    for (const id of this.currentPath) {
      const foundFolder = folders.find((f) => f.id === id);
      if (foundFolder && foundFolder.content) {
        folders = foundFolder.content;
      } else {
        console.error(
          `Carpeta con ID ${id} no encontrada en el path ${this.currentPath.join(
            "/"
          )}`
        );
        return;
      }
    }

    folders.push(folder); */
  }
  deleteDocument(document: Document): void {
    if (confirm(`¿Estás seguro de que deseas eliminar ${document.name}?`)) {
      this.examService;
      this.examService
        .deleteDocumentAndCollection(this.currentPath, document.id)
        .then(() => {
          this.loadDocuments();
        });
    }
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
  goBack(): void {
    if (this.currentPath.length > 1) {
      this.currentPath.pop();
      this.paths.pop();
      this.loadDocuments();
    }
  }
}
