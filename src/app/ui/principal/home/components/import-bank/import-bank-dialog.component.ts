import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { ToastService } from "../../../../../core/services/toast.service";
import { ExamService } from "../../../../../core/services/ExamService.service";
import { SharedModule } from "../../../../shared/shared.module";
import {
  FolderBy,
  GenerateOptions,
  ImportFolder,
  ImportParse,
  ImportQuestion,
  buildConvertPrompt,
  buildGeneratePrompt,
  countTree,
  defaultGenerateOptions,
  emptyFolder,
  extractJson,
  parseBankInput,
} from "../../../../../core/domain/bankImport";
import { SABER11_TESTS, getCompetency, getTest } from "../../../../../core/domain/taxonomy/saber11";
import { QUESTION_KIND_LABEL } from "../../../../../core/models/questionKind.enum";
import { TEST_COLOR } from "../../../../shared/test-colors";

type Mode = "generate" | "convert" | "text";

/**
 * "Crea tu banco con IA": ExamHub arma el prompt y el docente lo usa
 * en SU IA (ChatGPT, Gemini, Claude… en su versión gratuita). La
 * respuesta vuelve aquí, se revisa y se guarda organizada en carpetas.
 * También acepta texto pegado desde Word, sin IA.
 *
 *   1. Preparar: generar preguntas nuevas, convertir material o Word.
 *   2. Pegar la respuesta (JSON o texto; se detecta solo).
 *   3. Revisar el árbol, quitar lo que sobre y guardar.
 */
@Component({
  selector: "app-import-bank-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, SharedModule],
  templateUrl: "./import-bank-dialog.component.html",
})
export class ImportBankDialogComponent {
  readonly tests = SABER11_TESTS;
  readonly TEST_COLOR = TEST_COLOR;
  readonly KIND_LABEL = QUESTION_KIND_LABEL as Record<string, string>;
  readonly letters = "ABCDEFGH";
  readonly folderByOptions: { id: FolderBy; label: string }[] = [
    { id: "topic", label: "Una subcarpeta por tema" },
    { id: "competency", label: "Una subcarpeta por competencia" },
    { id: "difficulty", label: "Por dificultad (fácil, media, difícil)" },
    { id: "none", label: "Todo en una sola carpeta" },
  ];
  readonly aiLinks = [
    { label: "ChatGPT", url: "https://chatgpt.com/" },
    { label: "Gemini", url: "https://gemini.google.com/app" },
    { label: "Claude", url: "https://claude.ai/new" },
  ];

  step: 1 | 2 | 3 = 1;
  mode: Mode = "generate";

  gen: GenerateOptions = defaultGenerateOptions();
  showSource = false;
  convertFolders = true;
  promptCopied = false;

  pasted = "";
  parse: ImportParse | null = null;

  wrap = false;
  wrapName = "";
  importing = false;

  constructor(
    private dialogRef: MatDialogRef<ImportBankDialogComponent>,
    private examService: ExamService,
    private toast: ToastService,
    @Inject(MAT_DIALOG_DATA) public data: { path: string[]; folderName?: string }
  ) {}

  // ========== Paso 1 ==========

  get prompt(): string {
    return this.mode === "generate" ? buildGeneratePrompt(this.gen) : buildConvertPrompt(this.convertFolders);
  }

  get selectedTest() {
    return getTest(this.gen.test);
  }

  get canCopy(): boolean {
    return this.mode !== "generate" || !!this.gen.topic.trim() || !!this.gen.source.trim();
  }

  setMode(m: Mode): void {
    this.mode = m;
    this.promptCopied = false;
  }

  setTest(id: string): void {
    this.gen.test = id;
    this.gen.competencies = [];
    if (id === "" && this.gen.folderBy === "competency") this.gen.folderBy = "topic";
  }

  toggleCompetency(id: string): void {
    const list = this.gen.competencies;
    this.gen.competencies = list.includes(id) ? list.filter((c) => c !== id) : [...list, id];
  }

  get passageQuestions(): number {
    return this.gen.passages * this.gen.questionsPerPassage;
  }

  async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.prompt);
      this.promptCopied = true;
      this.toast.success("Prompt copiado. Pégalo en tu IA.", "ExamHub", 2000);
    } catch {
      this.toast.warning("No pudimos copiar: selecciona el texto del prompt y cópialo.", "ExamHub", 3500);
    }
  }

  async copyAndOpen(url: string): Promise<void> {
    await this.copyPrompt();
    window.open(url, "_blank", "noopener");
  }

  // ========== Paso 2 ==========

  get detected(): "json" | "text" | null {
    if (!this.pasted.trim()) return null;
    return extractJson(this.pasted) !== null ? "json" : "text";
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      this.pasted = await navigator.clipboard.readText();
    } catch {
      this.toast.warning("Tu navegador no permitió leer el portapapeles: pega con Ctrl+V.", "ExamHub", 3500);
    }
  }

  validate(): void {
    this.parse = parseBankInput(this.pasted);
    const c = countTree(this.parse.root);
    if (c.questions === 0) return;
    // Si todo quedó suelto, sugerir agruparlo en una carpeta nueva.
    const loose = this.parse.root.folders.length === 0;
    this.wrap = loose && c.questions > 1;
    this.wrapName =
      this.mode === "generate"
        ? this.gen.folderName.trim() || this.gen.topic.split(/[\n,;]/)[0].trim()
        : "";
    if (!this.wrapName) this.wrapName = "Preguntas importadas";
    this.step = 3;
  }

  // ========== Paso 3 ==========

  get counts() {
    return this.parse ? countTree(this.parse.root) : { folders: 0, passages: 0, questions: 0 };
  }

  removeAt<T>(list: T[], i: number): void {
    list.splice(i, 1);
  }

  folderCount(f: ImportFolder): number {
    return countTree(f).questions;
  }

  testLabel(q: ImportQuestion): string {
    const t = getTest(q.test);
    if (!t) return "";
    const comp = getCompetency(q.test, q.competency);
    return comp ? `${t.shortLabel} · ${comp.label}` : t.label;
  }

  async confirmImport(): Promise<void> {
    if (!this.parse) return;
    let root = this.parse.root;
    if (this.wrap && this.wrapName.trim()) {
      root = emptyFolder();
      root.folders.push({ ...this.parse.root, name: this.wrapName.trim() });
    }
    this.importing = true;
    try {
      const r = await this.examService.importTree(
        this.data.path,
        root,
        this.mode === "generate" ? "ai" : "import"
      );
      const parts = [`${r.questions} pregunta(s)`];
      if (r.passages) parts.push(`${r.passages} lectura(s)`);
      if (r.folders) parts.push(`${r.folders} carpeta(s) nueva(s)`);
      this.toast.success(`Importado: ${parts.join(", ")}.`, "ExamHub", 4000);
      this.dialogRef.close({ imported: true });
    } catch (e: any) {
      this.toast.danger("No se pudo importar: " + (e?.message ?? "error desconocido"), "ExamHub", 5000);
    } finally {
      this.importing = false;
    }
  }

  back(): void {
    if (this.step > 1) this.step = (this.step - 1) as 1 | 2;
  }

  next(): void {
    if (this.step === 1) this.step = 2;
    else if (this.step === 2) this.validate();
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
