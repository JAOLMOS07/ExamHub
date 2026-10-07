import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Subscription } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { Question } from "../../../core/models/question.model";
import { PDFService } from "../../../core/services/pdfService.service";
import { QuestionService } from "../../../core/services/questionService.service";
import { Document, getQuestionKind } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { QuestionKind } from "../../../core/models/questionKind.enum";
import { ToastService } from "../../../core/services/toast.service";
import { textToPdfNode } from "../../shared/math/math-pdf.helper";
import { PreferencesService } from "../../../core/services/preferences.service";
import { ExamTemplate } from "../../../core/models/preferences.model";
import { GradingService } from "../../../core/services/grading.service";
import { TenantService } from "../../../core/services/tenant.service";
import { OrgService } from "../../../core/services/org.service";
import { FormDef, IdentificationMode } from "../../../core/models/assessment.model";
import { DEFAULT_ORG_SETTINGS, Group, Student } from "../../../core/models/org.model";
import { assignForms, RosterEntry } from "../../../core/domain/roster";
import { ALPHABET } from "../../../core/utils/alphabet.const";
import { randomSeed } from "../../../core/domain/rng";
import { BuiltForm, buildForm, formLabel, hasBubbles } from "../../../core/domain/formBuilder";
import { computeSheetLayout, questionsPerPage } from "../../../core/domain/answerSheetLayout";
import { SABER11_TESTS } from "../../../core/domain/taxonomy/saber11";
import { getTest } from "../../../core/domain/taxonomy/saber11";
import { SheetRequest, SheetsContext, buildSheetsContent, sheetsDocument } from "./answer-sheet.pdf";
import {
  LINE_HEIGHT,
  PackBlock,
  estimateTextHeight,
  packColumns,
} from "../../../core/domain/columnPacking";

@Component({
  selector: "app-generate-exam-dialog",
  templateUrl: "./generate-exam-dialog.component.html",
  styleUrls: ["./generate-exam-dialog.component.css"],
})
export class GenerateExamDialogComponent implements OnInit, OnDestroy {
  examConfigForm!: FormGroup;
  logoBase64: string | ArrayBuffer | null = null;
  exam: Document[] = [];
  amount: number = 1;
  amountQuestions: number = 1;

  /** Plantillas guardadas en preferencias del usuario. */
  templates: ExamTemplate[] = [];
  /** Plantilla actualmente seleccionada (id) o null si ninguna. */
  selectedTemplateId: string | null = null;

