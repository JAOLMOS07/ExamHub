import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ToastService } from "../../../core/services/toast.service";
import { Subscription } from "rxjs";
import { ConfirmService } from "../../../core/services/confirm.service";
import {
  ExamResult,
  GradedExam,
} from "../../../core/models/gradedExam.model";
import { GradingService } from "../../../core/services/grading.service";
import { MODULES } from "../../routes.constants";
import { SharedModule } from "../../shared/shared.module";
import { exportResultsPdf } from "./results-pdf.util";

/**
 * Pantalla de detalle de un examen calificable.
 *
 * Ruta: /grade/exam/:examId
 *
 * Muestra:
 *   - Info del examen (título, materia, versiones, fecha).
 *   - Lista de alumnos calificados con sus notas.
 *   - Promedio y métricas básicas del curso.
 *   - Botones para escanear nuevo / calificar manual / exportar PDF /
 *     borrar el examen entero.
 */
@Component({
  selector: "app-exam-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: "./exam-detail.component.html",
})
export class ExamDetailComponent implements OnInit, OnDestroy {
  exam: GradedExam | null = null;
  results: ExamResult[] = [];
  isLoading = true;
  errorMessage = "";
  isExporting = false;
  /** Escala default usada en la pantalla de calificación. Se podría
   *  parametrizar por examen en una v2. */
  maxScore = 5;

  private resultsSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  async ngOnInit(): Promise<void> {
    const examId = this.route.snapshot.paramMap.get("examId");
    if (!examId) {
      this.errorMessage = "Falta el id del examen en la URL.";
      this.isLoading = false;
      return;
    }
    try {
      this.exam = await this.gradingService.getExamById(examId);
      if (!this.exam) {
        this.errorMessage = "No encontramos ese examen en tu cuenta.";
        this.isLoading = false;
        return;
      }
      // Suscribimos a results en vivo para que aparezcan calificaciones
      // nuevas sin tener que refrescar.
      this.resultsSub = this.gradingService
        .listResults(examId)
        .subscribe((rs) => {
          this.results = rs;
        });
    } catch (err) {
      console.error("Error cargando examen:", err);
      this.errorMessage = "No pudimos cargar el examen.";
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.resultsSub?.unsubscribe();
  }

  // ---------- Métricas derivadas ----------

  /** Cantidad de alumnos calificados. */
  get studentCount(): number {
    return this.results.length;
  }

  /** Promedio de notas (0 si no hay resultados). */
  get average(): number {
    if (this.results.length === 0) return 0;
    const sum = this.results.reduce((s, r) => s + (r.score ?? 0), 0);
    return Math.round((sum / this.results.length) * 10) / 10;
  }

  /** Mejor nota del curso. */
  get bestScore(): number {
    if (this.results.length === 0) return 0;
    return Math.max(...this.results.map((r) => r.score ?? 0));
  }

  /** Peor nota del curso. */
  get worstScore(): number {
    if (this.results.length === 0) return 0;
    return Math.min(...this.results.map((r) => r.score ?? 0));
  }

  // ---------- Acciones ----------

  goToGrade(): void {
    if (!this.exam) return;
    this.router.navigateByUrl(MODULES.GRADE.EXAM_GRADE(this.exam.id));
  }

  goToScan(): void {
    this.router.navigateByUrl(MODULES.GRADE.SCAN);
  }

  goBackToList(): void {
    this.router.navigateByUrl(MODULES.GRADE.LIST);
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  formatDateTime(ts: number): string {
    return new Date(ts).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Borra un resultado individual. Útil para corregir un escaneo
   * incorrecto sin tener que borrar el examen entero.
   */
  async deleteResult(result: ExamResult): Promise<void> {
    if (!this.exam) return;
    const confirmed = await this.confirm.ask({
      title: "¿Borrar esta calificación?",
      message: `Vas a borrar la nota de ${result.studentName ?? "este alumno"}.`,
      confirmText: "Sí, borrar",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await this.gradingService.deleteResult(this.exam.id, result.id);
      this.toast.success("Calificación eliminada.", "ExamHub", 2500);
    } catch (err) {
      console.error("Error borrando resultado:", err);
      this.toast.danger(
        "No pudimos borrar la calificación.",
        "ExamHub",
        3500
      );
    }
  }

  /**
   * Exporta la lista de resultados a PDF imprimible.
   */
  async exportPdf(): Promise<void> {
    if (!this.exam || this.results.length === 0) {
      this.toast.warning(
        "Todavía no hay resultados para exportar.",
        "ExamHub",
        3000
      );
      return;
    }
    this.isExporting = true;
    try {
      await exportResultsPdf(this.exam, this.results, this.maxScore);
    } catch (err) {
      console.error("Error exportando PDF:", err);
      this.toast.danger(
        "No pudimos generar el PDF.",
        "ExamHub",
        3500
      );
    } finally {
      this.isExporting = false;
    }
  }
}
