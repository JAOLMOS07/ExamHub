import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { Subscription } from "rxjs";
import { SharedModule } from "../shared/shared.module";
import { CatalogService } from "../../core/services/catalog.service";
import { ToastService } from "../../core/services/toast.service";
import { ConfirmService } from "../../core/services/confirm.service";
import {
  CatalogUnit,
  autoSimulacro,
  filterUnits,
  mixCounts,
} from "../../core/domain/catalog";
import { parseBankInput } from "../../core/domain/bankImport";
import { createRng, randomSeed } from "../../core/domain/rng";
import { SABER11_TESTS, getCompetency, getTest } from "../../core/domain/taxonomy/saber11";
import { MODULES } from "../routes.constants";
import { TipComponent, TourButtonComponent } from "../shared/help/help.components";

type Tab = "explore" | "auto" | "mine" | "review";

/**
 * Banco ExamHub: preguntas tipo Saber 11 listas para usar.
 *
 * Ruta: /catalog
 *   Explorar        filtrar, ver y copiar preguntas al banco del colegio
 *   Simulacro       armar uno automático con las proporciones del Saber 11
 *   Mis aportes     preguntas que el docente propuso y su estado
 *   Revisión        (administradores de la plataforma) aprobar y publicar
 */
@Component({
  selector: "app-catalog",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule, TourButtonComponent, TipComponent],
  templateUrl: "./catalog.component.html",
})
export class CatalogComponent implements OnInit, OnDestroy {
  readonly tests = SABER11_TESTS;
  readonly getTest = getTest;
  readonly letters = "ABCDEFGH";

  tab: Tab = "explore";
  isAdmin = false;

  // Explorar
  test: string = SABER11_TESTS[0].id;
  competency = "";
  difficulty = 0;
  kind: "" | "question" | "passage" = "";
  search = "";
  units: CatalogUnit[] = [];
  loading = true;
  expanded = new Set<string>();
  selected = new Map<string, CatalogUnit>();

  // Simulacro automático
  autoTotal = 40;
  autoTests = new Set<string>(SABER11_TESTS.map((t) => t.id));
  autoDifficulty = 0;
  autoResult: { units: CatalogUnit[]; got: Record<string, number>; short: string[]; counts: Record<string, number> } | null = null;

  // Mis aportes / revisión
  mine: CatalogUnit[] = [];
  pending: CatalogUnit[] = [];
  publishText = "";
  busy = false;

  private subs: Subscription[] = [];
  private unitsSub?: Subscription;

  constructor(
    private catalog: CatalogService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadTest(this.test);
    this.subs.push(this.catalog.myContributions$().subscribe((m) => (this.mine = m)));
    this.isAdmin = await this.catalog.isPlatformAdmin();
    if (this.isAdmin) this.subs.push(this.catalog.pending$().subscribe((p) => (this.pending = p)));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.unitsSub?.unsubscribe();
  }

  // ---------------------------------------------------------------------
  //  Explorar
  // ---------------------------------------------------------------------

  loadTest(id: string): void {
    this.test = id;
    this.competency = "";
    this.loading = true;
    this.unitsSub?.unsubscribe();
    this.unitsSub = this.catalog.published$(id).subscribe((u) => {
      this.units = u;
      this.loading = false;
    });
  }

  get competencies() {
    return getTest(this.test)?.competencies ?? [];
  }

  get visible(): CatalogUnit[] {
    return filterUnits(this.units, {
      competency: this.competency || undefined,
      difficulty: this.difficulty || undefined,
      kind: this.kind || undefined,
      text: this.search.trim() || undefined,
    });
  }

  get visibleQuestions(): number {
    return this.visible.reduce((a, u) => a + u.questionCount, 0);
  }

  compLabel(test: string, id: string): string {
    return getCompetency(test, id)?.label ?? id;
  }

  toggleExpand(id: string): void {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
  }

  toggleSelect(u: CatalogUnit): void {
    this.selected.has(u.id) ? this.selected.delete(u.id) : this.selected.set(u.id, u);
  }

  selectAllVisible(): void {
    this.visible.forEach((u) => this.selected.set(u.id, u));
  }

  clearSelection(): void {
    this.selected.clear();
  }

  get selectedQuestions(): number {
    let n = 0;
    this.selected.forEach((u) => (n += u.questionCount));
    return n;
  }