  /** Grupos del año (para asociar la evaluación y filtrar reportes). */
  groups: Group[] = [];
  /** Estudiantes activos del año (hojas personalizadas). */
  students: Student[] = [];
  readonly identificationOptions: { id: IdentificationMode; title: string; text: string; icon: string }[] = [
    {
      id: "personalized",
      title: "Hoja con el nombre de cada estudiante",
      text: "Recomendado. Cada estudiante recibe su hoja impresa con su nombre y su forma; el QR lo identifica solo.",
      icon: "badge",
    },
    {
      id: "generic",
      title: "Hojas en blanco",
      text: "Sin listado de estudiantes. Al calificar eliges al estudiante o escribes su nombre.",
      icon: "description",
    },
    {
      id: "code",
      title: "Código en burbujas",
      text: "Avanzado. El estudiante rellena su código; útil si no puedes repartir hojas por nombre.",
      icon: "pin",
    },
  ];
  isGenerating = false;
  private subs: Subscription[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<GenerateExamDialogComponent>,
    private pdfService: PDFService,
    private questionService: QuestionService,
    private toast: ToastService,
    private preferencesService: PreferencesService,
    private gradingService: GradingService,
    private tenant: TenantService,
    private orgService: OrgService,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Question[] }
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.exam = questions;
    });
  }

  ngOnInit() {
    this.examConfigForm = this.formBuilder.group({
      headerType: ["text", Validators.required],
      institution: ["", [Validators.maxLength(70)]],
      title: ["", [Validators.required, Validators.maxLength(70)]],
      place: ["", [Validators.maxLength(70)]],
      subtitle: ["", [Validators.maxLength(70)]],
      /** Fecha impresa en el cuadernillo (YYYY-MM-DD). Vacía = línea en blanco. */
      date: [toIsoDate(new Date())],
      grade: [""],
      /** 1 o 2 columnas; el reparto en 2 columnas es automático. */
      layout: ["2col", Validators.required],
      questionSpacing: [10],
      /** Hoja con la clave del docente al final de cada cuadernillo. */
      includeTeacherKey: [true],
      /** Simulacro: agrupa por prueba ICFES y reporta puntaje global. */
      simulacro: [false],
      identification: ["personalized" as IdentificationMode],
      codeDigits: [DEFAULT_ORG_SETTINGS.studentCodeDigits],
      /** Hojas en blanco de reserva por forma (estudiantes nuevos, hojas dañadas). */
      spareSheets: [2],
      groupIds: [[] as string[]],
      maxScore: [DEFAULT_ORG_SETTINGS.maxScore],
    });

    const year = new Date().getFullYear();
    this.subs.push(
      this.tenant.org$.subscribe((org) => {
        if (!org?.settings) return;
        this.examConfigForm.patchValue({
          codeDigits: org.settings.studentCodeDigits,
          maxScore: org.settings.maxScore,
        });
      }),
      this.orgService.groups$().subscribe((g) => {
        this.groups = g.filter((x) => x.year === year);
        // Sin grupos no hay hojas con nombre posibles.
        if (this.groups.length === 0 && this.examConfigForm.value.identification === "personalized") {
          this.examConfigForm.patchValue({ identification: "generic" });
        }
      }),
      this.orgService
        .students$()
        .subscribe((st) => (this.students = st.filter((x) => x.active && x.year === year)))
    );

    this.amountQuestions = this.exam.length;

    // Cargar plantillas del usuario
    this.preferencesService.preferences$.subscribe((p) => {
      this.templates = p.examTemplates ?? [];
    });
  }

  /**
   * Aplica una plantilla al formulario: pre-llena los campos con los
   * valores guardados. El profe puede después editar lo que sea antes
   * de generar.
   */
  applyTemplate(templateId: string | null): void {
    this.selectedTemplateId = templateId;
    if (!templateId) return;
    const t = this.templates.find((x) => x.id === templateId);
    if (!t) return;
    this.examConfigForm.patchValue({
      institution: t.institution ?? "",
      title: t.title ?? "",
      place: t.place ?? "",
      subtitle: t.subtitle ?? "",
      grade: t.grade ?? "",
      layout: t.layout ?? "1col",
    });
    this.toast.success(`Plantilla "${t.name}" aplicada.`, "ExamHub", 2000);
  }

  ngOnDestroy(): void {
    this.subs.forEach((x) => x.unsubscribe());
  }

  toggleGroup(groupId: string, checked: boolean): void {
    const current: string[] = this.examConfigForm.value.groupIds ?? [];
    const next = checked ? [...new Set([...current, groupId])] : current.filter((g) => g !== groupId);
    this.examConfigForm.patchValue({ groupIds: next });
  }

  /** ¿Cuántas preguntas caben por hoja de respuestas con la configuración actual? */
  get sheetCapacity(): number {
    const letters = this.letterCountFor(this.exam);
    const digits = this.examConfigForm?.value?.identification === "code" ? Number(this.examConfigForm.value.codeDigits) || 0 : 0;
    return questionsPerPage(letters, digits, 3);
  }

  get questionCount(): number {
    return this.exam.filter((d) => d.type === objectType.QUESTION).length;
  }

  get passageCount(): number {
    return this.exam.filter((d) => d.type === objectType.PASSAGE).length;
  }

  /** Pruebas ICFES presentes en la selección (para el resumen). */
  get testsInExam(): string[] {
    const present = new Set(this.exam.map((d) => d.test).filter(Boolean));
    return SABER11_TESTS.filter((t) => present.has(t.id)).map((t) => t.shortLabel);
  }

  get identification(): IdentificationMode {
    return this.examConfigForm?.value?.identification ?? "generic";
  }

  get selectedGroupIds(): string[] {
    return this.examConfigForm?.value?.groupIds ?? [];
  }

  studentsIn(groupId: string): number {
    return this.students.filter((s) => s.groupId === groupId).length;
  }

  /** Estudiantes que recibirán hoja personalizada. */
  get rosterStudents(): Student[] {
    const groups = new Set(this.selectedGroupIds);
    return this.students.filter((s) => s.groupId && groups.has(s.groupId));
  }

  get versions(): number {
    return Math.max(1, Math.min(30, Math.floor(Number(this.amount) || 1)));
  }

  /** Lo que se va a generar, en palabras (pie del diálogo). */
  get outputSummary(): string {
    const forms = this.versions === 1 ? "1 cuadernillo" : `${this.versions} cuadernillos (formas ${ALPHABET.slice(0, this.versions).join(", ")})`;
    if (this.identification === "personalized") {
      const spare = Math.max(0, Math.floor(Number(this.examConfigForm.value.spareSheets) || 0)) * this.versions;
      return `${forms} + ${this.rosterStudents.length} hojas con nombre${spare ? ` + ${spare} de reserva` : ""}`;
    }
    return `${forms}, cada uno con su hoja de respuestas`;
  }

  /** Motivo por el que no se puede generar todavía (null = todo bien). */
  get blockingReason(): string | null {
    if (this.questionCount === 0) return "El examen no tiene preguntas.";
    if (this.examConfigForm.value.headerType === "text" && !this.examConfigForm.value.title?.trim()) {
      return "Escribe el título del examen.";
    }
    if (this.identification === "personalized") {
      if (this.selectedGroupIds.length === 0) return "Elige los grupos que presentan el examen.";
      if (this.rosterStudents.length === 0) return "Los grupos elegidos no tienen estudiantes cargados.";
    }
    return null;
  }

  setIdentification(mode: IdentificationMode): void {
    this.examConfigForm.patchValue({ identification: mode });
  }

  /** Preguntas seleccionadas sin alinear a prueba ICFES (aviso en simulacros). */
  get unalignedCount(): number {
    return this.exam.filter((d) => d.type === objectType.QUESTION && !d.test).length;
  }

  /** Ítems de IA aún no revisados por un docente. */
  get unreviewedAiCount(): number {
    return this.exam.filter((d) => d.source === "ai" && d.reviewed === false).length;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async generate() {
    const reason = this.blockingReason;
    if (reason) {
      this.toast.warning(reason, "ExamHub", 3500);
      return;
    }
    const ok = await this.generatePDF(this.examConfigForm.value, this.amount, true);
    if (ok) this.dialogRef.close();
  }

  /** Vista previa: forma A con su hoja (no guarda nada). */
  async preview() {
    if (this.questionCount === 0) {
      this.toast.warning("El examen no tiene preguntas.", "ExamHub", 3000);
      return;
    }
    await this.generatePDF(this.examConfigForm.value, 1, false);
  }
  getBase64ImageFromURL(url: any) {
    return new Promise((resolve, reject) => {
      var img = new Image();
      img.setAttribute("crossOrigin", "anonymous");

      img.onload = () => {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        var ctx = canvas.getContext("2d");
        ctx!.drawImage(img, 0, 0);

        var dataURL = canvas.toDataURL("image/png");

        resolve(dataURL);
      };

      img.onerror = (error) => {
        reject(error);
      };

      img.src = url;
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        this.logoBase64 = reader.result;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  /**
   * Genera las formas, guarda la evaluación (si `persist`) y produce
   * los PDF. La evaluación se guarda ANTES de entregar los PDF: así
   * ningún QR impreso apunta a una evaluación inexistente.
   *
   * Devuelve false si no se pudo completar.
   */
  async generatePDF(config: any, amount: number, persist: boolean): Promise<boolean> {
    if (this.isGenerating) return false;
    const questions = this.exam.filter((d) => d.type === objectType.QUESTION);
    if (questions.length === 0) {
      this.toast.warning("El examen no tiene preguntas.", "ExamHub", 3000);
      return false;
    }
    this.isGenerating = true;
    try {
      const orgId = await this.tenant.requireOrgId();
      const assessmentId = uuidv4();
      const versions = Math.max(1, Math.min(30, Math.floor(Number(amount) || 1)));
      const letterCount = this.letterCountFor(this.exam);
      const mode: IdentificationMode = config.identification ?? "generic";
      const codeDigits =
        mode === "code" ? Math.min(10, Math.max(1, Math.floor(Number(config.codeDigits) || 6))) : 0;
      const title = (config.title || "Evaluación").trim();
      const header = await this.buildHeader(config);

      const built: { form: BuiltForm; def: FormDef }[] = [];
      for (let i = 0; i < versions; i++) {
        const seed = randomSeed();
        const form = buildForm(this.exam, {
          seed,
          maxQuestions: this.amountQuestions,
          groupByTest: !!config.simulacro,
        });
        built.push({
          form,
          def: { id: `v${i + 1}`, label: formLabel(i + 1), seed, key: form.key },
        });
      }
      const forms = built.map((b) => b.def);
      const sheetCtx: SheetsContext = {
        orgId,
        assessmentId,
        title,
        forms,
        letterCount,
        codeDigits,
        geometry: 3,
        balanced: true,
      };
      const totalPages = Math.max(
        ...built.map(
          ({ form }) =>
            computeSheetLayout({
              questionLetters: form.questions.map((q) => this.lettersFor(q)),
              letterCount,
              codeDigits,
              balanced: true,
              geometry: 3,
            }).pages.length
        )
      );

      // Listado con la forma de cada estudiante (hojas personalizadas).
      const groupOrder = this.groups
        .filter((g) => (config.groupIds ?? []).includes(g.id))
        .map((g) => g.id);
      const roster: RosterEntry[] =
        mode === "personalized"
          ? assignForms(this.rosterStudents, groupOrder, forms.map((f) => f.id))
          : [];
      if (persist && mode === "personalized" && roster.length === 0) {
        this.toast.warning("Los grupos elegidos no tienen estudiantes cargados.", "ExamHub", 4000);
        return false;
      }

      if (persist) {
        try {
          await this.gradingService.saveAssessment(
            {
              id: assessmentId,
              title,
              type: config.simulacro ? "simulacro" : "quiz",
              taxonomyId: "saber11",
              groupIds: config.groupIds ?? [],
              totalQuestions: Math.max(...forms.map((f) => f.key.length)),
              letters: ALPHABET.slice(0, letterCount),
              sheet: { version: 3, letterCount, codeDigits, totalPages, balanced: true },
              forms,
              maxScore: Number(config.maxScore) || DEFAULT_ORG_SETTINGS.maxScore,
              identification: mode,
              ...(roster.length ? { roster } : {}),
              ...(config.subtitle ? { subject: config.subtitle } : {}),
              ...(config.grade ? { grade: config.grade } : {}),
            },
            questions
          );
        } catch (err) {
          console.error("No se pudo guardar la evaluación:", err);
          this.toast.danger(
            "No pudimos guardar la evaluación para calificarla. Revisa tu conexión y reintenta.",
            "ExamHub",
            5000
          );
          return false;
        }
      }

      const groupName = (id: string | null) => this.groups.find((g) => g.id === id)?.name;
      const dateText = config.date ? formatDate(config.date) : "_________";
      const files: { def: any; name: string }[] = [];

      for (const { form, def } of built) {
        // Hoja del estudiante dentro del cuadernillo: solo en hojas
        // genéricas o con código. En la vista previa con hojas
        // personalizadas se muestra la del primer estudiante de la forma.
        const sample = roster.find((r) => r.formId === def.id);
        const inlineSheet: SheetRequest[] =
          mode !== "personalized"
            ? [{ formId: def.id }]
            : !persist
            ? [sample ? { formId: def.id, studentId: sample.studentId, name: sample.name, groupName: groupName(sample.groupId) } : { formId: def.id }]
            : [];
        const withPageBreak = (nodes: any[]) => (nodes.length ? [{ text: "", pageBreak: "before" }, ...nodes] : []);

        files.push({
          name: `${title} - Forma ${def.label}`,
          def: {
            pageMargins: this.bodyGeometry(config).pageMargins,
            header,
            info: { title: `${title} — Forma ${def.label}`, author: "ExamHub" },
            content: [
              {
                text: `Nombre: _______________________________   Fecha: ${dateText}   Grado: ${config.grade || "____"}   Forma: ${def.label}`,
                alignment: "center",
                margin: [0, 0, 0, 10],
              },
              await this.buildExamBody(form.sequence, config),
              ...withPageBreak(buildSheetsContent(sheetCtx, inlineSheet)),
              ...(config.includeTeacherKey
                ? withPageBreak(buildSheetsContent(sheetCtx, [{ formId: def.id, withKey: true }]))
                : []),
            ],
          },
        });
      }

      if (persist && mode === "personalized") {
        const spares = Math.max(0, Math.min(50, Math.floor(Number(config.spareSheets) || 0)));
        const requests: SheetRequest[] = [
          ...roster.map((r) => ({
            formId: r.formId,
            studentId: r.studentId,
            name: r.name,
            groupName: groupName(r.groupId),
          })),
          ...forms.flatMap((f) => Array.from({ length: spares }, () => ({ formId: f.id }))),
        ];
        files.push({ name: `${title} - Hojas de respuesta`, def: sheetsDocument(sheetCtx, requests) });
      }

      if (files.length === 1) {
        this.pdfService.open(files[0].def);
      } else {
        await this.pdfService.downloadZip(files, title.replace(/[/\\?%*:|"<>]/g, "-"));
      }
      if (persist) {
        this.toast.success(
          mode === "personalized"
            ? `Evaluación guardada. Imprime los cuadernillos y las ${roster.length} hojas con nombre.`
            : "Evaluación guardada. Ya puedes calificarla desde Calificar.",
          "ExamHub",
          4500
        );
      }
      return true;
    } catch (err) {
      console.error("Error generando el examen:", err);
      this.toast.danger("No pudimos generar el examen.", "ExamHub", 4000);
      return false;
    } finally {
      this.isGenerating = false;
    }
  }

  /** Burbujas de una pregunta en la hoja (0 = sin burbujas). */
  private lettersFor(q: Document): number {
    if (!hasBubbles(q)) return 0;
    return getQuestionKind(q) === QuestionKind.TRUE_FALSE ? 2 : q.options?.length ?? 0;
  }

  /** Letras del examen = máximo de opciones entre preguntas con burbujas. */
  private letterCountFor(items: Document[]): number {
    return Math.min(
      ALPHABET.length,
      Math.max(
        2,
        ...items
          .filter((d) => d.type === objectType.QUESTION)
          .map((q) => this.lettersFor(q))
      )
    );
  }

  private async buildHeader(config: any): Promise<any> {
    if (config.headerType === "image") {
      return {
        image: await this.getBase64ImageFromURL(this.logoBase64 ?? "assets/headerexamhub.webp"),
        opacity: 1,
        width: 580,
        alignment: "center",
      };
    }
    return {
      margin: 10,
      columns: [
        {
          image: await this.getBase64ImageFromURL(this.logoBase64 ?? "assets/logoexamhub.webp"),
          opacity: 0.5,
          width: 80,
        },
        [
          { text: config.institution, alignment: "center", fontSize: 18, bold: true },
          { text: config.title, alignment: "center", fontSize: 16, bold: true },
          { text: config.place, alignment: "center", fontSize: 12, bold: false },
          { text: config.subtitle, style: "subtitle", alignment: "center", fontSize: 11, bold: false },
        ],
      ],
    };
  }

  /**
   * Cuerpo del cuadernillo para pdfmake.
   *
   *   - Numeración continua (las lecturas no se numeran).
   *   - Simulacro: título de prueba ANTES de la lectura o pregunta que
   *     abre cada prueba.
   *   - 1 columna: flujo normal; ninguna pregunta se parte entre páginas.
   *   - 2 columnas: reparto tipo periódico con alturas estimadas
   *     (domain/columnPacking.ts); lecturas largas a ancho completo.
   */
  private async buildExamBody(exam: Document[], config: any): Promise<any> {
    const is2Col = config.layout === "2col";
    const geo = this.bodyGeometry(config);
    const fullW = geo.usableWidth;
    const colW = is2Col ? (fullW - geo.columnGap) / 2 : fullW;
    const enuncFontSize = is2Col ? 10 : 11.5;
    const optFontSize = is2Col ? 9.5 : 11;
    const numberColWidth = is2Col ? 18 : 22;
    const optionLetterWidth = is2Col ? 13 : 16;
    const spacing = Number(config.questionSpacing ?? 10);
    const stemW = colW - numberColWidth - 4;
    const optW = stemW - optionLetterWidth - 2;

    type Block = PackBlock & {
      build: (wide: boolean) => any;
    };
    const blocks: Block[] = [];
    let qNumber = 0;
    let currentTest: string | undefined;

    const sectionHeader = (testId: string): Block => {
      const node = {
        text: (getTest(testId)?.label ?? testId).toUpperCase(),
        bold: true,
        fontSize: enuncFontSize + 1,
        color: "#3730a3",
        margin: [0, 4, 0, 6],
      };
      return {
        height: (enuncFontSize + 1) * LINE_HEIGHT + 10,
        keepWithNext: true,
        build: () => node,
      };
    };

    for (let idx = 0; idx < exam.length; idx++) {
      const item = exam[idx];

      // Título de prueba antes del bloque que la abre (lectura o pregunta).
      const blockTest =
        item.type === objectType.PASSAGE
          ? exam.slice(idx + 1).find((d) => d.type === objectType.QUESTION)?.test
          : item.test;
      if (config.simulacro && blockTest && blockTest !== currentTest) {
        currentTest = blockTest;
        blocks.push(sectionHeader(blockTest));
      }

      if (item.type === objectType.PASSAGE) {
        const text = item.passageText ?? "";
        const titleH = (enuncFontSize + 1) * LINE_HEIGHT + 3;
        const makeNode = async (width: number) => {
          const body = await textToPdfNode(text, width, enuncFontSize);
          if (!body.image) {
            Object.assign(body, { color: "#1f2937", fontSize: enuncFontSize, alignment: "justify" });
          }
          return {
            stack: [
              { text: item.name, bold: true, fontSize: enuncFontSize + 1, color: "#92400e", margin: [0, 0, 0, 3] },
              body,
            ],
            margin: [0, 4, 0, 8],
          };
        };
        const colNode = await makeNode(colW);
        const wideNode = is2Col ? await makeNode(fullW) : colNode;
        const bodyH = (node: any, width: number) =>
          node.stack[1].image ? node.stack[1].height ?? 0 : estimateTextHeight(text, width, enuncFontSize);
        blocks.push({
          height: titleH + bodyH(colNode, colW) + 12,
          fullHeight: titleH + bodyH(wideNode, fullW) + 12,
          keepWithNext: true,
          build: (wide) => (wide ? wideNode : colNode),
        });
        continue;
      }

      // ----- Pregunta -----
      qNumber++;
      const kind = getQuestionKind(item);
      const hasOptions =
        kind === QuestionKind.MULTIPLE_CHOICE_SINGLE || kind === QuestionKind.TRUE_FALSE;

      const stemNode = await textToPdfNode(item.name, stemW, enuncFontSize, true);
      if (!stemNode.image) Object.assign(stemNode, { bold: true, fontSize: enuncFontSize });
      let height = stemNode.image
        ? stemNode.height ?? 0
        : estimateTextHeight(item.name, stemW, enuncFontSize, true);

      const subBlocks: any[] = [];
      if (hasOptions && item.options) {
        for (let i = 0; i < item.options.length; i++) {
          const opt = item.options[i];
          const optNode = await textToPdfNode(opt.content, optW, optFontSize);
          if (!optNode.image) optNode.fontSize = optFontSize;
          height +=
            (optNode.image ? optNode.height ?? optFontSize * LINE_HEIGHT : estimateTextHeight(opt.content, optW, optFontSize)) + 2;
          subBlocks.push({
            columns: [
              { text: `${ALPHABET[i]}.`, width: optionLetterWidth, fontSize: optFontSize },
              optNode,
            ],
            columnGap: 2,
            margin: [0, 1, 0, 1],
          });
        }
        height += 3;
      } else if (kind === QuestionKind.OPEN) {
        const lineCount = is2Col ? 4 : 6;
        for (let i = 0; i < lineCount; i++) {
          subBlocks.push({
            canvas: [{ type: "line", x1: 0, y1: 0, x2: stemW, y2: 0, lineWidth: 0.5, lineColor: "#9ca3af" }],
            margin: [0, 16, 0, 0],
          });
        }
        height += lineCount * 16 + 4;
      } else if (kind === QuestionKind.NUMERIC) {
        subBlocks.push({ text: "Respuesta: ______________________", margin: [0, 4, 0, 0], fontSize: optFontSize });
        height += optFontSize * LINE_HEIGHT + 4;
      }

      const node = {
        columns: [
          { text: `${qNumber}.`, width: numberColWidth, bold: true, fontSize: enuncFontSize },
          { stack: [{ ...stemNode, margin: [0, 0, 0, 3] }, ...subBlocks], width: "*" },
        ],
        columnGap: 4,
        margin: [0, 0, 0, spacing],
        unbreakable: true,
      };
      blocks.push({ height: height + spacing + 3, build: () => node });
    }

    if (!is2Col) return { stack: blocks.map((b) => b.build(false)) };

    // Margen de seguridad: la estimación nunca es exacta.
    const safety = 0.95;
    const segments = packColumns(blocks, {
      firstPageHeight: (geo.pageContentHeight - geo.firstPageOffset) * safety,
      pageHeight: geo.pageContentHeight * safety,
    });
    return {
      stack: segments.map((seg) =>
        seg.kind === "full"
          ? { ...blocks[seg.index].build(true), ...(seg.newPage ? { pageBreak: "before" } : {}) }
          : {
              columns: [
                { stack: seg.left.map((i) => blocks[i].build(false)), width: "*" },
                { stack: seg.right.map((i) => blocks[i].build(false)), width: "*" },
              ],
              columnGap: geo.columnGap,
              ...(seg.newPage ? { pageBreak: "before" } : {}),
            }
      ),
    };
  }

  /** Márgenes y alturas útiles del cuadernillo (A4 en pt). */
  private bodyGeometry(config: any) {
    const top = config.headerType === "image" ? 130 : 112;
    const bottom = 50;
    return {
      pageMargins: [40, top, 40, bottom] as [number, number, number, number],
      usableWidth: 595 - 80,
      columnGap: 18,
      pageContentHeight: 842 - top - bottom,
      /** Línea de Nombre/Fecha/Grado al inicio de la primera página. */
      firstPageOffset: 28,
    };
  }
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-07" → "7/10/2026" sin desfase de zona horaria. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
