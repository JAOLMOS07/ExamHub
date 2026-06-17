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
import { ImportBankDialogComponent } from "./components/import-bank/import-bank-dialog.component";
import { QuestionService } from "../../../core/services/questionService.service";
import { PrincipalModule } from "../principal.module";
import { GenerateExamDialogComponent } from "../../exam/generate-exam-dialog/generate-exam-dialog.component";
import { ExamService } from "../../../core/services/ExamService.service";
import { UserService } from "../../../core/services/UserService.service";
import { ToastService } from "../../../core/services/toast.service";
import { ConfirmService } from "../../../core/services/confirm.service";
import { filter, take } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { PreferencesService } from "../../../core/services/preferences.service";
@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
    CommonModule,
    PrincipalModule,
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

  // ============== FILTROS DEL BANCO ==============
  /** Texto de búsqueda libre (se aplica sobre nombre y enunciados). */
  searchQuery: string = "";
  /** Filtros activos: si están null, no filtran. */
  filterSubject: string | null = null;
  filterGrade: string | null = null;
  filterDifficulty: number | null = null;

  /** ¿Hay algún filtro activo? Sirve para mostrar el botón "limpiar". */
  get hasActiveFilters(): boolean {
    return (
      !!this.searchQuery.trim() ||
      !!this.filterSubject ||
      !!this.filterGrade ||
      !!this.filterDifficulty
    );
  }

  /** Valores únicos para los selectores de filtro (extraídos del nivel actual). */
  get availableSubjects(): string[] {
    const set = new Set<string>();
    for (const d of this.documents) {
      if (d.subject) set.add(d.subject);
    }
    return Array.from(set).sort();
  }
  get availableGrades(): string[] {
    const set = new Set<string>();
    for (const d of this.documents) {
      if (d.grade) set.add(d.grade);
    }
    return Array.from(set).sort();
  }

  /** Sugerencias combinadas: preferencias del usuario + valores ya usados en el banco.
   *  Estas son las que aparecen en los selects del dropdown de filtros y como
   *  autocompletar en los formularios. */
  get suggestionSubjects(): string[] {
    const set = new Set<string>([...this.prefSubjects, ...this.availableSubjects]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }
  get suggestionGrades(): string[] {
    // Para grados respetamos el orden de las preferencias (ej: "1°, 2°, 3°...")
    // y agregamos al final los del banco que no estén.
    const fromPrefs = [...this.prefGrades];
    const fromBank = this.availableGrades.filter(
      (g) => !fromPrefs.includes(g)
    );
    return [...fromPrefs, ...fromBank];
  }

  /** Cantidad de filtros estructurados activos (no cuenta el buscador). */
  get activeFilterCount(): number {
    let n = 0;
    if (this.filterSubject) n++;
    if (this.filterGrade) n++;
    if (this.filterDifficulty) n++;
    return n;
  }

  /** ¿Hay algún filtro estructurado (no buscador) activo? */
  get hasActiveStructuredFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  /** Documents filtrados según searchQuery + filtros activos. */
  get filteredDocuments(): Document[] {
    if (!this.hasActiveFilters) return this.documents;
    const q = this.searchQuery.trim().toLowerCase();
    return this.documents.filter((d) => {
      // Carpetas siempre pasan (sirven para navegación)
      if (d.type === objectType.FOLDER) {
        // ...salvo que haya búsqueda explícita por nombre
        if (q) return d.name.toLowerCase().includes(q);
        return true;
      }
      // Búsqueda por texto en nombre o enunciado/lectura
      if (q) {
        const hay =
          d.name.toLowerCase().includes(q) ||
          (d.passageText?.toLowerCase().includes(q) ?? false) ||
          (d.passageContext?.toLowerCase().includes(q) ?? false);
        if (!hay) return false;
      }
      // Filtros de clasificación solo aplican a preguntas (las lecturas pasan)
      if (d.type === objectType.QUESTION) {
        if (this.filterSubject && d.subject !== this.filterSubject) return false;
        if (this.filterGrade && d.grade !== this.filterGrade) return false;
        if (
          this.filterDifficulty &&
          d.difficulty !== this.filterDifficulty
        ) {
          return false;
        }
      }
      return true;
    });
  }

  /** Contadores filtrados (para mostrar al lado de los títulos de sección). */
  get filteredFolderCount(): number {
    return this.filteredDocuments.filter((d) => d.type === objectType.FOLDER)
      .length;
  }
  get filteredPassageCount(): number {
    return this.filteredDocuments.filter((d) => d.type === objectType.PASSAGE)
      .length;
  }
  get filteredQuestionCount(): number {
    return this.filteredDocuments.filter((d) => d.type === objectType.QUESTION)
      .length;
  }

  clearFilters(): void {
    this.searchQuery = "";
    this.filterSubject = null;
    this.filterGrade = null;
    this.filterDifficulty = null;
  }

  /** Preferencias del usuario (materias y grados predefinidos). */
  prefSubjects: string[] = [];
  prefGrades: string[] = [];

  constructor(
    public dialog: MatDialog,
    private questionService: QuestionService,
    private examService: ExamService,
    private userService: UserService,
    private preferencesService: PreferencesService,
    private toast: ToastService,
    private confirm: ConfirmService
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

    // Suscribirse a las preferencias para enriquecer sugerencias.
    this.preferencesService.preferences$.subscribe((p) => {
      this.prefSubjects = p.subjects;
      this.prefGrades = p.grades;
    });
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
   * Abre el diálogo de importación: el profe pega un JSON generado
   * por SU IA (ChatGPT/Claude/Gemini) y se importa al banco. Cero
   * costo de IA para nosotros, cero backend.
   */
  openImportDialog(): void {
    const ref = this.dialog.open(ImportBankDialogComponent, {
      width: "680px",
      maxWidth: "95vw",
      data: { path: this.currentPath },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.imported) {
        this.loadDocuments();
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
  /**
   * Recolecta recursivamente todos los Documents bajo un path: preguntas
   * sueltas, lecturas (con sus preguntas hijas), y desciende a
   * subcarpetas. Cada pregunta hija de una lectura recibe `passageId`
   * y `passageContext` (denormalizado) si no los tenía aún, para que
   * el generador de examen pueda armar el bloque de lectura
   * correctamente.
   */
  private async collectRecursive(
    path: string[]
  ): Promise<{ questions: Document[]; passages: Document[]; folders: number }> {
    const items = await firstValueFrom(this.examService.getDocuments(path));
    const collected: Document[] = [];
    const passages: Document[] = [];
    let folders = 0;

    for (const item of items) {
      if (item.type === objectType.QUESTION) {
        collected.push(item);
      } else if (item.type === objectType.PASSAGE) {
        passages.push(item);
        // Cargar las preguntas hijas de la lectura
        const children = await firstValueFrom(
          this.examService.getDocuments([...path, item.id])
        );
        for (const child of children) {
          if (child.type === objectType.QUESTION) {
            // Defensa: asignar passageId/Context si falta
            if (!child.passageId) child.passageId = item.id;
            if (!child.passageContext && item.passageText) {
              child.passageContext = item.passageText;
            }
            collected.push(child);
          }
        }
      } else if (item.type === objectType.FOLDER) {
        folders++;
        const sub = await this.collectRecursive([...path, item.id]);
        collected.push(...sub.questions);
        passages.push(...sub.passages);
        folders += sub.folders;
      }
    }
    return { questions: collected, passages, folders };
  }

  /**
   * Agrega al examen actual TODAS las preguntas y lecturas contenidas
   * en la carpeta indicada, descendiendo recursivamente por
   * subcarpetas. Los duplicados los maneja silenciosamente
   * QuestionService.
   */
  async addFolderToExam(folder: Document): Promise<void> {
    const childPath = [...this.currentPath, folder.id];
    try {
      const { questions, passages, folders } = await this.collectRecursive(
        childPath
      );

      // Primero las lecturas (para que el id quede registrado y el
      // generator pueda asociar correctamente).
      for (const p of passages) this.questionService.addQuestion(p);
      for (const q of questions) this.questionService.addQuestion(q);

      const parts: string[] = [];
      if (questions.length > 0) {
        parts.push(
          `${questions.length} ${questions.length === 1 ? "pregunta" : "preguntas"}`
        );
      }
      if (passages.length > 0) {
        parts.push(
          `${passages.length} ${passages.length === 1 ? "lectura" : "lecturas"}`
        );
      }
      if (folders > 0) {
        parts.push(
          `${folders} ${folders === 1 ? "subcarpeta" : "subcarpetas"}`
        );
      }

      if (questions.length === 0 && passages.length === 0) {
        this.toast.info(
          "La carpeta no tiene preguntas para agregar.",
          "ExamHub",
          2500
        );
      } else {
        this.toast.success(
          `Agregadas al examen: ${parts.join(" + ")}`,
          "ExamHub",
          3000
        );
      }
    } catch (e: any) {
      this.toast.danger(
        "Error al cargar el contenido de la carpeta.",
        "ExamHub",
        3000
      );
    }
  }

  /**
   * Quita del examen actual TODAS las preguntas y lecturas contenidas
   * en la carpeta indicada (recursivamente).
   */
  async removeFolderFromExam(folder: Document): Promise<void> {
    const childPath = [...this.currentPath, folder.id];
    try {
      const { questions, passages } = await this.collectRecursive(childPath);
      const ids = new Set<string>([
        ...questions.map((q) => q.id),
        ...passages.map((p) => p.id),
      ]);
      let removed = 0;
      for (const id of ids) {
        if (this.questionsSelected.some((q) => q.id === id)) {
          this.questionService.removeQuestion(id);
          removed++;
        }
      }
      if (removed > 0) {
        this.toast.success(
          `Se quitaron ${removed} elemento(s) del examen.`,
          "ExamHub",
          2500
        );
      } else {
        this.toast.info(
          "Esta carpeta no tenía contenido en el examen actual.",
          "ExamHub",
          2500
        );
      }
    } catch {
      this.toast.danger(
        "Error al procesar la carpeta.",
        "ExamHub",
        3000
      );
    }
  }

  /**
   * ¿Hay al menos UNA pregunta/lectura de esta carpeta ya seleccionada
   * en el examen actual? Sirve para alternar el botón de la tarjeta
   * entre "agregar" y "quitar". Evita la recursión real chequeando
   * solo los hijos directos (heurística suficiente para la UI).
   */
  folderHasSelection(folder: Document): boolean {
    // Heurística rápida: si alguna pregunta seleccionada tiene un
    // passageId que apunta a una lectura dentro de esta carpeta, o si
    // su id está en el content (cuando esté denormalizado).
    // Como no tenemos eso aún, mostramos siempre "agregar". Una versión
    // futura puede mantener un mapa folderId -> hasSelection.
    return false;
  }

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
      data: {
        // Combinamos las preferencias del usuario con los valores
        // ya usados en el banco — así el profe puede elegir entre
        // sus opciones predefinidas o las que ya tiene en uso.
        subjectSuggestions: this.suggestionSubjects,
        gradeSuggestions: this.suggestionGrades,
      },
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

  /**
   * Pide confirmación (diálogo de marca) y elimina carpeta/lectura/pregunta.
   * El texto se adapta al tipo de documento.
   */
  async confirmDeleteDocument(document: Document): Promise<void> {
    const isFolder = document.type === objectType.FOLDER;
    const isPassage = document.type === objectType.PASSAGE;
    const confirmed = await this.confirm.ask({
      title: isFolder
        ? "¿Eliminar esta carpeta?"
        : isPassage
        ? "¿Eliminar esta lectura?"
        : "¿Eliminar esta pregunta?",
      message: isFolder
        ? "Se borrará junto con todo su contenido."
        : isPassage
        ? "Se borrarán todas sus preguntas asociadas."
        : "No se puede deshacer.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (confirmed) this.deleteDocument(document);
  }

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
  async confirmDiscardExam(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "¿Descartar examen actual?",
      message:
        "Se quitarán todas las preguntas seleccionadas. Las preguntas siguen en tu banco.",
      confirmText: "Sí, descartar",
      icon: "question",
    });
    if (confirmed) this.discardExam();
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
