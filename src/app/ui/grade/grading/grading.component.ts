import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription, combineLatest } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import jsQR from "jsqr";
import { ToastService } from "../../../core/services/toast.service";
import { ConfirmService } from "../../../core/services/confirm.service";
import { SharedModule } from "../../shared/shared.module";
import { DetectedAnswer } from "../../../core/models/gradedExam.model";
import {
  Assessment,
  FormDef,
  KeyEntry,
  ResponseSource,
  ScoreBreakdown,
} from "../../../core/models/assessment.model";
import { Group, Student } from "../../../core/models/org.model";
import { QuestionKind } from "../../../core/models/questionKind.enum";
import { GradingService } from "../../../core/services/grading.service";
import { OrgService } from "../../../core/services/org.service";
import { OmrError, OmrService } from "../../../core/services/omr.service";
import { decodeQrPayload } from "../../../core/utils/qrPayload.util";
import { computeSheetLayout } from "../../../core/domain/answerSheetLayout";
import { isCorrectAnswer, scoreResponse, toScale } from "../../../core/domain/scoring";
import { getCompetency, getTest } from "../../../core/domain/taxonomy/saber11";
import { MODULES } from "../../routes.constants";

interface Row {
  index: number;
  entry: KeyEntry;
  letters: string[];
  isCorrect: boolean;
  isUngradable: boolean;
}

/**
 * Calificación de una hoja de respuestas.
 *
 * Ruta: /grade/exam/:examId/grade?versionId=v1&page=1
 *
 * Flujo:
 *   1. El docente toma o sube una o varias fotos (una por hoja).
 *   2. De cada foto se lee el QR → forma y número de página; el OMR
 *      llena las respuestas de esa página y el código del estudiante.
 *   3. El estudiante se identifica por su código contra el listado del
 *      colegio (o se elige a mano).
 *   4. El docente revisa/corrige y guarda. El puntaje se calcula con la
 *      capa de dominio: total, por prueba, por competencia y global.
 */
@Component({
  selector: "app-grading",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./grading.component.html",
})
export class GradingComponent implements OnInit, OnDestroy {
  assessment: Assessment | null = null;
  form: FormDef | null = null;
  detected: DetectedAnswer[] = [];
  manualScores: Record<number, number> = {};
  pagesScanned = new Set<number>();
  currentPage = 1;

  students: Student[] = [];
  groups: Group[] = [];
  selectedStudentId: string | null = null;
  studentName = "";
  readCode: string | null = null;
  studentSearch = "";

  maxScore = 5;
  isLoading = true;
  isSaving = false;
  errorMessage = "";

  isOmrRunning = false;
  omrStatus = "";
  omrPreviewDataUrl: string | null = null;
  private lastSource: ResponseSource = "assisted";
  private sub?: Subscription;

