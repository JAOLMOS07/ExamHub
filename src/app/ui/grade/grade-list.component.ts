import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { ToastService } from "../../core/services/toast.service";
import { Observable } from "rxjs";
import { ConfirmService } from "../../core/services/confirm.service";
import { GradedExam } from "../../core/models/gradedExam.model";
import { GradingService } from "../../core/services/grading.service";
import { MODULES } from "../routes.constants";
import { SharedModule } from "../shared/shared.module";

/**
 * Pantalla principal del feature de calificación: lista los exámenes
 * que el profe ha generado y un CTA grande para abrir el scanner.
 *
 * Ruta: /grade
 */
@Component({
  selector: "app-grade-list",
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: "./grade-list.component.html",
})
export class GradeListComponent implements OnInit {
  exams$!: Observable<GradedExam[]>;
  /** Ruta del scanner — la dejo expuesta para que el template no
   *  conozca la estructura de paths. */
  readonly scanRoute = MODULES.GRADE.SCAN;

  constructor(
    private gradingService: GradingService,
    private router: Router,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.exams$ = this.gradingService.listMyExams();
  }

  goToExam(examId: string): void {
    this.router.navigateByUrl(MODULES.GRADE.EXAM(examId));
  }

  /**
   * Pide confirmación con SweetAlert y borra el examen completo (más
   * todos sus resultados, que ya hace cascade-delete en el service).
   * Se llama desde el icono de basura en cada fila.
   */
  async deleteExam(event: Event, exam: GradedExam): Promise<void> {
    // Importantísimo: evitar que el click burbujee y nos lleve al detalle
    event.stopPropagation();
    const confirmed = await this.confirm.ask({
      title: "¿Borrar este examen?",
      message: `Vas a borrar "${exam.title}" y todas las calificaciones asociadas. Esta acción no se puede deshacer.`,
      confirmText: "Sí, borrar todo",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await this.gradingService.deleteExam(exam.id);
      this.toast.success("Examen eliminado.", "ExamHub", 2500);
    } catch (err) {
      console.error("Error borrando examen:", err);
      this.toast.danger(
        "No pudimos borrar el examen.",
        "ExamHub",
        3500
      );
    }
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}
