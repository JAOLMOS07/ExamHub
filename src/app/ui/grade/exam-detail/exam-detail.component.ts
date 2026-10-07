import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription, combineLatest } from "rxjs";
import { ToastService } from "../../../core/services/toast.service";
import { ConfirmService } from "../../../core/services/confirm.service";
import { GradingService } from "../../../core/services/grading.service";
import { OrgService } from "../../../core/services/org.service";
import { TenantService } from "../../../core/services/tenant.service";
import { AiService, AssessmentReport } from "../../../core/services/ai.service";
import { Assessment, ResponseDoc } from "../../../core/models/assessment.model";
import { Document } from "../../../core/models/folder.model";
import { Group } from "../../../core/models/org.model";
import { ItemAnalysis, analyzeItems, itemFlags } from "../../../core/domain/psychometrics";
import { SABER11_TESTS, getCompetency, getTest } from "../../../core/domain/taxonomy/saber11";
import { ALPHABET } from "../../../core/utils/alphabet.const";
import { MODULES } from "../../routes.constants";
import { SharedModule } from "../../shared/shared.module";
import { exportResultsPdf, exportStudentReports } from "./results-pdf.util";
import { RosterEntry, pendingFromRoster } from "../../../core/domain/roster";
import { PDFService } from "../../../core/services/pdfService.service";
import { SheetRequest, SheetsContext, sheetsDocument } from "../../exam/generate-exam-dialog/answer-sheet.pdf";

type Tab = "results" | "competencies" | "items" | "ai";

const FLAG_LABEL: Record<string, string> = {
  muy_facil: "Muy fácil",
  muy_dificil: "Muy difícil",
  baja_discriminacion: "Discrimina poco",
  distractor_atractivo: "Un distractor atrae más que la clave",
};

/**
 * Detalle y reportes de una evaluación.
 *
 * Ruta: /grade/exam/:examId
 */
@Component({
  selector: "app-exam-detail",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./exam-detail.component.html",
})
export class ExamDetailComponent implements OnInit, OnDestroy {
  readonly ALPHABET = ALPHABET;
  readonly FLAG_LABEL = FLAG_LABEL;
  readonly getTest = getTest;

  exam: Assessment | null = null;
  responses: ResponseDoc[] = [];
  groups: Group[] = [];
  snapshot = new Map<string, Document>();
  institution = "";

  tab: Tab = "results";
  groupFilter: string = "all";
  isLoading = true;
  errorMessage = "";
  isExporting = false;