  readonly getTest = getTest;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService,
    private orgService: OrgService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private omrService: OmrService
  ) {}

  async ngOnInit(): Promise<void> {
    const examId = this.route.snapshot.paramMap.get("examId");
    const versionId = this.route.snapshot.queryParamMap.get("versionId");
    const page = Number(this.route.snapshot.queryParamMap.get("page")) || 1;
    if (!examId) {
      this.errorMessage = "Falta el id del examen en la URL.";
      this.isLoading = false;
      return;
    }
    this.sub = combineLatest([this.orgService.students$(), this.orgService.groups$()]).subscribe(
      ([students, groups]) => {
        this.students = students.filter((s) => s.active);
        this.groups = groups;
      }
    );
    try {
      const assessment = await this.gradingService.getAssessment(examId);
      if (!assessment) {
        this.errorMessage =
          "No encontramos esa evaluación en tu organización. Verifica que estés en la institución correcta.";
        return;
      }
      this.assessment = assessment;
      this.maxScore = assessment.maxScore ?? 5;
      this.selectForm(assessment.forms.find((f) => f.id === versionId) ?? assessment.forms[0]);
      this.currentPage = Math.min(page, this.totalPages);
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
  //  Forma, páginas y filas
  // ---------------------------------------------------------------------

  get totalPages(): number {
    return this.assessment?.sheet?.totalPages ?? 1;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  selectForm(form: FormDef): void {
    this.form = form;
    this.resetAnswers();
  }

  selectFormById(id: string): void {
    const f = this.assessment?.forms.find((x) => x.id === id);
    if (f) this.selectForm(f);
  }

  private resetAnswers(): void {
    this.detected = new Array(this.form?.key.length ?? 0).fill(null);
    this.manualScores = {};
    this.pagesScanned = new Set();
    this.lastSource = "assisted";
  }

  /** Burbujas impresas para la posición (debe coincidir con el generador). */
  private bubbleCount(entry: KeyEntry): number {
    if (entry.kind === QuestionKind.TRUE_FALSE) return 2;
    if (entry.kind !== QuestionKind.MULTIPLE_CHOICE_SINGLE) return 0;
    return entry.perm?.length ?? this.assessment?.sheet.letterCount ?? 4;
  }

  get rows(): Row[] {
    if (!this.form || !this.assessment) return [];
    const letters = this.assessment.letters;
    const legacy = this.assessment.sheet.version === 1;
    return this.form.key.map((entry, index) => ({
      index,
      entry,
      letters: legacy ? letters : letters.slice(0, Math.max(2, this.bubbleCount(entry))),
      isCorrect: isCorrectAnswer(entry, this.detected[index]),
      isUngradable: entry.letter === null,
    }));
  }

  get breakdown(): ScoreBreakdown | null {
    if (!this.form) return null;
    return scoreResponse(this.form.key, this.detected, this.manualScores);
  }

  get score(): number {
    const b = this.breakdown;
    return b ? toScale(b.correct, b.total, this.maxScore) : 0;
  }

  get testScores(): { id: string; label: string; score: number; correct: number; total: number }[] {
    const b = this.breakdown;
    if (!b) return [];
    return Object.entries(b.byTest).map(([id, t]) => ({
      id,
      label: getTest(id)?.label ?? id,
      ...t,
    }));
  }

  competencyLabel(entry: KeyEntry): string {
    return getCompetency(entry.test, entry.competency)?.label ?? "";
  }

  // ---------------------------------------------------------------------
  //  Edición manual
  // ---------------------------------------------------------------------

  toggleAnswer(i: number, letter: string): void {
    this.detected[i] = this.detected[i] === letter ? null : letter;
    if (this.lastSource === "omr") this.lastSource = "mixed";
  }

  markMulti(i: number): void {
    this.detected[i] = this.detected[i] === "MULTI" ? null : "MULTI";
    if (this.lastSource === "omr") this.lastSource = "mixed";
  }

  setManualScore(i: number, value: number | string): void {
    let v = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(v)) v = 0;
    this.manualScores[i] = Math.min(1, Math.max(0, v));
  }

  // ---------------------------------------------------------------------
  //  Estudiante
  // ---------------------------------------------------------------------

  get selectedStudent(): Student | null {
    return this.students.find((s) => s.id === this.selectedStudentId) ?? null;
  }

  get studentOptions(): Student[] {
    const q = this.studentSearch.trim().toLowerCase();
    const inGroups = this.assessment?.groupIds?.length
      ? this.students.filter((s) => s.groupId && this.assessment!.groupIds.includes(s.groupId))
      : this.students;
    const base = inGroups.length > 0 ? inGroups : this.students;
    return (q ? base.filter((s) => s.fullName.toLowerCase().includes(q) || s.code.includes(q)) : base).slice(0, 50);
  }

  groupName(groupId: string | null): string {
    return this.groups.find((g) => g.id === groupId)?.name ?? "";
  }

  private matchStudentByCode(code: string): void {
    const norm = (c: string) => c.replace(/^0+/, "");
    const found = this.students.find((s) => norm(s.code) === norm(code));
    this.readCode = code;
    if (found) {
      this.selectedStudentId = found.id;
      this.studentName = "";
    }
  }

  // ---------------------------------------------------------------------
  //  Fotos + OMR
  // ---------------------------------------------------------------------

  async onPhotosSelected(event: Event): Promise<void> {
    if (!this.assessment || !this.form) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;

    this.isOmrRunning = true;
    this.omrStatus = "Cargando motor de visión (la primera vez puede tardar 5–10 s)…";
    try {
      await this.omrService.ensureLoaded();
      for (const [n, file] of files.entries()) {
        this.omrStatus = `Procesando foto ${n + 1} de ${files.length}…`;
        await this.processPhoto(file);
      }
      const missing = this.pages.filter((p) => !this.pagesScanned.has(p));
      this.omrStatus =
        missing.length > 0
          ? `Faltan las hojas: ${missing.join(", ")}. Revisa y corrige lo detectado.`
          : "Hojas procesadas. Revisa y corrige lo que haga falta antes de guardar.";
    } catch (err: any) {
      console.error("OMR error:", err);
      const msg =
        err instanceof OmrError
          ? err.message
          : `No pudimos procesar la foto: ${String(err?.message ?? err).slice(0, 140)}`;
      this.omrStatus = msg;
      this.toast.warning(msg, "ExamHub", 5000);
    } finally {
      this.isOmrRunning = false;
    }
  }

  private async processPhoto(file: File): Promise<void> {
    const assessment = this.assessment!;
    const image = await loadImage(file);
    const payload = readQr(image);
    let page = this.currentPage;

    if (payload) {
      if (payload.examId !== assessment.id) {
        this.toast.warning(
          "Una foto pertenece a otra evaluación y se omitió.",
          "ExamHub",
          4000
        );
        return;
      }
      if (payload.versionId !== this.form!.id) {
        if (this.pagesScanned.size > 0) {
          this.toast.warning(
            "Una foto es de otra forma del examen (otro estudiante). Guarda esta hoja primero.",
            "ExamHub",
            4500
          );
          return;
        }
        this.selectFormById(payload.versionId);
      }
      page = payload.page;
    }

    if (assessment.sheet.version === 1) {
      const result = await this.omrService.detectAnswers(
        image,
        this.form!.key.map((k) => k.letter),
        assessment.letters
      );
      this.detected = result.answers;
      this.omrPreviewDataUrl = result.previewDataUrl;
    } else {
      const layout = computeSheetLayout({
        questionLetters: this.form!.key.map((k) => this.bubbleCount(k)),
        letterCount: assessment.sheet.letterCount,
        codeDigits: assessment.sheet.codeDigits,
      });
      const pageLayout = layout.pages[page - 1];
      if (!pageLayout) {
        this.toast.warning(`La hoja ${page} no existe en esta forma.`, "ExamHub", 3500);
        return;
      }
      const read = await this.omrService.detectSheet(image, pageLayout, assessment.letters);
      const next = [...this.detected];
      read.answers.forEach((ans, idx) => (next[idx] = ans));
      this.detected = next;
      this.omrPreviewDataUrl = read.previewDataUrl;
      if (read.code && !this.selectedStudentId) this.matchStudentByCode(read.code);
    }
    this.pagesScanned.add(page);
    this.currentPage = Math.min(this.totalPages, page + 1);
    if (this.lastSource !== "mixed") this.lastSource = "omr";
  }

  // ---------------------------------------------------------------------
  //  Guardar
  // ---------------------------------------------------------------------

  async save(): Promise<void> {
    if (!this.assessment || !this.form || this.isSaving) return;
    const student = this.selectedStudent;
    if (!student && !this.studentName.trim()) {
      this.toast.warning("Elige el estudiante o escribe su nombre.", "ExamHub", 3000);
      return;
    }
    this.isSaving = true;
    try {
      let id = uuidv4();
      if (student) {
        const existing = await this.gradingService.findResponseForStudent(this.assessment.id, student.id);
        if (existing) {
          const ok = await this.confirm.ask({
            title: "Este estudiante ya tiene calificación",
            message: `${student.fullName} ya fue calificado (${existing.score}). ¿Reemplazar?`,
            confirmText: "Reemplazar",
          });
          if (!ok) return;
          id = existing.id;
        }
      }
      const breakdown = this.breakdown!;
      const cleanManual = Object.fromEntries(
        Object.entries(this.manualScores).filter(([, v]) => v > 0)
      );
      const code = student?.code ?? this.readCode ?? undefined;
      await this.gradingService.saveResponse(this.assessment.id, {
        id,
        formId: this.form.id,
        answers: [...this.detected],
        source: this.lastSource,
        breakdown,
        score: this.score,
        pagesScanned: [...this.pagesScanned].sort((a, b) => a - b),
        ...(student
          ? { studentId: student.id, studentName: student.fullName, groupId: student.groupId ?? undefined }
          : { studentName: this.studentName.trim() }),
        ...(code ? { studentCode: code } : {}),
        ...(Object.keys(cleanManual).length ? { manualScores: cleanManual } : {}),
      });
      this.toast.success(
        `Guardado: ${student?.fullName ?? this.studentName} — ${this.score} / ${this.maxScore}.`,
        "ExamHub",
        3500
      );
      this.selectedStudentId = null;
      this.studentName = "";
      this.studentSearch = "";
      this.readCode = null;
      this.omrPreviewDataUrl = null;
      this.omrStatus = "";
      this.currentPage = 1;
      this.resetAnswers();
    } catch (err) {
      console.error("Error guardando la calificación:", err);
      this.toast.danger("No pudimos guardar la calificación.", "ExamHub", 3500);
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

function loadImage(file: File): Promise<HTMLImageElement> {
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

/** Lee el QR de ExamHub en la foto (null si no hay o no es nuestro). */
function readQr(img: HTMLImageElement) {
  const maxW = 1600;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(data.data, data.width, data.height);
  return result ? decodeQrPayload(result.data) : null;
}
