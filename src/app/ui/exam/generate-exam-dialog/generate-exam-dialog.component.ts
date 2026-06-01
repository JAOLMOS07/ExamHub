import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { v4 as uuidv4 } from "uuid";
import { Question } from "../../../core/models/question.model";
import { PDFService } from "../../../core/services/pdfService.service";
import { QuestionService } from "../../../core/services/questionService.service";
import {
  Document,
  Option,
  getQuestionKind,
} from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { QuestionKind } from "../../../core/models/questionKind.enum";
import { NgToastService } from "ng-angular-popup";
import { textToPdfNode } from "../../shared/math/math-pdf.helper";
import { PreferencesService } from "../../../core/services/preferences.service";
import { ExamTemplate } from "../../../core/models/preferences.model";
import { GradingService } from "../../../core/services/grading.service";
import {
  AnswerKey,
  AnswerLetter,
  GradedExam,
} from "../../../core/models/gradedExam.model";
import { ALPHABET } from "../../../core/utils/alphabet.const";
import { encodeQrPayload } from "../../../core/utils/qrPayload.util";
import {
  BUBBLE_RADIUS_PT,
  FIDUCIAL_POSITIONS,
  FIDUCIAL_SIZE_PT,
  PAGE_W_PT,
  QR_LAYOUT,
  STUDENT_INFO_Y_PT,
  TITLE_Y_PT,
  bubbleCenter,
  numberLabelX,
  rowLabelY,
} from "../../../core/utils/omrLayout.const";

