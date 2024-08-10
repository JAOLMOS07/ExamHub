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
  showCurrentExam: boolean = true;
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
          name: "Matemáticas Avanzadas",
          content: [
            {
              id: "3",
              type: objectType.folder,
              name: "Cálculo Diferencial",
              content: [
                {
                  id: "5",
                  type: objectType.question,
                  name: "¿Cuál es la derivada de la función f(x) = x^3 - 3x^2 + 5x - 2?",
                  options: [
                    new Option("o1", "f'(x) = 3x^2 - 6x + 5", true),
                    new Option("o2", "f'(x) = 3x^2 + 3x + 5", false),
                    new Option("o3", "f'(x) = x^3 - 6x + 5", false),
                    new Option("o4", "f'(x) = 3x^2 - 3x + 2", false),
                  ],
                },
                {
                  id: "6",
                  type: objectType.question,
                  name: "¿Qué teorema permite relacionar la derivada de una función continua en un intervalo cerrado con los extremos de dicho intervalo?",
                  options: [
                    new Option("o1", "Teorema de Rolle", true),
                    new Option("o2", "Teorema del Valor Medio", false),
                    new Option("o3", "Teorema de Lagrange", false),
                    new Option("o4", "Teorema Fundamental del Cálculo", false),
                  ],
                },
              ],
            },
            {
              id: "4",
              type: objectType.folder,
              name: "Álgebra Lineal",
              content: [
                {
                  id: "7",
                  type: objectType.question,
                  name: "¿Cuál es la matriz inversa de A si A = [[2, 1], [5, 3]]?",
                  options: [
                    new Option("o1", "A^(-1) = [[3, -1], [-5, 2]]", false),
                    new Option(
                      "o2",
                      "A^(-1) = [[3, -1], [-5, 2]] * (1/1)",
                      false
                    ),
                    new Option(
                      "o3",
                      "A^(-1) = [[3, -1], [-5, 2]] * (1/1)",
                      false
                    ),
                    new Option(
                      "o4",
                      "A^(-1) = [[3, -1], [-5, 2]] * (1/7)",
                      true
                    ),
                  ],
                },
                {
                  id: "8",
                  type: objectType.question,
                  name: "¿Qué propiedad debe cumplir un conjunto de vectores para ser considerado una base de un espacio vectorial?",
                  options: [
                    new Option("o1", "Ser ortogonales", false),
                    new Option("o2", "Ser linealmente dependientes", false),
                    new Option(
                      "o3",
                      "Generar el espacio vectorial y ser linealmente independientes",
                      true
                    ),
                    new Option("o4", "Tener la misma magnitud", false),
                  ],
                },
                {
                  id: "17",
                  type: objectType.question,
                  name: "¿Cuál es el rango de una matriz?",
                  options: [
                    new Option(
                      "o1",
                      "El número máximo de filas linealmente independientes",
                      false
                    ),
                    new Option(
                      "o2",
                      "El número máximo de columnas linealmente independientes",
                      true
                    ),
                    new Option("o3", "El número de ceros en la matriz", false),
                    new Option(
                      "o4",
                      "La cantidad de pivotes en su forma escalonada",
                      true
                    ),
                  ],
                },
                {
                  id: "18",
                  type: objectType.question,
                  name: "¿Cómo se determina si un sistema de ecuaciones lineales tiene solución única?",
                  options: [
                    new Option(
                      "o1",
                      "Si el determinante de la matriz de coeficientes es cero",
                      false
                    ),
                    new Option(
                      "o2",
                      "Si el determinante de la matriz de coeficientes no es cero",
                      true
                    ),
                    new Option(
                      "o3",
                      "Si el rango de la matriz de coeficientes es menor que el número de incógnitas",
                      false
                    ),
                    new Option(
                      "o4",
                      "Si las ecuaciones son linealmente dependientes",
                      false
                    ),
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "9",
          type: objectType.folder,
          name: "Ciencias de la Computación",
          content: [
            {
              id: "10",
              type: objectType.folder,
              name: "Algoritmos y Estructuras de Datos",
              content: [
                {
                  id: "11",
                  type: objectType.question,
                  name: "¿Cuál es la complejidad temporal en el peor caso del algoritmo de búsqueda binaria?",
                  options: [
                    new Option("o1", "O(n)", false),
                    new Option("o2", "O(log n)", true),
                    new Option("o3", "O(n log n)", false),
                    new Option("o4", "O(1)", false),
                  ],
                },
                {
                  id: "12",
                  type: objectType.question,
                  name: "¿Qué estructura de datos es ideal para implementar una cola con prioridad?",
                  options: [
                    new Option("o1", "Lista enlazada", false),
                    new Option("o2", "Árbol binario de búsqueda", false),
                    new Option("o3", "Montículo (Heap)", true),
                    new Option("o4", "Pila (Stack)", false),
                  ],
                },
                {
                  id: "19",
                  type: objectType.question,
                  name: "¿Cuál es la diferencia principal entre un árbol B y un árbol B+?",
                  options: [
                    new Option(
                      "o1",
                      "Los nodos hoja en un árbol B+ están conectados entre sí",
                      true
                    ),
                    new Option(
                      "o2",
                      "Un árbol B tiene mayor orden que un árbol B+",
                      false
                    ),
                    new Option(
                      "o3",
                      "En un árbol B+, todas las claves están en las hojas",
                      true
                    ),
                    new Option(
                      "o4",
                      "En un árbol B, las claves están distribuidas uniformemente en todos los niveles",
                      false
                    ),
                  ],
                },
                {
                  id: "20",
                  type: objectType.question,
                  name: "¿Qué es la recursividad en un algoritmo?",
                  options: [
                    new Option(
                      "o1",
                      "Es un proceso en el cual una función se llama a sí misma",
                      true
                    ),
                    new Option(
                      "o2",
                      "Es un proceso donde una función llama a una función diferente",
                      false
                    ),
                    new Option(
                      "o3",
                      "Es un proceso en el que una función se ejecuta en paralelo",
                      false
                    ),
                    new Option(
                      "o4",
                      "Es un proceso en el cual se elimina la redundancia de una función",
                      false
                    ),
                  ],
                },
              ],
            },
            {
              id: "13",
              type: objectType.folder,
              name: "Sistemas Operativos",
              content: [
                {
                  id: "14",
                  type: objectType.question,
                  name: "¿Qué es un deadlock (interbloqueo) en un sistema operativo?",
                  options: [
                    new Option(
                      "o1",
                      "Una situación donde dos o más procesos están bloqueados, esperando indefinidamente por recursos que nunca se liberan",
                      true
                    ),
                    new Option(
                      "o2",
                      "Un fallo en el sistema de archivos que impide el acceso a los datos",
                      false
                    ),
                    new Option(
                      "o3",
                      "Una interrupción causada por un error en el hardware",
                      false
                    ),
                    new Option(
                      "o4",
                      "Un proceso que se ejecuta indefinidamente sin liberar la CPU",
                      false
                    ),
                  ],
                },
                {
                  id: "15",
                  type: objectType.question,
                  name: "¿Cuál es la principal función de un planificador de procesos (scheduler) en un sistema operativo?",
                  options: [
                    new Option(
                      "o1",
                      "Administrar el almacenamiento en disco",
                      false
                    ),
                    new Option(
                      "o2",
                      "Asignar recursos de hardware a los procesos",
                      true
                    ),
                    new Option("o3", "Gestionar la memoria virtual", false),
                    new Option(
                      "o4",
                      "Realizar copias de seguridad de los datos",
                      false
                    ),
                  ],
                },
                {
                  id: "21",
                  type: objectType.question,
                  name: "¿Qué técnica se utiliza para evitar el interbloqueo en un sistema operativo?",
                  options: [
                    new Option("o1", "Asignación fija de recursos", false),
                    new Option("o2", "Control de concurrencia", false),
                    new Option(
                      "o3",
                      "Evitar las condiciones necesarias para el interbloqueo",
                      true
                    ),
                    new Option("o4", "Asignación dinámica de memoria", false),
                  ],
                },
                {
                  id: "22",
                  type: objectType.question,
                  name: "¿Qué es la paginación en la gestión de memoria?",
                  options: [
                    new Option(
                      "o1",
                      "Una técnica para dividir la memoria física en bloques de tamaño fijo",
                      true
                    ),
                    new Option(
                      "o2",
                      "Una técnica para dividir la memoria en bloques de tamaño variable",
                      false
                    ),
                    new Option(
                      "o3",
                      "Un método para asignar direcciones lógicas a direcciones físicas",
                      false
                    ),
                    new Option(
                      "o4",
                      "Un algoritmo para optimizar el uso del caché",
                      false
                    ),
                  ],
                },
              ],
            },
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
