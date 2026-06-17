import {
  Component,
  Inject,
  output,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
} from "@angular/core";
import { Option, Question } from "../../../core/models/question.model";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from "@angular/material/dialog";
import { FormBuilder } from "@angular/forms";
import { ToastService } from "../../../core/services/toast.service";
import { Document, getQuestionKind } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import {
  QUESTION_KIND_LABEL,
  QuestionKind,
} from "../../../core/models/questionKind.enum";
import { Difficulty, DIFFICULTY_LABEL } from "../../../core/models/difficulty.enum";
import {
  MathEditorDialogComponent,
  MathEditorDialogResult,
} from "../../shared/math/math-editor-dialog.component";
import { ImageUploadService } from "../../../core/services/imageUpload.service";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-create-question",
  templateUrl: "./create-question.component.html",
  styleUrl: "./create-question.component.css",
})
export class CreateQuestionDialogComponent {
  /** Para que el template pueda usar el enum. */
  QuestionKind = QuestionKind;
  KIND_LABEL = QUESTION_KIND_LABEL;
  /** Lista ordenada de tipos disponibles para el selector. */
  availableKinds: QuestionKind[] = [
    QuestionKind.MULTIPLE_CHOICE_SINGLE,
    QuestionKind.TRUE_FALSE,
    QuestionKind.OPEN,
    QuestionKind.NUMERIC,
  ];

  editMode = false;
  newQuestion!: Document;
  onPushNewQuestion = output<Question>();
  options: Option[] = [];

  /** Tipo seleccionado actualmente en el formulario. */
  selectedKind: QuestionKind = QuestionKind.MULTIPLE_CHOICE_SINGLE;

  /** Respuesta numérica (solo para kind = NUMERIC). */
  numericAnswer: number | null = null;
  /** Tolerancia ± numérica (default 0 = respuesta exacta). */
  numericTolerance: number = 0;

  /** Referencia al textarea del enunciado para insertar la fórmula en la posición del cursor. */
  @ViewChild("questionTextarea") questionTextarea?: ElementRef<HTMLTextAreaElement>;

  /** Referencias a los inputs de cada opción de respuesta múltiple,
   *  para poder insertar fórmulas LaTeX en la posición del cursor. */
  @ViewChildren("optionInput") optionInputs!: QueryList<
    ElementRef<HTMLInputElement>
  >;

  /** Para mostrar dónde insertar fórmula en cada input de opción. */
  activeOptionIndex: number | null = null;

  /** ID estable para la pregunta. Generado al abrir el diálogo para
   *  poder asociar imágenes subidas (que necesitan un id) ANTES de
   *  persistir la pregunta a Firestore. En modo edición se reutiliza. */
  questionId: string = crypto.randomUUID();

  /** Imagen actualmente asociada a la pregunta (si hay). */
  imageUrl: string | null = null;
  imagePath: string | null = null;

  /** Clasificación de la pregunta — opcional pero recomendado. */
  subject: string = "";
  grade: string = "";
  difficulty: Difficulty | null = null;

  /** Enum + labels expuestos al template. */
  Difficulty = Difficulty;
  DIFFICULTY_LABEL = DIFFICULTY_LABEL;
  difficultyOptions: Difficulty[] = [
    Difficulty.EASY,
    Difficulty.MEDIUM,
    Difficulty.HARD,
  ];

  /**
   * Sugerencias para autocompletar materia y grado. Se pueblan desde
   * fuera (HomeComponent las pasa por `data.subjectSuggestions` /
   * `data.gradeSuggestions`) con los valores únicos ya usados en el
   * banco. Permite que los profes mantengan consistencia
   * ("Matemática" vs "Matemáticas" vs "Mate") sin imponerla.
   */
  subjectSuggestions: string[] = [];
  gradeSuggestions: string[] = [];

  /** Flag de "subiendo imagen" para deshabilitar el form mientras tanto. */
  uploadingImage = false;