  private today(): string {
    return new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  async copySelected(toExam: boolean): Promise<void> {
    if (this.selected.size === 0 || this.busy) return;
    await this.copy([...this.selected.values()], `Banco ExamHub · ${this.today()}`, toExam);
    this.selected.clear();
  }

  private async copy(units: CatalogUnit[], folder: string, toExam: boolean): Promise<void> {
    this.busy = true;
    try {
      const n = await this.catalog.copyToBank(units, folder, toExam);
      if (toExam) {
        this.toast.success(`${n} preguntas copiadas a "${folder}" y listas en el examen en curso.`, "ExamHub", 4500);
        this.router.navigateByUrl(MODULES.HOME.HOME);
      } else {
        this.toast.success(`${n} preguntas copiadas a la carpeta "${folder}" de tu banco.`, "ExamHub", 4000);
      }
    } catch (err) {
      console.error(err);
      this.toast.danger("No se pudieron copiar las preguntas.", "ExamHub", 4000);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------------
  //  Simulacro automático
  // ---------------------------------------------------------------------

  toggleAutoTest(id: string): void {
    this.autoTests.has(id) ? this.autoTests.delete(id) : this.autoTests.add(id);
    this.autoResult = null;
  }

  get autoCounts(): Record<string, number> {
    const ids = SABER11_TESTS.map((t) => t.id).filter((id) => this.autoTests.has(id));
    return ids.length ? mixCounts(Math.max(1, Math.round(this.autoTotal) || 1), ids) : {};
  }

  async buildAuto(): Promise<void> {
    const counts = this.autoCounts;
    if (!Object.keys(counts).length) return;
    this.busy = true;
    try {
      const all = await this.catalog.publishedOf(Object.keys(counts));
      const r = autoSimulacro(all, counts, createRng(randomSeed()), this.autoDifficulty || undefined);
      this.autoResult = { ...r, counts };
    } finally {
      this.busy = false;
    }
  }

  get autoQuestions(): number {
    return this.autoResult ? Object.values(this.autoResult.got).reduce((a, b) => a + b, 0) : 0;
  }

  async useAuto(): Promise<void> {
    if (!this.autoResult?.units.length) return;
    await this.copy(this.autoResult.units, `Simulacro Banco ExamHub · ${this.today()}`, true);
  }

  // ---------------------------------------------------------------------
  //  Revisión (administradores)
  // ---------------------------------------------------------------------

  async review(u: CatalogUnit, approve: boolean): Promise<void> {
    let reason = "";
    if (!approve) {
      reason = (window.prompt("Motivo del rechazo (lo verá el docente):") ?? "").trim();
    }
    try {
      await this.catalog.review(u.id, approve, reason);
      this.toast.success(approve ? "Publicada en el Banco ExamHub." : "Rechazada.", "ExamHub", 2500);
    } catch (err) {
      console.error(err);
      this.toast.danger("No se pudo guardar la revisión.", "ExamHub", 3500);
    }
  }

  async removeUnit(u: CatalogUnit): Promise<void> {
    const ok = await this.confirm.ask({
      title: "¿Quitar del Banco ExamHub?",
      message: "Las copias que ya hicieron los colegios no se borran.",
      confirmText: "Quitar",
      tone: "danger",
    });
    if (!ok) return;
    await this.catalog.remove(u.id);
    this.toast.success("Quitada del catálogo.", "ExamHub", 2500);
  }

  async publishFromText(): Promise<void> {
    if (!this.publishText.trim() || this.busy) return;
    const parsed = parseBankInput(this.publishText);
    this.busy = true;
    try {
      const r = await this.catalog.publishImport(parsed.root);
      const skipped = parsed.errors.length + r.skipped.length;
      this.toast.success(
        `Publicadas ${r.questions} preguntas en ${r.published} unidades.` + (skipped ? ` ${skipped} omitidas (revisa la consola).` : ""),
        "ExamHub",
        5000
      );
      if (skipped) console.warn("[Catálogo] omitidas:", [...parsed.errors, ...r.skipped]);
      this.publishText = "";
      if (this.tab === "review") this.loadTest(this.test);
    } catch (err) {
      console.error(err);
      this.toast.danger("No se pudo publicar. ¿Tu usuario está en platformAdmins?", "ExamHub", 5000);
    } finally {
      this.busy = false;
    }
  }

  statusLabel(s: CatalogUnit["status"]): string {
    return s === "published" ? "Publicada" : s === "pending" ? "En revisión" : "Rechazada";
  }
}
