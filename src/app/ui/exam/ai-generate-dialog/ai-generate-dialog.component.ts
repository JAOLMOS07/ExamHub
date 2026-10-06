import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { AiService, GenerateResult } from "../../../core/services/ai.service";
import { BankImportService, ParseResult } from "../../../core/services/bankImport.service";
import { ToastService } from "../../../core/services/toast.service";
import { Document, Option } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { QuestionKind } from "../../../core/models/questionKind.enum";
import { SABER11_TESTS, TestDef, getCompetency, getTest } from "../../../core/domain/taxonomy/saber11";
import { MathTextComponent } from "../../shared/math/math-text.component";
import { ALPHABET } from "../../../core/utils/alphabet.const";

/**
 * Generador de preguntas tipo ICFES con IA.
 *
 * El docente elige prueba, competencia, grado y tema; la IA propone
 * ítems (con lectura opcional) que se muestran ANTES de guardar. Los
 * ítems entran al banco marcados como "IA · sin revisar" hasta que un
 * docente los edite.
 */
@Component({
  selector: "app-ai-generate-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MathTextComponent],
  templateUrl: "./ai-generate-dialog.component.html",
})
export class AiGenerateDialogComponent {
  readonly tests: TestDef[] = SABER11_TESTS;
  readonly ALPHABET = ALPHABET;
  readonly getCompetency = getCompetency;

  test = "matematicas";
  competency = "";
  component = "";
  grade = "11";
  topic = "";
  count = 3;
  difficulty: number | null = null;
  withStimulus = true;

  isGenerating = false;
  isSaving = false;
  result: GenerateResult | null = null;
  /** Ítems que el docente decidió conservar (por índice). */
  keep = new Set<number>();

  constructor(
    private ai: AiService,
    private importer: BankImportService,
    private toast: ToastService,
    private dialogRef: MatDialogRef<AiGenerateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { path: string[] }
  ) {}

  get selectedTest(): TestDef | undefined {
    return getTest(this.test);
  }

  onTestChange(id: string): void {
    this.test = id;
    this.competency = "";
    this.component = "";
  }

  async generate(): Promise<void> {
    this.isGenerating = true;
    this.result = null;
    try {
      this.result = await this.ai.generateItems({
        test: this.test,
        competency: this.competency || undefined,
        component: this.component || undefined,
        grade: this.grade,
        topic: this.topic.trim() || undefined,
        count: Math.min(10, Math.max(1, Math.floor(this.count))),
        difficulty: this.difficulty ?? undefined,
        withStimulus: this.withStimulus,
      });
      this.keep = new Set(this.result.items.map((_, i) => i));
    } catch (err) {
      this.toast.danger(this.ai.friendlyError(err), "ExamHub", 5000);
    } finally {
      this.isGenerating = false;
    }
  }

  toggleKeep(i: number): void {
    this.keep.has(i) ? this.keep.delete(i) : this.keep.add(i);
  }

  async save(): Promise<void> {
    if (!this.result || this.keep.size === 0) return;
    this.isSaving = true;
    try {
      const questions = this.result.items
        .filter((_, i) => this.keep.has(i))
        .map((it): Document => {
          const doc: Document = {
            id: crypto.randomUUID(),
            name: it.stem,
            type: objectType.QUESTION,
            kind: QuestionKind.MULTIPLE_CHOICE_SINGLE,
            options: it.options.map(
              (text, k) => new Option(crypto.randomUUID(), text, k === it.correctIndex)
            ),
            test: this.result!.test,
            rationale: it.rationale,
            difficulty: it.difficulty,
            grade: this.grade,
            source: "ai",
            reviewed: false,
          } as Document;
          if (it.competency) doc.competency = it.competency;
          if (this.result!.component) doc.component = this.result!.component;
          return doc;
        });

      const parsed: ParseResult = { ok: true, errors: [], looseQuestions: [], passages: [] };
      if (this.result.stimulus) {
        const passage = {
          id: crypto.randomUUID(),
          name: this.result.stimulus.title || "Lectura",
          type: objectType.PASSAGE,
          passageText: this.result.stimulus.text,
          content: [],
        } as Document;
        questions.forEach((q) => (q.passageId = passage.id));
        parsed.passages.push({ passage, questions });
      } else {
        parsed.looseQuestions = questions;
      }
      const r = await this.importer.importToFirestore(parsed, this.data.path);
      this.toast.success(
        `${r.insertedQuestions} pregunta(s) agregadas al banco. Revísalas antes de usarlas en un examen.`,
        "ExamHub",
        4500
      );
      this.dialogRef.close({ imported: true });
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos guardar las preguntas.", "ExamHub", 3500);
    } finally {
      this.isSaving = false;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