  readonly aiEnabled: boolean;
  aiReport: AssessmentReport | null = null;
  isGeneratingReport = false;

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService,
    private orgService: OrgService,
    private tenant: TenantService,
    private ai: AiService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private pdfService: PDFService
  ) {
    this.aiEnabled = ai.enabled;
  }

  async ngOnInit(): Promise<void> {
    const examId = this.route.snapshot.paramMap.get("examId");
    if (!examId) {
      this.errorMessage = "Falta el id de la evaluación en la URL.";
      this.isLoading = false;
      return;
    }
    try {
      this.exam = await this.gradingService.getAssessment(examId);
      if (!this.exam) {
        this.errorMessage = "No encontramos esa evaluación en tu organización.";
        return;
      }
      this.sub = combineLatest([
        this.gradingService.listResponses(examId),
        this.orgService.groups$(),
        this.tenant.org$,
      ]).subscribe(([responses, groups, org]) => {
        this.responses = responses;
        this.groups = groups;
        this.institution = org?.name ?? "";
      });
      this.gradingService
        .getSnapshotItems(examId)
        .then((items) => (this.snapshot = new Map(items.map((i) => [i.id, i]))))
        .catch(() => undefined);
    } catch (err) {
      console.error("Error cargando la evaluación:", err);
      this.errorMessage = "No pudimos cargar la evaluación.";
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ---------------------------------------------------------------------
  //  Filtros y métricas
  // ---------------------------------------------------------------------

  get groupsWithResults(): Group[] {
    const ids = new Set(this.responses.map((r) => r.groupId).filter(Boolean));
    return this.groups.filter((g) => ids.has(g.id));
  }

  get filtered(): ResponseDoc[] {
    if (this.groupFilter === "all") return this.responses;
    if (this.groupFilter === "none") return this.responses.filter((r) => !r.groupId);
    return this.responses.filter((r) => r.groupId === this.groupFilter);
  }

  get sortedFiltered(): ResponseDoc[] {
    return this.filtered
      .slice()
      .sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "es"));
  }

  groupName = (groupId?: string): string =>
    this.groups.find((g) => g.id === groupId)?.name ?? "";

  formLabel(formId: string): string {
    return this.exam?.forms.find((f) => f.id === formId)?.label ?? formId;
  }

  private avg(xs: number[], decimals = 1): number {
    if (xs.length === 0) return 0;
    const f = 10 ** decimals;
    return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * f) / f;
  }

  get average(): number {
    return this.avg(this.filtered.map((r) => r.score ?? 0));
  }

  get bestScore(): number {
    return this.filtered.length ? Math.max(...this.filtered.map((r) => r.score ?? 0)) : 0;
  }

  get worstScore(): number {
    return this.filtered.length ? Math.min(...this.filtered.map((r) => r.score ?? 0)) : 0;
  }

  get globalAverage(): number | null {
    const g = this.filtered
      .map((r) => r.breakdown?.global)
      .filter((x): x is number => typeof x === "number");
    return g.length ? Math.round(this.avg(g, 0)) : null;
  }

  get testsPresent(): string[] {
    const present = new Set(this.filtered.flatMap((r) => Object.keys(r.breakdown?.byTest ?? {})));
    return SABER11_TESTS.map((t) => t.id).filter((id) => present.has(id));
  }

  /** Promedio por prueba + distribución por nivel de desempeño. */
  get testSummary(): { id: string; label: string; avg: number; levels: { label: string; count: number; pct: number }[] }[] {
    return this.testsPresent.map((id) => {
      const def = getTest(id)!;
      const scores = this.filtered
        .map((r) => r.breakdown?.byTest?.[id])
        .filter((x): x is NonNullable<typeof x> => !!x);
      const n = scores.length || 1;
      return {
        id,
        label: def.label,
        avg: Math.round(this.avg(scores.map((s) => s.score), 0)),
        levels: def.levelLabels.map((label, li) => {
          const count = scores.filter((s) => s.level === li).length;
          return { label, count, pct: Math.round((count / n) * 100) };
        }),
      };
    });
  }

  /** % de aciertos por competencia (sumando todos los estudiantes). */
  get competencySummary(): { test: string; label: string; pct: number; total: number }[] {
    const acc = new Map<string, { c: number; t: number }>();
    for (const r of this.filtered) {
      for (const [k, v] of Object.entries(r.breakdown?.byCompetency ?? {})) {
        const a = acc.get(k) ?? { c: 0, t: 0 };
        a.c += v.correct;
        a.t += v.total;
        acc.set(k, a);
      }
    }
    return [...acc.entries()]
      .map(([k, a]) => {
        const [test, comp] = k.split(":");
        return {
          test,
          label: getCompetency(test, comp)?.label ?? comp,
          pct: a.t ? Math.round((a.c / a.t) * 100) : 0,
          total: a.t,
        };
      })
      .sort((x, y) => SABER11_TESTS.findIndex((t) => t.id === x.test) - SABER11_TESTS.findIndex((t) => t.id === y.test) || x.pct - y.pct);
  }

  get itemAnalysis(): ItemAnalysis[] {
    if (!this.exam) return [];
    return analyzeItems(this.exam.forms, this.filtered);
  }

  flagsOf(item: ItemAnalysis): string[] {
    return itemFlags(item, 10);
  }

  stemOf(itemId: string): string {
    const name = this.snapshot.get(itemId)?.name ?? "";
    return name.length > 140 ? name.slice(0, 140) + "…" : name;
  }

  pct(x: number): number {
    return Math.round(x * 100);
  }

  // ---------------------------------------------------------------------
  //  Hojas personalizadas: pendientes y reimpresión
  // ---------------------------------------------------------------------

  /** Estudiantes del listado (según el filtro de grupo). */
  get rosterInFilter(): RosterEntry[] {
    const roster = this.exam?.roster ?? [];
    if (this.groupFilter === "all") return roster;
    if (this.groupFilter === "none") return roster.filter((r) => !r.groupId);
    return roster.filter((r) => r.groupId === this.groupFilter);
  }

  get pending(): RosterEntry[] {
    const graded = this.responses.map((r) => r.studentId).filter((x): x is string => !!x);
    return pendingFromRoster(this.rosterInFilter, graded);
  }

  get gradedFromRoster(): number {
    return this.rosterInFilter.length - this.pending.length;
  }

  /** Reimpresión disponible para hojas multipágina (no las v1). */
  get canPrintSheets(): boolean {
    return !!this.exam && this.exam.sheet.version !== 1;
  }

  private sheetsContext(): SheetsContext {
    const exam = this.exam!;
    return {
      orgId: exam.orgId,
      assessmentId: exam.id,
      title: exam.title,
      forms: exam.forms,
      letterCount: exam.sheet.letterCount,
      codeDigits: exam.sheet.codeDigits,
      geometry: exam.sheet.version === 3 ? 3 : 2,
      balanced: exam.sheet.balanced === true,
    };
  }

  private printSheets(requests: SheetRequest[]): void {
    if (!this.exam || requests.length === 0) return;
    this.pdfService.open(sheetsDocument(this.sheetsContext(), requests));
  }

  private toRequest(entry: RosterEntry): SheetRequest {
    return {
      formId: entry.formId,
      studentId: entry.studentId,
      name: entry.name,
      groupName: this.groupName(entry.groupId ?? undefined),
    };
  }

  reprintSheet(entry: RosterEntry): void {
    this.printSheets([this.toRequest(entry)]);
  }

  reprintPending(): void {
    this.printSheets(this.pending.map((e) => this.toRequest(e)));
  }

  /** Una hoja en blanco por forma (estudiantes nuevos o hojas dañadas). */
  printSpareSheets(): void {
    this.printSheets((this.exam?.forms ?? []).map((f) => ({ formId: f.id })));
  }

  // ---------------------------------------------------------------------
  //  Acciones
  // ---------------------------------------------------------------------

  goToGrade(): void {
    if (this.exam) this.router.navigateByUrl(MODULES.GRADE.EXAM_GRADE(this.exam.id));
  }

  goToScan(): void {
    this.router.navigateByUrl(MODULES.GRADE.SCAN);
  }

  goBackToList(): void {
    this.router.navigateByUrl(MODULES.GRADE.LIST);
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  }

  formatDateTime(ts: number): string {
    return new Date(ts).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  async deleteResult(result: ResponseDoc): Promise<void> {
    if (!this.exam) return;
    const ok = await this.confirm.ask({
      title: "¿Borrar esta calificación?",
      message: `Vas a borrar la nota de ${result.studentName ?? "este estudiante"}.`,
      confirmText: "Sí, borrar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await this.gradingService.deleteResponse(this.exam.id, result.id);
      this.toast.success("Calificación eliminada.", "ExamHub", 2500);
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos borrar la calificación.", "ExamHub", 3500);
    }
  }

  private get filterLabel(): string | undefined {
    if (this.groupFilter === "all") return undefined;
    if (this.groupFilter === "none") return "Sin grupo";
    return this.groupName(this.groupFilter);
  }

  async exportPdf(kind: "planilla" | "boletines"): Promise<void> {
    if (!this.exam || this.filtered.length === 0) {
      this.toast.warning("Todavía no hay resultados para exportar.", "ExamHub", 3000);
      return;
    }
    this.isExporting = true;
    try {
      if (kind === "planilla") {
        await exportResultsPdf(this.exam, this.filtered, this.groupName, this.filterLabel);
      } else {
        await exportStudentReports(this.exam, this.filtered, this.groupName, this.institution);
      }
    } catch (err) {
      console.error("Error exportando PDF:", err);
      this.toast.danger("No pudimos generar el PDF.", "ExamHub", 3500);
    } finally {
      this.isExporting = false;
    }
  }

  /** CSV (separador ;, compatible con Excel en español). */
  exportCsv(): void {
    if (!this.exam) return;
    const tests = this.testsPresent;
    const head = ["Estudiante", "Código", "Grupo", "Forma", "Aciertos", "Total", ...tests.map((t) => getTest(t)?.label ?? t), "Global", "Nota", "Fecha"];
    const rows = this.sortedFiltered.map((r) => [
      r.studentName ?? "",
      r.studentCode ?? "",
      this.groupName(r.groupId),
      this.formLabel(r.formId),
      r.breakdown?.correct ?? 0,
      r.breakdown?.total ?? 0,
      ...tests.map((t) => r.breakdown?.byTest?.[t]?.score ?? ""),
      r.breakdown?.global ?? "",
      String(r.score ?? 0).replace(".", ","),
      new Date(r.scannedAt).toLocaleDateString("es-CO"),
    ]);
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resultados - ${this.exam.title}.csv`.replace(/[/\\?%*:|"<>]/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  async generateAiReport(): Promise<void> {
    if (!this.exam || this.isGeneratingReport) return;
    this.isGeneratingReport = true;
    try {
      const groupId =
        this.groupFilter !== "all" && this.groupFilter !== "none" ? this.groupFilter : null;
      this.aiReport = await this.ai.assessmentReport(this.exam.id, groupId);
    } catch (err) {
      this.toast.danger(this.ai.friendlyError(err), "ExamHub", 4500);
    } finally {
      this.isGeneratingReport = false;
    }
  }
}