  /**
   * Feature flag: si está apagado, todo el bloque de imágenes queda
   * oculto en el template y los handlers no hacen nada (defensa en
   * profundidad). Permite activar la feature en el futuro cambiando
   * solo `environment.features.enableImages = true`.
   */
  imagesEnabled = environment.features?.enableImages === true;

  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<CreateQuestionDialogComponent>,
    private toast: ToastService,
    private mathDialog: MatDialog,
    private imageUpload: ImageUploadService,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      question?: Document;
      subjectSuggestions?: string[];
      gradeSuggestions?: string[];
    }
  ) {
    this.resetNewQuestion();
  }

  /**
   * Abre el editor visual de ecuaciones. Al confirmar, inserta el
   * LaTeX devuelto entre delimitadores `$...$` (inline) o `$$...$$`
   * (bloque) en la posición del cursor del textarea del enunciado.
   */
  insertEquationInQuestion(): void {
    const ref = this.mathDialog.open(MathEditorDialogComponent, {
      data: { latex: "", displayMode: false },
      width: "640px",
    });
    ref.afterClosed().subscribe((result: MathEditorDialogResult | undefined) => {
      if (!result) return;
      const wrapped = result.displayMode
        ? `$$${result.latex}$$`
        : `$${result.latex}$`;
      this.insertAtCursor(wrapped);
    });
  }

  /**
   * Inserta el snippet en la posición del cursor del textarea del
   * enunciado, manteniendo el resto del texto intacto.
   */
  private insertAtCursor(snippet: string): void {
    const el = this.questionTextarea?.nativeElement;
    const current = this.newQuestion.name ?? "";
    if (!el) {
      this.newQuestion.name = current + snippet;
      return;
    }
    const result = this.insertAtElementCursor(el, current, snippet);
    this.newQuestion.name = result;
  }

  /**
   * Abre el editor visual de ecuaciones para insertar una fórmula en
   * una opción específica de respuesta múltiple.
   */
  insertEquationInOption(index: number): void {
    const ref = this.mathDialog.open(MathEditorDialogComponent, {
      data: { latex: "", displayMode: false },
      width: "640px",
    });
    ref.afterClosed().subscribe((result: MathEditorDialogResult | undefined) => {
      if (!result) return;
      // Para opciones siempre usamos formato inline ($...$); $$...$$
      // sería excesivo dentro de un input pequeño.
      const wrapped = `$${result.latex}$`;
      this.insertAtOptionCursor(index, wrapped);
    });
  }

  /**
   * Inserta el snippet en la posición del cursor del input de la
   * opción `index`, actualizando el model y reposicionando el cursor.
   */
  private insertAtOptionCursor(index: number, snippet: string): void {
    const el = this.optionInputs?.toArray()[index]?.nativeElement;
    const current = this.options[index]?.content ?? "";
    if (!el) {
      // Fallback: append al final si la ref aún no resolvió.
      if (this.options[index]) {
        this.options[index].content = current + snippet;
      }
      return;
    }
    const result = this.insertAtElementCursor(el, current, snippet);
    this.options[index].content = result;
  }

  /**
   * Helper genérico: dado un input/textarea, su contenido actual y un
   * snippet, devuelve el nuevo contenido con el snippet insertado en
   * la posición del cursor. También reposiciona el cursor visualmente
   * después del snippet.
   */
  private insertAtElementCursor(
    el: HTMLInputElement | HTMLTextAreaElement,
    current: string,
    snippet: string
  ): string {
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next =
      current.substring(0, start) + snippet + current.substring(end);
    queueMicrotask(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
    return next;
  }

  ngOnInit() {
    // Sugerencias para autocompletar (independientes de modo edición).
    this.subjectSuggestions = this.data?.subjectSuggestions ?? [];
    this.gradeSuggestions = this.data?.gradeSuggestions ?? [];

    if (this.data?.question) {
      this.editMode = true;
      this.questionId = this.data.question.id;
      this.newQuestion.name = this.data.question.name;
      this.selectedKind = getQuestionKind(this.data.question);

      if (this.data.question.options) {
        this.options = this.data.question.options.map(
          (op) => new Option(op.id, op.content, op.correct)
        );
      }
      if (this.data.question.numericAnswer !== undefined) {
        this.numericAnswer = this.data.question.numericAnswer;
      }
      if (this.data.question.numericTolerance !== undefined) {
        this.numericTolerance = this.data.question.numericTolerance;
      }
      // Cargar imagen existente si la hay
      this.imageUrl = this.data.question.imageUrl ?? null;
      this.imagePath = this.data.question.imagePath ?? null;
      // Cargar clasificación
      this.subject = this.data.question.subject ?? "";
      this.grade = this.data.question.grade ?? "";
      this.difficulty = (this.data.question.difficulty as Difficulty) ?? null;
    }
  }

  /**
   * Handler del <input type="file">. Sube la imagen elegida a Firebase
   * Storage usando el ImageUploadService. Si ya había una imagen
   * previa para esta pregunta, la borra para no dejar huérfanos.
   */
  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Validar antes de intentar subir
    const validation = this.imageUpload.validate(file);
    if (validation) {
      this.toast.warning(validation, "ExamHub", 3500);
      input.value = "";
      return;
    }

    this.uploadingImage = true;
    try {
      // Si había una imagen previa, eliminarla primero
      if (this.imagePath) {
        await this.imageUpload.delete(this.imagePath);
      }
      const { url, path } = await this.imageUpload.uploadForQuestion(
        file,
        this.questionId
      );
      this.imageUrl = url;
      this.imagePath = path;
      this.toast.success("Imagen subida con éxito", "ExamHub", 2000);
    } catch (e: any) {
      this.toast.danger(
        e?.message ?? "Error al subir la imagen.",
        "ExamHub",
        3500
      );
    } finally {
      this.uploadingImage = false;
      input.value = ""; // Permite re-elegir el mismo archivo si hace falta
    }
  }

  /**
   * Quita la imagen actual (la borra de Storage también).
   */
  async removeImage(): Promise<void> {
    if (!this.imagePath) {
      this.imageUrl = null;
      return;
    }
    this.uploadingImage = true;
    try {
      await this.imageUpload.delete(this.imagePath);
      this.imageUrl = null;
      this.imagePath = null;
    } catch (e: any) {
      this.toast.danger(
        e?.message ?? "Error al borrar la imagen.",
        "ExamHub",
        3500
      );
    } finally {
      this.uploadingImage = false;
    }
  }

  resetNewQuestion() {
    this.newQuestion = {
      id: "",
      name: "",
      type: objectType.QUESTION,
      options: [],
    };
  }

  /**
   * Cambio de tipo: reseteamos las estructuras de respuestas para
   * evitar mezclar campos de tipos distintos. La pregunta (texto) se
   * conserva.
   */
  onKindChange(kind: QuestionKind) {
    this.selectedKind = kind;
    this.options = [];
    this.numericAnswer = null;
    this.numericTolerance = 0;

    // Para V/F pre-cargamos las dos opciones fijas.
    if (kind === QuestionKind.TRUE_FALSE) {
      this.options = [
        new Option(crypto.randomUUID(), "Verdadero", false),
        new Option(crypto.randomUUID(), "Falso", false),
      ];
    }
  }

  addOption() {
    this.options.push(new Option("", "", false));
  }

  removeOption(index: number) {
    this.options.splice(index, 1);
  }

  /** Solo válido en V/F: marca una opción como correcta y la otra no. */
  selectTrueFalse(correctIndex: number) {
    this.options.forEach((opt, i) => {
      opt.correct = i === correctIndex;
    });
  }

  /** Validación específica por tipo. Devuelve null si todo OK, o un mensaje de error. */
  private validate(): string | null {
    if (!this.newQuestion.name || this.newQuestion.name.trim().length < 10) {
      return "La pregunta debe tener al menos 10 caracteres.";
    }

    switch (this.selectedKind) {
      case QuestionKind.MULTIPLE_CHOICE_SINGLE: {
        if (this.options.length < 2) {
          return "Agregá al menos 2 opciones.";
        }
        const correctCount = this.options.filter((o) => o.correct).length;
        if (correctCount !== 1) {
          return "Marcá exactamente una opción como correcta.";
        }
        if (this.options.some((o) => !o.content.trim())) {
          return "Las opciones no pueden estar vacías.";
        }
        return null;
      }
      case QuestionKind.TRUE_FALSE: {
        const correctCount = this.options.filter((o) => o.correct).length;
        if (correctCount !== 1) {
          return "Elegí si la respuesta correcta es Verdadero o Falso.";
        }
        return null;
      }
      case QuestionKind.OPEN: {
        // Sin validaciones extra — es respuesta libre.
        return null;
      }
      case QuestionKind.NUMERIC: {
        if (this.numericAnswer === null || isNaN(this.numericAnswer)) {
          return "Ingresá la respuesta numérica esperada.";
        }
        if (this.numericTolerance < 0) {
          return "La tolerancia no puede ser negativa.";
        }
        return null;
      }
    }
  }

  addQuestion() {
    const error = this.validate();
    if (error) {
      this.toast.warning(error, "ExamHub", 3500);
      return;
    }

    const result: Document = {
      id: this.questionId,
      name: this.newQuestion.name,
      type: objectType.QUESTION,
      kind: this.selectedKind,
    };

    if (
      this.selectedKind === QuestionKind.MULTIPLE_CHOICE_SINGLE ||
      this.selectedKind === QuestionKind.TRUE_FALSE
    ) {
      result.options = this.options.map(
        (opt) =>
          new Option(opt.id || crypto.randomUUID(), opt.content, opt.correct)
      );
    }

    if (this.selectedKind === QuestionKind.NUMERIC) {
      result.numericAnswer = this.numericAnswer ?? 0;
      result.numericTolerance = this.numericTolerance ?? 0;
    }

    // Imagen (si se subió alguna)
    if (this.imageUrl && this.imagePath) {
      result.imageUrl = this.imageUrl;
      result.imagePath = this.imagePath;
    }

    // Clasificación (todos opcionales — los persistimos solo si tienen valor)
    if (this.subject.trim()) result.subject = this.subject.trim();
    if (this.grade.trim()) result.grade = this.grade.trim();
    if (this.difficulty) result.difficulty = this.difficulty;

    this.dialogRef.close(result);
    this.resetNewQuestion();
  }
}
