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
  greaterAmount: number = 0;

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
       * Cantidad de preguntas por columna (solo aplica a layout 2col).
       * Determina el flujo: cada página tiene questionsPerColumn × 2
       * preguntas. Default 7 (= 14 por página) que aprovecha bien el
       * alto cuando son preguntas MCQ cortas. El profe baja a 4-5 si
       * tiene lecturas largas o muchas opciones; sube a 8-10 si son
       * preguntas tipo V/F muy cortas.
       *
       * LIMITACIÓN: este valor es por count, no por altura real (PDFmake
       * no permite medir antes de renderizar). Si entran más de las
       * indicadas, la columna queda con espacio en blanco; si entran
       * menos, se desbordan a la siguiente página.
       */
      questionsPerColumn: [7],
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
              sheet: { version: 2, letterCount, codeDigits, totalPages },
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
          pageMargins: [40, 130, 40, 60],
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
   * Construye el cuerpo del examen (sección de preguntas) para
   * pdfmake. Maneja:
   *   - Numeración manual continua (1, 2, 3...) saltando las lecturas.
   *   - Bloques de lectura (PASSAGE) renderizados como contexto.
   *   - Layout en 1 o 2 columnas según `config.layout`.
   *   - Tipos de pregunta: opción múltiple, V/F, abierta, numérica.
   *
   * Devuelve UN nodo pdfmake listo para meter en `content`.
   */
  private async buildExamBody(
    exam: Document[],
    config: any
  ): Promise<any> {
    const is2Col = config.layout === "2col";

    // Anchos máximos para textToPdfNode según layout. El espacio útil
    // de A4 con margen 40 es ~515pt. Para 2 columnas con gap 20:
    // (515 - 20) / 2 = ~247pt por columna; dejamos buffer.
    const enuncMaxWidth = is2Col ? 215 : 460;
    const optMaxWidth = is2Col ? 195 : 400;
    const enuncFontSize = is2Col ? 10 : 12;
    const optFontSize = is2Col ? 9 : 11;
    const numberColWidth = is2Col ? 16 : 22;
    const optionLetterWidth = is2Col ? 12 : 16;

    // weightedBlocks: cada bloque viene con un "peso" estimado en
    // unidades equivalentes a una pregunta MCQ simple (~1). Lo usamos
    // al final para hacer greedy packing en 2 columnas (sin medir
    // píxeles reales, pero compensando que las lecturas y abiertas
    // ocupan mucho más que un MCQ corto).
    const weightedBlocks: { node: any; weight: number }[] = [];
    let qNumber = 0;
    let currentTest: string | undefined;

    for (const item of exam) {
      if (item.type === objectType.PASSAGE) {
        // Bloque de lectura: título + texto. Se imprime una sola vez,
        // sin numerar, antes de sus preguntas asociadas.
        const passageBody = await textToPdfNode(
          item.passageText ?? "",
          is2Col ? 235 : 480,
          enuncFontSize
        );
        if (!passageBody.image) {
          passageBody.style = undefined;
          passageBody.color = "#1f2937";
          passageBody.fontSize = enuncFontSize;
          passageBody.alignment = "justify";
        }
        const node = {
          stack: [
            {
              text: item.name,
              bold: true,
              fontSize: enuncFontSize + 1,
              color: "#92400e",
              margin: [0, 0, 0, 3],
            },
            passageBody,
          ],
          margin: [0, 8, 0, 6],
          fillColor: "#fffbeb",
        };
        // Peso de la lectura: simple, cuenta como 1 item igual que
        // una pregunta. El profe ajusta `questionsPerColumn` si tiene
        // lecturas largas que necesitan más holgura.
        weightedBlocks.push({ node, weight: 1 });
        continue;
      }

      // ----- ES PREGUNTA -----
      // Simulacro: encabezado de sección cada vez que cambia la prueba.
      if (config.simulacro && item.test && item.test !== currentTest) {
        currentTest = item.test;
        weightedBlocks.push({
          node: {
            text: (getTest(item.test)?.label ?? item.test).toUpperCase(),
            bold: true,
            fontSize: enuncFontSize + 1,
            color: "#3730a3",
            margin: [0, 6, 0, 6],
          },
          weight: 1,
        });
      }
      qNumber++;
      const kind = getQuestionKind(item);
      const hasOptions =
        kind === QuestionKind.MULTIPLE_CHOICE_SINGLE ||
        kind === QuestionKind.TRUE_FALSE;

      if (hasOptions && item.options) {
        if (item.options.length > this.greaterAmount) {
          this.greaterAmount = item.options.length;
        }
      }

      // Enunciado (puede contener fórmulas LaTeX)
      const enunciadoNode = await textToPdfNode(
        item.name,
        enuncMaxWidth,
        enuncFontSize
      );
      if (!enunciadoNode.image) {
        enunciadoNode.bold = true;
        enunciadoNode.fontSize = enuncFontSize;
      }

      // Opciones / respuesta según tipo
      const subBlocks: any[] = [];

      if (hasOptions && item.options) {
        for (let i = 0; i < item.options.length; i++) {
          const opt = item.options[i];
          const letter = String.fromCharCode(65 + i);
          const optNode = await textToPdfNode(
            opt.content,
            optMaxWidth,
            optFontSize
          );
          if (!optNode.image) {
            optNode.fontSize = optFontSize;
          }
          subBlocks.push({
            columns: [
              {
                text: `${letter}.`,
                width: optionLetterWidth,
                fontSize: optFontSize,
                margin: [0, 0, 0, 0],
              },
              optNode,
            ],
            columnGap: 2,
            margin: [0, 1, 0, 1],
          });
        }
      } else if (kind === QuestionKind.OPEN) {
        // Menos líneas en 2cols (espacio más comprimido) para
        // evitar que la pregunta desborde la columna y genere
        // páginas fantasma. Si necesitan más espacio, el profe
        // puede agregar varias preguntas abiertas o usar 1 columna.
        const lineCount = is2Col ? 4 : 6;
        const dash = is2Col
          ? "_____________________________________________________"
          : "_______________________________________________________________________________________________";
        for (let i = 0; i < lineCount; i++) {
          subBlocks.push({
            text: dash,
            margin: [0, i === 0 ? 4 : 4, 0, 0],
            fontSize: optFontSize,
          });
        }
      } else if (kind === QuestionKind.NUMERIC) {
        subBlocks.push({
          text: "Respuesta: ______________________",
          margin: [0, 4, 0, 0],
          fontSize: optFontSize,
        });
      }

      // Componer la pregunta: número a la izquierda, contenido a la derecha
      const node = {
        columns: [
          {
            text: `${qNumber}.`,
            width: numberColWidth,
            bold: true,
            fontSize: enuncFontSize,
          },
          {
            stack: [enunciadoNode, ...subBlocks],
            width: "*",
          },
        ],
        columnGap: 4,
        margin: [0, 0, 0, config.questionSpacing ?? 10],
      };

      // Peso simple para el chunking por columnas:
      //   - OPEN (4-6 líneas en blanco): cuenta como 2 (ocupa el espacio de 2 preguntas normales).
      //   - Todo lo demás: cuenta como 1.
      // Es deliberadamente simple — un cálculo más fino dejaba más
      // espacios en blanco que este enfoque pragmático.
      const weight = kind === QuestionKind.OPEN ? 2 : 1;
      weightedBlocks.push({ node, weight });
    }

    // 1 columna: stack vertical normal
    if (!is2Col) {
      return { stack: weightedBlocks.map((b) => b.node) };
    }

    // 2 columnas: chunks por PESO acumulado.
    //
    // Cada bloque tiene un peso (1 normalmente, 2 para preguntas
    // abiertas porque ocupan ~doble por las líneas en blanco).
    // Vamos llenando chunks hasta alcanzar `perPage` unidades de peso,
    // y cerramos página. Esto evita el caso donde una pregunta abierta
    // al final desborda la columna y genera una página fantasma con
    // solo unas líneas.
    //
    // Dentro de cada chunk, dividimos por mitad de PESO (no de count)
    // para que la columna izquierda y derecha queden parejas aunque
    // haya una abierta entre medio.
    const perColumn = Math.max(1, Number(config.questionsPerColumn) || 7);
    const perPage = perColumn * 2;
    const pages: any[] = [];

    // Agrupar weightedBlocks en chunks por peso acumulado
    const chunks: { node: any; weight: number }[][] = [];
    let currentChunk: { node: any; weight: number }[] = [];
    let currentChunkWeight = 0;

    for (const wb of weightedBlocks) {
      if (
        currentChunkWeight + wb.weight > perPage &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkWeight = 0;
      }
      currentChunk.push(wb);
      currentChunkWeight += wb.weight;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    // Render de cada chunk como una página de 2 columnas
    chunks.forEach((chunk, idx) => {
      const totalWeight = chunk.reduce((sum, b) => sum + b.weight, 0);
      const halfWeight = totalWeight / 2;

      // Buscar el split point que mejor reparte peso entre izq y der
      const leftBlocks: any[] = [];
      const rightBlocks: any[] = [];
      let leftSum = 0;
      for (const wb of chunk) {
        if (leftSum + wb.weight / 2 <= halfWeight) {
          leftBlocks.push(wb.node);
          leftSum += wb.weight;
        } else {
          rightBlocks.push(wb.node);
        }
      }

      pages.push({
        columns: [
          { stack: leftBlocks, width: "*" },
          { stack: rightBlocks, width: "*" },
        ],
        columnGap: 20,
      });

      if (idx < chunks.length - 1) {
        pages.push({ text: "", pageBreak: "after" });
      }
    });

    return { stack: pages };
  }
}
