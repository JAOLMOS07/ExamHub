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
import { FormDef } from "../../../core/models/assessment.model";
import { DEFAULT_ORG_SETTINGS, Group } from "../../../core/models/org.model";
import { ALPHABET } from "../../../core/utils/alphabet.const";
import { encodeQrPayload } from "../../../core/utils/qrPayload.util";
import { randomSeed } from "../../../core/domain/rng";
import { BuiltForm, buildForm, formLabel, hasBubbles } from "../../../core/domain/formBuilder";
import { computeSheetLayout, questionsPerPage } from "../../../core/domain/answerSheetLayout";
import { getTest } from "../../../core/domain/taxonomy/saber11";
import { buildAnswerSheetPage } from "./answer-sheet.pdf";
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
      institution: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(40),
        ],
      ],
      title: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(46),
        ],
      ],
      place: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(61),
        ],
      ],
      subtitle: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(65),
        ],
      ],
      date: [new Date()],
      grade: [""],
      amount: [4, Validators.required],
      /**
       * Layout del cuerpo del examen.
       *   '1col' — clásico, una columna a página completa.
       *   '2col' — dos columnas para ahorrar páginas (ideal para
       *           exámenes con preguntas cortas tipo elección
       *           múltiple). El encabezado y la hoja de respuestas
       *           siguen a ancho completo.
       */
      layout: ["1col", Validators.required],
      /** Espaciado vertical entre preguntas en pt. */
      questionSpacing: [10],
      /**
       * Incluir o no la HOJA DE RESPUESTAS DEL MAESTRO (la clave con las
       * burbujas correctas rellenas) al final del PDF.
       *   true  — se imprime la clave del maestro (comportamiento previo).
       *   false — solo va la hoja del alumno (vacía, con QR). La
       *           calificación automática sigue funcionando porque el
       *           escáner usa la hoja del alumno, no la del maestro.
       */
      includeTeacherKey: [true],
      /** Simulacro: agrupa por prueba ICFES y reporta puntaje global. */
      simulacro: [false],
      /** Dígitos del código del estudiante en burbujas (0 = sin código). */
      codeDigits: [DEFAULT_ORG_SETTINGS.studentCodeDigits],
      /** Grupos a los que se aplica. */
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
      this.orgService.groups$().subscribe((g) => (this.groups = g.filter((x) => x.year === year)))
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

  /** ¿Cuántas preguntas por hoja de respuestas con la configuración actual? */
  get sheetCapacity(): number {
    const letters = this.letterCountFor(this.exam);
    return questionsPerPage(letters, Number(this.examConfigForm?.value?.codeDigits) || 0);
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
    if (
      this.examConfigForm.valid ||
      this.examConfigForm.value.headerType === "image"
    ) {
      const config = this.examConfigForm.value;
      const ok = await this.generatePDF(config, this.amount, true);
      if (ok) this.dialogRef.close();
    } else {
      this.toast.danger("Hay campos requeridos", "ExamHub", 3000);
    }
  }
  async preview() {
    if (
      this.examConfigForm.valid ||
      this.examConfigForm.value.headerType === "image"
    ) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, 1, false);
    } else {
      this.toast.danger("Hay campos requeridos", "ExamHub", 3000);
    }
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
      const codeDigits = Math.min(10, Math.max(0, Math.floor(Number(config.codeDigits) || 0)));
      const title = config.title || "Evaluación";
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
      const layouts = built.map(({ form }) =>
        computeSheetLayout({
          questionLetters: form.questions.map((q) => this.lettersFor(q)),
          letterCount,
          codeDigits,
          balanced: true,
        })
      );
      const totalPages = Math.max(...layouts.map((l) => l.pages.length));

      if (persist) {
        try {
          await this.gradingService.saveAssessment(
            {
              id: assessmentId,
              title,
              type: config.simulacro ? "simulacro" : "quiz",
              taxonomyId: "saber11",
              groupIds: config.groupIds ?? [],
              totalQuestions: Math.max(...built.map((b) => b.def.key.length)),
              letters: ALPHABET.slice(0, letterCount),
              sheet: { version: 2, letterCount, codeDigits, totalPages, balanced: true },
              forms: built.map((b) => b.def),
              maxScore: Number(config.maxScore) || DEFAULT_ORG_SETTINGS.maxScore,
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

      const pdfDefs: { def: any; name: string }[] = [];
      for (let i = 0; i < built.length; i++) {
        const { form, def } = built[i];
        const layout = layouts[i];
        const sheetNodes = (key?: typeof def.key) =>
          layout.pages.flatMap((page) => [
            { text: "", pageBreak: "before" },
            ...buildAnswerSheetPage(page, {
              title,
              formLabel: def.label,
              key,
              qrPayload: encodeQrPayload({
                orgId,
                examId: assessmentId,
                versionId: def.id,
                page: page.page,
                totalPages: page.totalPages,
              }),
            }),
          ]);

        const docDefinition: any = {
          margin: 10,
          pageMargins: this.bodyGeometry(config).pageMargins,
          header,
          content: [
            {
              text: `Nombre: _________________________________    Fecha: ${
                config.date ? config.date.toLocaleDateString() : " _________ "
              }   Grado:${config.grade !== "" ? config.grade : " ___ "}   Forma: ${def.label}`,
              style: "subtitle",
              alignment: "center",
              margin: [0, 0, 0, 10],
            },
            await this.buildExamBody(form.sequence, config),
            ...sheetNodes(),
            ...(config.includeTeacherKey ? sheetNodes(def.key) : []),
          ],
          styles: {
            questionHeader: { fontSize: 12, bold: true },
            questionAnswer: { margin: [5, 2, 10, 20] },
          },
        };
        if (versions > 1) {
          const prefix = config.grade !== "" ? config.grade : "examen";
          pdfDefs.push({ def: docDefinition, name: `${prefix}-forma-${def.label}` });
        } else {
          this.pdfService.open(docDefinition);
        }
      }
      if (versions > 1) {
        const date = new Date();
        this.pdfService.downloadZip(
          pdfDefs,
          date.toLocaleDateString() + "_" + date.toLocaleTimeString() + "_exams"
        );
      }
      if (persist) {
        this.toast.success(
          "Evaluación guardada. Ya puedes calificarla desde Calificar.",
          "ExamHub",
          3500
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
