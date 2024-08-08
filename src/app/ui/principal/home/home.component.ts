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

@Component({
  selector: "app-home",
  standalone: true,
  imports: [FormsModule, SharedModule, CommonModule, PrincipalModule],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.css"],
})
export class HomeComponent {
  objectType = objectType;
  questionsSelected: Document[] = [];
  documents: Document[] = [
    {
      id: "1",
      type: objectType.folder,
      name: "Inicio",
      content: [
        {
          id: "2",
          type: objectType.folder,
          name: "Matemáticas",
          content: [
            {
              id: "3",
              type: objectType.folder,
              name: "Álgebra",
              content: [
                {
                  id: "5",
                  type: objectType.question,
                  name: "¿Cuál es la solución de la ecuación 2x + 3 = 7?",
                  options: [
                    new Option("o1", "x = 2", false),
                    new Option("o2", "x = 1", true),
                    new Option("o3", "x = 0", false),
                    new Option("o4", "x = 3", false),
                  ],
                },
                {
                  id: "6",
                  type: objectType.question,
                  name: "¿Cuál es la forma general de una ecuación cuadrática?",
                  options: [
                    new Option("o1", "ax^2 + bx + c = 0", true),
                    new Option("o2", "ax + b = c", false),
                    new Option("o3", "ax^2 = bx - c", false),
                    new Option("o4", "ax^2 + bx = c", false),
                  ],
                },
              ],
            },
            {
              id: "4",
              type: objectType.folder,
              name: "Geometría",
              content: [
                {
                  id: "7",
                  type: objectType.question,
                  name: "¿Cuál es el área de un triángulo de base 4 cm y altura 5 cm?",
                  options: [
                    new Option("o1", "10 cm²", true),
                    new Option("o2", "20 cm²", false),
                    new Option("o3", "15 cm²", false),
                    new Option("o4", "25 cm²", false),
                  ],
                },
                {
                  id: "8",
                  type: objectType.question,
                  name: "¿Cuál es la suma de los ángulos internos de un triángulo?",
                  options: [
                    new Option("o1", "180°", true),
                    new Option("o2", "360°", false),
                    new Option("o3", "90°", false),
                    new Option("o4", "270°", false),
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "9",
          type: objectType.folder,
          name: "Idiomas",
          content: [
            {
              id: "10",
              type: objectType.folder,
              name: "Inglés",
              content: [
                {
                  id: "11",
                  type: objectType.question,
                  name: "¿Cuál es el sinónimo de 'happy'?",
                  options: [
                    new Option("o1", "Sad", false),
                    new Option("o2", "Joyful", true),
                    new Option("o3", "Angry", false),
                    new Option("o4", "Tired", false),
                  ],
                },
                {
                  id: "12",
                  type: objectType.question,
                  name: "¿Cómo se dice 'perro' en inglés?",
                  options: [
                    new Option("o1", "Cat", false),
                    new Option("o2", "Bird", false),
                    new Option("o3", "Dog", true),
                    new Option("o4", "Fish", false),
                  ],
                },
              ],
            },
            {
              id: "13",
              type: objectType.folder,
              name: "Español",
              content: [
                {
                  id: "14",
                  type: objectType.question,
                  name: "¿Cuál es un sinónimo de 'rápido'?",
                  options: [
                    new Option("o1", "Lento", false),
                    new Option("o2", "Veloz", true),
                    new Option("o3", "Torpe", false),
                    new Option("o4", "Pesado", false),
                  ],
                },
                {
                  id: "15",
                  type: objectType.question,
                  name: "¿Cuál es el antónimo de 'feliz'?",
                  options: [
                    new Option("o1", "Triste", true),
                    new Option("o2", "Contento", false),
                    new Option("o3", "Alegre", false),
                    new Option("o4", "Satisfecho", false),
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "16",
          type: objectType.question,
          name: "¿Cuál es el río más largo del mundo?",
          options: [
            new Option("o1", "Amazonas", true),
            new Option("o2", "Nilo", false),
            new Option("o3", "Yangtsé", false),
            new Option("o4", "Misisipi", false),
          ],
        },
      ],
    },
  ];

  paths: string[] = ["Inicio"];

  currentPath: string[] = ["1"];

  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.questionsSelected = questions;
    });
  }

  folderName: string = "";

  get currentFolders(): Document[] {
    let folders = this.documents;
    for (const id of this.currentPath) {
      const foundFolder = folders.find(
        (f) => f.id === id && f.type === objectType.folder
      );
      if (foundFolder && foundFolder.content) {
        folders = foundFolder.content;
      } else {
        return [];
      }
    }
    return folders;
  }
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
      } else {
        console.log("Diálogo cancelado o cerrado sin resultado");
      }
    });
  }
  createQuestionDialog(): void {
    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      data: {
        question: { id: "", name: "", type: objectType.question, options: [] },
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addFolderToPath(result);
      } else {
        console.log("Diálogo cancelado o cerrado sin resultado");
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
      type: objectType.folder,
      name,
      content: [],
    };

    this.addFolderToPath(newFolder);
    console.log(`Nueva carpeta creada:`, this.documents);
  }

  addFolderToPath(folder: Document): void {
    let folders = this.documents;
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

    folders.push(folder);
  }

  navigateToFolder(folder: Document): void {
    this.currentPath.push(folder.id);
    this.paths.push(folder.name);
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
    }
  }
}
