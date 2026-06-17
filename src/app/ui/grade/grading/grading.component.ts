import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { v4 as uuidv4 } from "uuid";
import { ToastService } from "../../../core/services/toast.service";
import { SharedModule } from "../../shared/shared.module";
import {
  AnswerKey,
  computeBreakdown,
  DetectedAnswer,
  ExamResult,
  GradedExam,
  QuestionGradeBreakdown,
} from "../../../core/models/gradedExam.model";
import { GradingService } from "../../../core/services/grading.service";
import { OmrError, OmrService } from "../../../core/services/omr.service";
import { MODULES } from "../../routes.constants";

/**
 * Pantalla de calificación de una hoja de respuestas concreta.
 *
 * Ruta: /grade/exam/:examId?versionId=v1
 *
 * Flujo:
 *   1. Carga GradedExam por examId desde Firestore.
 *   2. Selecciona la versión (de queryParam o por dropdown).
 *   3. Muestra un grid táctil donde el profe toca la burbuja marcada
 *      por el alumno (modo asistido). Cada fila es una pregunta, las
 *      columnas son las letras del examen.
 *   4. Calcula nota en vivo conforme va marcando.
 *   5. Al guardar pide nombre del alumno y persiste ExamResult.
 *
 * En una fase siguiente, esta misma pantalla recibirá una imagen y
 * pre-llenará el grid con la salida del motor OMR; el profe seguiría
 * pudiendo corregir manualmente cualquier celda dudosa.
 */
@Component({
  selector: "app-grading",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./grading.component.html",
})
export class GradingComponent implements OnInit {
  exam: GradedExam | null = null;
  selectedVersion: AnswerKey | null = null;
  /** Respuestas detectadas / marcadas por el profe. Mismo largo que
   *  selectedVersion.answers. */
  detected: DetectedAnswer[] = [];
  /** Puntaje manual asignado a preguntas NO MCQ (abiertas, numéricas).
   *  Key: índice de pregunta. Valor: 0..1 (1 = perfecto, 0 = nada).
   *  Si el profe no toca una pregunta abierta, queda en 0 (default). */
  manualScores: Record<number, number> = {};

  studentName = "";
  studentCode = "";
  maxScore = 5;
  isLoading = true;
  isSaving = false;
  errorMessage = "";