@Component({
  selector: "app-generate-exam-dialog",
  templateUrl: "./generate-exam-dialog.component.html",
  styleUrls: ["./generate-exam-dialog.component.css"],
})
export class GenerateExamDialogComponent implements OnInit {
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

  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<GenerateExamDialogComponent>,
    private pdfService: PDFService,
    private questionService: QuestionService,
    private toast: NgToastService,
    private preferencesService: PreferencesService,
    private gradingService: GradingService,
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
    });

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

  cancel(): void {
    this.dialogRef.close();
  }

  async generate() {
    if (
      this.examConfigForm.valid ||
      this.examConfigForm.value.headerType === "image"
    ) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, this.amount).then(() => {
        this.dialogRef.close();
      });
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
      await this.generatePDF(config, 1);
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

  async generatePDF(config: any, amount: number) {
    // Reseteamos el conteo máximo de opciones — antes acumulaba entre
    // llamadas y la hoja de respuestas terminaba con burbujas de más
    // en la segunda generación de la sesión.
    this.greaterAmount = 0;

    // -----------------------------------------------------------------
    //  Feature de calificación automática
    // -----------------------------------------------------------------
    //  Generamos UN solo `examId` para esta tanda (todas las versiones
    //  comparten id; las distinguimos por `versionId`). Vamos llenando
    //  `versionsForFirestore` mientras armamos cada PDF, y al final
    //  persistimos el GradedExam en `/exams/{examId}` para que el
    //  scanner pueda recuperarlo por QR.
    // -----------------------------------------------------------------
    const examId = uuidv4();
    const versionsForFirestore: AnswerKey[] = [];

    let header;
    if (config.headerType === "image") {
      header = {
        image: await this.getBase64ImageFromURL(
          this.logoBase64 ?? "assets/headerexamhub.webp"
        ),
        opacity: 1,
        width: 580,
        alignment: "center",
      };
    } else {
      header = {
        margin: 10,
        columns: [
          {
            image: await this.getBase64ImageFromURL(
              this.logoBase64 ?? "assets/logoexamhub.webp"
            ),
            opacity: 0.5,
            width: 80,
          },
          [
            {
              text: config.institution,
              alignment: "center",
              fontSize: 18,
              bold: true,
            },
            {
              text: config.title,
              alignment: "center",
              fontSize: 16,
              bold: true,
            },
            {
              text: config.place,
              alignment: "center",
              fontSize: 12,
              bold: false,
            },
            {
              text: config.subtitle,
              style: "subtitle",
              alignment: "center",
              fontSize: 11,
              bold: false,
            },
          ],
        ],
      };
    }
    const pdfDefs = [];
    for (let index = 0; index < amount; index++) {
      var examToGenerate: Document[] = this.shuffleExam(this.exam);
      // Para las hojas de respuestas necesitamos SOLO las preguntas
      // (sin las lecturas), porque las lecturas no se contestan. Si
      // las dejábamos, se numeraban como pregunta extra y rompían el
      // alineamiento de las burbujas.
      const answerQuestions = examToGenerate.filter(
        (d) => d.type === objectType.QUESTION
      );

      // ---- Feature de calificación: armar AnswerKey + QR de esta versión ----
      const versionId = `v${index + 1}`;
      const versionLabel = this.getExamCode(index + 1);
      const answerKey = this.buildAnswerKeyForVersion(
        versionId,
        versionLabel,
        answerQuestions
      );
      versionsForFirestore.push(answerKey);
      const qrPayloadText = encodeQrPayload({
        examId,
        versionId,
        page: 1,
        totalPages: 1,
      });

      let docDefinition: any = {
        margin: 10,
        pageMargins: [40, 130, 40, 60],
        header: header,
        content: [
          {
            text: `Nombre: _________________________________    Fecha: ${
              config.date ? config.date.toLocaleDateString() : " _________ "
            }   Grado:${
              config.grade !== "" ? config.grade : " ___ "
            }   Examen: ${this.getExamCode(index + 1)}`,
            style: "subtitle",
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          await this.buildExamBody(examToGenerate, config),
          { text: "", pageBreak: "before" },
          // ============== HOJA DE RESPUESTAS DEL ALUMNO ================
          // Layout OMR-friendly (posiciones absolutas conocidas).
          // El motor OMR usa las mismas constantes (`omrLayout.const.ts`)
          // para muestrear, así que el alineamiento es exacto.
          // -------------------------------------------------------------
          ...(await this.buildOmrAnswerSheet(
            answerQuestions,
            this.getExamCode(index + 1),
            qrPayloadText,
            false
          )),
          { text: "", pageBreak: "before" },
          // ============== HOJA DE RESPUESTAS DEL MAESTRO ===============
          // Mismo layout exacto que la del alumno — solo cambia que la
          // burbuja correcta de cada pregunta aparece rellena con
          // `assets/relleno.png`. Así el maestro corrige a ojo en el
          // mismo formato visual que ve el alumno.
          // -------------------------------------------------------------
          ...(await this.buildOmrAnswerSheet(
            answerQuestions,
            this.getExamCode(index + 1),
            qrPayloadText,
            true
          )),
        ],

        styles: {
          questionHeader: {
            fontSize: 12,
            bold: true,
          },
          questionAnswer: {
            margin: [5, 2, 10, 20],
          },
        },
      };
      if (amount > 1) {
        let name;
        if (config.grade !== "") {
          name = config.grade + "-" + (index + 1);
        } else {
          name = "exam " + "-" + (index + 1);
        }
        pdfDefs.push({ def: docDefinition, name: name });
      } else {
        this.pdfService.open(docDefinition);
      }
    }
    if (amount > 1) {
      let date = new Date();
      this.pdfService.downloadZip(
        pdfDefs,
        date.toLocaleDateString() + "_" + date.toLocaleTimeString() + "_exams"
      );
    }

    // -----------------------------------------------------------------
    //  Persistir el examen calificable en Firestore.
    //
    //  Es un fire-and-forget: no bloqueamos el cierre del diálogo si
    //  Firestore se demora. Si falla, mostramos toast pero el PDF ya
    //  está generado (no se pierde trabajo). El profe podrá re-generar
    //  para reintentar el guardado.
    //
    //  TODO: cuando integremos Remote Config para planes, pasar el
    //  plan real del usuario. Por ahora "free" como default conservador.
    // -----------------------------------------------------------------
    if (versionsForFirestore.length > 0) {
      const totalQuestions = versionsForFirestore[0].answers.length;
      const gradedExam: Omit<
        GradedExam,
        "ownerId" | "createdAt" | "expiresAt"
      > = {
        id: examId,
        title: config.title || "Examen sin título",
        subject: config.subtitle || undefined,
        grade: config.grade || undefined,
        totalQuestions,
        letters: this.buildLetterSet(),
        versions: versionsForFirestore,
        planAtCreation: "free",
      };
      this.gradingService
        .saveExam(gradedExam, "free")
        .then(() => {
          // Silencioso en éxito: ya estamos mostrando el PDF.
          // El profe lo verá en /grade cuando vaya a calificar.
        })
        .catch((err) => {
          console.error("No se pudo guardar el examen calificable:", err);
          this.toast.danger(
            "El PDF se generó pero no pudimos guardar el examen para calificar. Reintentá generar.",
            "ExamHub",
            5000
          );
        });
    }
  }

  /**
   * Construye el set de letras válidas para este examen.
   * Usa el `greaterAmount` que se va calculando durante el render del
   * cuerpo (es el máximo número de opciones que vimos en alguna
   * pregunta MCQ). Mínimo 2 (V/F).
   */
  private buildLetterSet(): AnswerLetter[] {
    const count = Math.max(2, this.greaterAmount || 4);
    return ALPHABET.slice(0, count);
  }

  /**
   * Calcula el AnswerKey de una versión a partir de las preguntas
   * YA BARAJADAS en el orden en que se imprimieron. Para cada pregunta:
   *
   *   - MCQ / V-F: la letra de la opción con `correct: true`.
   *   - NUMERIC : `null` (lo calificaremos con regex contra la
   *               respuesta esperada en una iteración futura — para
   *               la primera versión del OMR solo MCQ).
   *   - OPEN    : `null` (se corrige a mano, no se puede automatizar).
   *
   *  Si una MCQ no tiene opción correcta (mala configuración del
   *  banco), devolvemos `null` y dejamos un warning. La pregunta no
   *  se cuenta para calificar.
   */
  private buildAnswerKeyForVersion(
    versionId: string,
    label: string,
    answerQuestions: Document[]
  ): AnswerKey {
    const answers: (AnswerLetter | null)[] = answerQuestions.map(
      (q, qIndex) => {
        const kind = getQuestionKind(q);
        if (
          kind !== QuestionKind.MULTIPLE_CHOICE_SINGLE &&
          kind !== QuestionKind.TRUE_FALSE
        ) {
          return null;
        }
        const opts = q.options ?? [];
        const correctIdx = opts.findIndex((o: Option) => o.correct === true);
        if (correctIdx < 0) {
          console.warn(
            `Pregunta ${qIndex + 1} (${q.name}) no tiene opción correcta marcada.`
          );
          return null;
        }
        return ALPHABET[correctIdx];
      }
    );
    return { versionId, label, answers };
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

  /**
   * Baraja el examen respetando los grupos lectura↔preguntas.
   *
   * Reglas:
   *   1. Las preguntas con el mismo `passageId` forman un grupo
   *      indivisible: siempre van juntas, siempre debajo de su
   *      lectura, nunca con otras preguntas en el medio.
   *   2. Las preguntas sueltas (sin passageId) son cada una su propio
   *      grupo de tamaño 1, así pueden barajarse libremente entre sí.
   *   3. Los grupos se barajan entre ellos.
   *   4. Dentro de cada grupo de lectura, las preguntas se barajan
   *      libremente. La lectura siempre va primero.
   *   5. Las opciones de cada pregunta también se barajan.
   *   6. Si una lectura no está como Document explícito pero alguna
   *      pregunta tiene `passageContext`, se sintetiza el bloque de
   *      lectura desde ese texto denormalizado.
   *   7. Se respeta `amountQuestions` contando solo QUESTION (las
   *      lecturas no consumen cupo). Los grupos se incluyen completos
   *      o no se incluyen (no se parte una lectura por la mitad).
   */
  shuffleExam(exam: Document[]): Document[] {
    // 1. Indexar lecturas explícitas y agrupar preguntas por passageId
    const explicitPassages = new Map<string, Document>();
    const groups = new Map<string, Document[]>();
    const LOOSE = "__loose__";

    for (const item of exam) {
      if (item.type === objectType.PASSAGE) {
        explicitPassages.set(item.id, item);
        continue;
      }
      if (item.type !== objectType.QUESTION) continue;

      const key = item.passageId ?? LOOSE;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    // 2. Construir chunks: cada chunk es indivisible
    const chunks: Document[][] = [];

    // 2a. Preguntas sueltas: cada una un chunk individual
    const loose = groups.get(LOOSE) ?? [];
    for (const q of loose) {
      chunks.push([this.cloneAndShuffleOptions(q)]);
    }

    // 2b. Grupos lectura↔preguntas
    for (const [key, questions] of groups.entries()) {
      if (key === LOOSE) continue;
      const passageId = key;

      // Barajar las preguntas internas y sus opciones
      const shuffledQs = this.shuffleArray(questions).map((q) =>
        this.cloneAndShuffleOptions(q)
      );

      // ¿Tenemos la lectura como Document explícito? Si no, la
      // sintetizamos a partir del passageContext denormalizado en la
      // primera pregunta del grupo.
      let passageDoc: Document | undefined = explicitPassages.get(passageId);
      if (!passageDoc) {
        const ctx = shuffledQs[0]?.passageContext;
        if (ctx) {
          passageDoc = {
            id: passageId,
            name: "Lectura",
            type: objectType.PASSAGE,
            passageText: ctx,
          } as Document;
        }
      }

      const chunk: Document[] = [];
      if (passageDoc) chunk.push({ ...passageDoc } as Document);
      chunk.push(...shuffledQs);
      chunks.push(chunk);
    }

    // 2c. Lecturas explícitas que no tienen preguntas (raro, pero
    //     puede pasar si el profe agregó solo la lectura). Las
    //     incluimos sueltas.
    for (const [pid, passage] of explicitPassages.entries()) {
      if (!groups.has(pid)) {
        chunks.push([{ ...passage } as Document]);
      }
    }

    // 3. Barajar los chunks entre sí
    const shuffledChunks = this.shuffleArray(chunks);

    // 4. Aplanar respetando el límite de cantidad de preguntas
    const result: Document[] = [];
    let count = 0;
    for (const chunk of shuffledChunks) {
      if (count >= this.amountQuestions) break;
      const qInChunk = chunk.filter(
        (d) => d.type === objectType.QUESTION
      ).length;
      // No partimos chunks de lectura: si la lectura excede el cupo,
      // saltamos al siguiente chunk en busca de uno que entre.
      if (
        count + qInChunk > this.amountQuestions &&
        chunk.some((d) => d.type === objectType.PASSAGE)
      ) {
        continue;
      }
      result.push(...chunk);
      count += qInChunk;
    }

    return result;
  }

  /** Helper: clona la pregunta y baraja sus opciones (si tiene). */
  private cloneAndShuffleOptions(q: Document): Document {
    if (q.options && q.options.length > 0) {
      return { ...q, options: this.shuffleArray(q.options) } as Document;
    }
    return { ...q } as Document;
  }

  /**
   * Fisher-Yates: cada permutación tiene la misma probabilidad.
   * No muta el arreglo de entrada.
   */
  shuffleArray<T>(array: T[]): T[] {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Construye TODOS los nodos pdfmake que forman la hoja de respuestas
   * OMR-friendly: 4 fiduciales + QR + título + datos del alumno + grid
   * fijo de burbujas.
   *
   * Esta función produce **dos versiones** según `forTeacher`:
   *   - false (alumno): todas las burbujas vacías.
   *   - true  (maestro): la burbuja correcta de cada pregunta aparece
   *                       rellena (con `assets/relleno.png`).
   *
   * Ambas versiones comparten layout EXACTO — solo cambia el contenido
   * y el título. Eso garantiza que el maestro y el alumno tengan el
   * mismo formato visual.
   *
   * Las posiciones (fiduciales, burbujas, etc) vienen de
   * `omrLayout.const.ts`, que también consume el motor OMR. Así se
   * mantiene un único origen de verdad del layout.
   *
   * Importante: usamos los PNG existentes (`assets/op[A-Z].png` y
   * `assets/relleno.png`) en vez de dibujar círculo + letra con
   * canvas. Esto da alineamiento pixel-perfecto entre el círculo y
   * su letra, sin las inconsistencias típicas de centrar texto sobre
   * canvas con métricas variables del font.
   */
  private async buildOmrAnswerSheet(
    answerQuestions: Document[],
    examCode: string,
    qrPayload: string,
    forTeacher: boolean
  ): Promise<any[]> {
    const nodes: any[] = [];
    const total = answerQuestions.length;

    // Pre-cargamos las imágenes UNA vez para reutilizarlas en todas
    // las posiciones. Mucho más rápido que await en cada bubble.
    const letterImages: Record<string, any> = {};
    const lettersNeeded = Math.max(2, this.greaterAmount);
    for (let j = 0; j < lettersNeeded; j++) {
      const letter = ALPHABET[j];
      letterImages[letter] = await this.getBase64ImageFromURL(
        `assets/op${letter}.png`
      );
    }
    const filledImage = forTeacher
      ? await this.getBase64ImageFromURL("assets/relleno.png")
      : null;

    // --- 4 fiduciales (cuadrados negros sólidos, lejos del contenido) ---
    for (const pos of [
      FIDUCIAL_POSITIONS.tl,
      FIDUCIAL_POSITIONS.tr,
      FIDUCIAL_POSITIONS.bl,
      FIDUCIAL_POSITIONS.br,
    ]) {
      nodes.push({
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: FIDUCIAL_SIZE_PT,
            h: FIDUCIAL_SIZE_PT,
            color: "#000000",
          },
        ],
        absolutePosition: { x: pos.x, y: pos.y },
      });
    }

    // --- Título centrado en la página ---
    nodes.push({
      text: forTeacher
        ? `Hoja de respuestas del maestro — Examen ${examCode}`
        : `Hoja de respuestas — Examen ${examCode}`,
      bold: true,
      fontSize: 13,
      alignment: "center",
      width: PAGE_W_PT,
      absolutePosition: { x: 0, y: TITLE_Y_PT },
    });

    // --- QR en zona dedicada (también en la del maestro, para visual
    //     consistency — el maestro lo ignora). ---
    nodes.push({
      qr: qrPayload,
      fit: QR_LAYOUT.fit,
      eccLevel: "M",
      absolutePosition: { x: QR_LAYOUT.x, y: QR_LAYOUT.y },
    });

    // --- Datos del alumno (la del maestro tiene el espacio igual,
    //     se usa para anotaciones) ---
    nodes.push({
      text: forTeacher
        ? "Clave de respuestas — usar para corrección manual o referencia"
        : "Nombre: ______________________________________   Código: __________",
      fontSize: 10,
      italics: forTeacher,
      color: forTeacher ? "#666666" : undefined,
      absolutePosition: { x: 50, y: STUDENT_INFO_Y_PT },
    });

    // --- Línea separadora ---
    nodes.push({
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 495,
          y2: 0,
          lineWidth: 0.5,
          lineColor: "#cccccc",
        },
      ],
      absolutePosition: { x: 50, y: STUDENT_INFO_Y_PT + 20 },
    });

    // --- Grid de burbujas ---
    for (let i = 0; i < total; i++) {
      const q = answerQuestions[i];
      const kind = getQuestionKind(q);
      const numLabel = (i + 1).toString().padStart(2, "0") + ".";
      const labelX = numberLabelX(i, total);
      const labelY = rowLabelY(i, total);

      // Número de pregunta
      nodes.push({
        text: numLabel,
        fontSize: 10,
        bold: forTeacher,
        absolutePosition: { x: labelX, y: labelY },
      });

      if (
        kind === QuestionKind.MULTIPLE_CHOICE_SINGLE ||
        kind === QuestionKind.TRUE_FALSE
      ) {
        const letterCount =
          kind === QuestionKind.TRUE_FALSE ? 2 : this.greaterAmount;
        for (let j = 0; j < letterCount; j++) {
          const center = bubbleCenter(i, j, total);
          // ¿En la versión del maestro, esta es la correcta?
          const isCorrect =
            forTeacher && q.options && q.options[j]?.correct === true;
          const img = isCorrect ? filledImage : letterImages[ALPHABET[j]];
          nodes.push({
            image: img,
            width: BUBBLE_RADIUS_PT * 2,
            absolutePosition: {
              x: center.x - BUBBLE_RADIUS_PT,
              y: center.y - BUBBLE_RADIUS_PT,
            },
          });
        }
      } else if (kind === QuestionKind.NUMERIC) {
        // No es OMR-able. En la del maestro mostramos la respuesta esperada.
        const txt = forTeacher
          ? `Respuesta: ${q.numericAnswer ?? "—"}${
              q.numericTolerance && q.numericTolerance > 0
                ? ` (± ${q.numericTolerance})`
                : ""
            }`
          : "Respuesta: ____________________";
        nodes.push({
          text: txt,
          fontSize: 9,
          italics: !forTeacher,
          bold: forTeacher,
          color: forTeacher ? "#000000" : "#666666",
          absolutePosition: { x: labelX + 30, y: labelY },
        });
      } else if (kind === QuestionKind.OPEN) {
        nodes.push({
          text: forTeacher
            ? "(respuesta abierta — corregir a mano)"
            : "(en el espacio de la pregunta)",
          fontSize: 9,
          italics: true,
          color: "#666666",
          absolutePosition: { x: labelX + 30, y: labelY },
        });
      }
    }

    return nodes;
  }

  /**
   * Letra para opciones de respuesta (A–Z). Solo se usa para las
   * burbujas, donde nunca hay más de 26 opciones por pregunta.
   */
  getAlphabetLetter(number: number): string {
    if (number < 1 || number > 26) {
      throw new Error("El número debe estar entre 1 y 26.");
    }
    return String.fromCharCode(65 + number - 1);
  }

  /**
   * Código del examen estilo planilla: 1→A, 2→B, …, 26→Z, 27→AA,
   * 28→AB, …, 702→ZZ, 703→AAA… Soporta cualquier cantidad de
   * versiones sin tirar excepción (bug viejo: con >26 versiones
   * la app crasheaba silenciosamente).
   */
  getExamCode(number: number): string {
    if (number < 1) {
      throw new Error("El código de examen debe ser >= 1.");
    }
    let n = number;
    let code = "";
    while (n > 0) {
      n--;
      code = String.fromCharCode(65 + (n % 26)) + code;
      n = Math.floor(n / 26);
    }
    return code;
  }
}