  // ----- OMR (auto-calificar con foto) -----
  isOmrRunning = false;
  /** Mensaje mostrado durante el procesamiento OMR (loading, error, etc.). */
  omrStatus = "";
  /** Preview de la imagen procesada con overlay de burbujas detectadas. */
  omrPreviewDataUrl: string | null = null;
  /** Source del último cambio: si fue OMR marcamos así el ExamResult. */
  private lastSource: "assisted" | "omr" | "mixed" = "assisted";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService,
    private toast: ToastService,
    private omrService: OmrService
  ) {}

  async ngOnInit(): Promise<void> {
    const examId = this.route.snapshot.paramMap.get("examId");
    const versionId = this.route.snapshot.queryParamMap.get("versionId");
    if (!examId) {
      this.errorMessage = "Falta el id del examen en la URL.";
      this.isLoading = false;
      return;
    }
    try {
      const exam = await this.gradingService.getExamById(examId);
      if (!exam) {
        this.errorMessage =
          "No encontramos ese examen. Puede que lo hayas borrado o que el QR no corresponda a tu cuenta.";
        this.isLoading = false;
        return;
      }
      this.exam = exam;
      // Si vino versionId, lo seleccionamos. Si no, el primero.
      const v = exam.versions.find((x) => x.versionId === versionId);
      this.selectVersion(v ?? exam.versions[0]);
    } catch (err) {
      console.error("Error cargando examen:", err);
      this.errorMessage = "No pudimos cargar el examen.";
    } finally {
      this.isLoading = false;
    }
  }

  selectVersion(version: AnswerKey): void {
    this.selectedVersion = version;
    // Reseteamos las respuestas detectadas al tamaño correcto.
    this.detected = new Array(version.answers.length).fill(null);
    this.manualScores = {};
  }

  /** True si la pregunta i no es calificable automáticamente
   *  (abierta o numérica). */
  isManualQuestion(i: number): boolean {
    return this.selectedVersion?.answers[i] === null;
  }

  /**
   * Setter del puntaje manual con clamp a [0, 1].
   * Lo usa el input del template. Si el profe pone algo fuera de
   * rango, lo recortamos (más amigable que rechazar).
   */
  setManualScore(i: number, value: number | string): void {
    let v = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    this.manualScores[i] = v;
  }

  /**
   * Wrapper amigable para el template: busca la versión por id y la
   * selecciona. Lo necesitamos porque el parser de templates de Angular
   * no acepta arrow functions inline (no podemos hacer
   * `versions.find(v => v.versionId === id)` desde el HTML).
   */
  selectVersionById(versionId: string): void {
    if (!this.exam) return;
    const v = this.exam.versions.find((x) => x.versionId === versionId);
    if (v) this.selectVersion(v);
  }

  /**
   * Maneja el tap sobre una burbuja. Si ya estaba seleccionada esa
   * letra, la deselecciona (toggle). Si había otra, la cambia.
   */
  toggleAnswer(questionIndex: number, letter: string): void {
    const current = this.detected[questionIndex];
    if (current === letter) {
      this.detected[questionIndex] = null;
    } else {
      this.detected[questionIndex] = letter;
    }
    // Si veníamos de OMR puro y el profe edita, el resultado pasa a "mixed".
    if (this.lastSource === "omr") this.lastSource = "mixed";
  }

  /**
   * Marca una pregunta como "doble marca / anulada". El profe lo usa
   * cuando ve dos burbujas marcadas en la hoja física.
   */
  markMulti(questionIndex: number): void {
    if (this.detected[questionIndex] === "MULTI") {
      this.detected[questionIndex] = null;
    } else {
      this.detected[questionIndex] = "MULTI";
    }
    if (this.lastSource === "omr") this.lastSource = "mixed";
  }

  /**
   * Handler del input file de "Auto-calificar con foto".
   * Pasa la imagen al OmrService, pre-llena el grid con las
   * respuestas detectadas, y muestra el preview con overlay.
   */
  async onOmrFileSelected(event: Event): Promise<void> {
    if (!this.exam || !this.selectedVersion) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Reset del input para que el mismo archivo se pueda re-cargar
    input.value = "";

    this.isOmrRunning = true;
    this.omrStatus =
      "Cargando motor de visión (la primera vez puede tardar 5–10s)…";
    this.omrPreviewDataUrl = null;

    try {
      // Asegurar OpenCV cargado (puede tardar la primera vez ~5-10s)
      await this.omrService.ensureLoaded();
      this.omrStatus = "Procesando la foto…";

      const image = await this.loadImage(file);
      const result = await this.omrService.detectAnswers(
        image,
        this.selectedVersion.answers,
        this.exam.letters
      );

      this.detected = result.answers;
      this.omrPreviewDataUrl = result.previewDataUrl;
      this.lastSource = "omr";
      this.omrStatus = `Detectadas ${result.detectedRows} filas. Revisá y corregí si hace falta.`;
      this.toast.success(
        "Foto procesada. Revisá las respuestas marcadas.",
        "ExamHub",
        3500
      );
    } catch (err: any) {
      console.error("OMR error:", err);
      if (err instanceof OmrError) {
        this.omrStatus = err.message;
        this.toast.warning(err.message, "ExamHub", 5000);
      } else {
        // Surfaceamos el mensaje real del error para debugging — pero
        // truncado a algo legible para el profe.
        const rawMsg =
          (typeof err?.message === "string" && err.message) ||
          (typeof err === "string" && err) ||
          "error desconocido";
        const short = rawMsg.length > 140 ? rawMsg.slice(0, 140) + "…" : rawMsg;
        this.omrStatus = `No pudimos procesar la foto: ${short}`;
        this.toast.danger(
          "No pudimos procesar la foto. Revisá la consola para detalles.",
          "ExamHub",
          5000
        );
      }
    } finally {
      this.isOmrRunning = false;
    }
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Devuelve el breakdown calculado en vivo para mostrar en pantalla. */
  get breakdown(): QuestionGradeBreakdown[] {
    if (!this.selectedVersion) return [];
    return computeBreakdown(this.detected, this.selectedVersion);
  }

  /**
   * Cantidad de "puntos" acumulados. Las MCQ correctas suman 1, las
   * incorrectas suman 0. Las abiertas/numéricas suman lo que el profe
   * cargó en `manualScores[i]` (entre 0 y 1, default 0).
   *
   *  El resultado puede ser decimal (ej: 7 MCQ correctas + 1 abierta
   *  con 0.5 puntos = 7.5).
   */
  get correctCount(): number {
    const mcqPoints = this.breakdown.filter((b) => b.isCorrect).length;
    const manualPoints = this.breakdown
      .filter((b) => b.isUngradable)
      .reduce((s, b) => s + (this.manualScores[b.index] ?? 0), 0);
    return Math.round((mcqPoints + manualPoints) * 10) / 10;
  }

  /**
   * Total de preguntas que cuentan al puntaje. Ahora incluye TODAS
   * (MCQ + abiertas + numéricas), porque las manuales también valen.
   */
  get gradableCount(): number {
    return this.breakdown.length;
  }

  /** Nota calculada con la escala configurada. */
  get score(): number {
    return this.gradingService.computeScore(
      this.correctCount,
      this.gradableCount,
      this.maxScore
    );
  }

  async save(): Promise<void> {
    if (!this.exam || !this.selectedVersion || this.isSaving) return;
    if (!this.studentName.trim()) {
      this.toast.warning(
        "Ingresá el nombre del alumno para guardar.",
        "ExamHub",
        3000
      );
      return;
    }
    this.isSaving = true;
    // Filtramos manualScores para no guardar entradas en 0 (limpieza).
    const cleanManual: Record<number, number> = {};
    for (const [k, v] of Object.entries(this.manualScores)) {
      if (v > 0) cleanManual[Number(k)] = v;
    }
    const result: Omit<ExamResult, "examId" | "scannedAt"> = {
      id: uuidv4(),
      versionId: this.selectedVersion.versionId,
      studentName: this.studentName.trim(),
      studentCode: this.studentCode.trim() || undefined,
      answers: [...this.detected],
      manualScores:
        Object.keys(cleanManual).length > 0 ? cleanManual : undefined,
      correct: this.correctCount,
      total: this.gradableCount,
      score: this.score,
      source: this.lastSource,
    };
    try {
      await this.gradingService.saveResult(this.exam.id, result);
      this.toast.success(
        `Calificación guardada (${this.score} / ${this.maxScore}).`,
        "ExamHub",
        3500
      );
      // Reset para escanear el siguiente
      this.studentName = "";
      this.studentCode = "";
      this.detected = new Array(this.selectedVersion.answers.length).fill(null);
      this.manualScores = {};
      this.lastSource = "assisted";
      this.omrPreviewDataUrl = null;
      this.omrStatus = "";
    } catch (err) {
      console.error("Error guardando resultado:", err);
      this.toast.danger(
        "No pudimos guardar el resultado.",
        "ExamHub",
        3500
      );
    } finally {
      this.isSaving = false;
    }
  }

  goToScan(): void {
    this.router.navigateByUrl(MODULES.GRADE.SCAN);
  }

  goToList(): void {
    this.router.navigateByUrl(MODULES.GRADE.LIST);
  }
}
