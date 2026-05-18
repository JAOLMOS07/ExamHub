import { Injectable } from "@angular/core";
import { Document, Option } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { QuestionKind } from "../models/questionKind.enum";
import { ExamService } from "./ExamService.service";

/**
 * Resultado de validar/parsear un JSON pegado por el usuario.
 */
export interface ParseResult {
  /** ¿Es válido en su forma básica? Si false, errors tiene la razón. */
  ok: boolean;
  /** Errores y warnings encontrados al validar. */
  errors: string[];
  /** Preguntas sueltas que se importarán (sin lectura asociada). */
  looseQuestions: Document[];
  /** Bloques lectura + sus preguntas hijas. */
  passages: { passage: Document; questions: Document[] }[];
}

/**
 * Servicio para importar bancos de preguntas generados por una IA
 * externa (ChatGPT, Claude, Gemini, etc.) que el profesor usa.
 *
 * Flujo:
 *   1. El profesor copia el PROMPT_TEMPLATE de acá y se lo pasa a su IA
 *      junto con su banco crudo (Word, lista, etc.).
 *   2. La IA devuelve un JSON con el formato documentado.
 *   3. El profe pega ese JSON acá; `parse()` lo valida y mapea al modelo.
 *   4. `importToFirestore()` persiste todo en una transacción lógica.
 */
@Injectable({ providedIn: "root" })
export class BankImportService {
  /**
   * Plantilla del prompt que el profesor copia y le pasa a SU IA.
   * Está diseñado para producir el JSON exacto que `parse()` espera.
   */
  static readonly PROMPT_TEMPLATE = `Quiero que conviertas un banco de preguntas al siguiente formato JSON para importarlo a ExamHub (una plataforma para profesores).

REGLAS:
- Devolveme ÚNICAMENTE el JSON. Sin markdown, sin explicaciones, sin texto antes o después.
- El JSON debe ser válido (parseable con JSON.parse).
- No inventes preguntas — usá solo las que están en mi material.
- Si una pregunta no tiene opciones claras, marcala como "open".

FORMATO ESPERADO:
{
  "questions": [
    {
      "type": "multiple-choice",        // tipos: "multiple-choice" | "true-false" | "open" | "numeric"
      "question": "Enunciado completo de la pregunta",
      "options": [                      // solo para multiple-choice y true-false
        { "text": "Texto opción A", "correct": false },
        { "text": "Texto opción B", "correct": true },
        { "text": "Texto opción C", "correct": false }
      ],
      "numericAnswer": 3.14,            // solo para "numeric"
      "numericTolerance": 0.01,         // opcional, default 0
      "subject": "Matemática",          // opcional: materia
      "grade": "6° básico",             // opcional: grado
      "difficulty": 2                   // opcional: 1=fácil, 2=media, 3=difícil
    }
  ],
  "passages": [                         // lecturas con preguntas asociadas
    {
      "title": "La Revolución Francesa",
      "text": "Texto completo de la lectura...",
      "questions": [ /* mismo formato que arriba */ ]
    }
  ]
}

REGLAS POR TIPO:
- "multiple-choice": debe tener al menos 2 opciones y EXACTAMENTE UNA con correct=true.
- "true-false": exactamente 2 opciones: una "Verdadero" y otra "Falso", con la correcta marcada.
- "open": NO incluir "options". Es respuesta abierta para corregir a mano.
- "numeric": debe tener "numericAnswer" (un número). "numericTolerance" es opcional.

INSTRUCCIONES ADICIONALES:
- Si hay un texto/lectura/contexto seguido de varias preguntas que se refieren a él, ponelos juntos en "passages".
- Si todas las preguntas son sueltas, dejá "passages" como [] y solo llená "questions".
- Inferí materia y grado si están claros en el contenido. Si no, omitilos.
- Inferí dificultad: 1 si es trivial/recordatoria, 2 si requiere aplicar, 3 si requiere análisis.

AQUÍ ESTÁ MI BANCO A CONVERTIR:
==========================================
[PEGÁ ACÁ TU BANCO]
==========================================`;

  constructor(private examService: ExamService) {}

  /**
   * Parsea y valida el JSON pegado por el usuario.
   * Devuelve un ParseResult con el contenido listo para preview o
   * con la lista de errores si algo falló.
   */
  parse(jsonText: string): ParseResult {
    const result: ParseResult = {
      ok: false,
      errors: [],
      looseQuestions: [],
      passages: [],
    };

    // 1. JSON válido
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch (e: any) {
      result.errors.push(
        `El texto pegado no es un JSON válido. La IA probablemente agregó texto antes o después. (${e.message})`
      );
      return result;
    }

    if (typeof data !== "object" || data === null) {
      result.errors.push("El JSON debe ser un objeto con 'questions' y/o 'passages'.");
      return result;
    }

    // 2. Procesar preguntas sueltas
    const rawQuestions: any[] = Array.isArray(data.questions)
      ? data.questions
      : [];
    rawQuestions.forEach((rq, i) => {
      const q = this.mapQuestion(rq, `questions[${i}]`, result.errors);
      if (q) result.looseQuestions.push(q);
    });

    // 3. Procesar lecturas (passages)
    const rawPassages: any[] = Array.isArray(data.passages)
      ? data.passages
      : [];
    rawPassages.forEach((rp, i) => {
      const passage = this.mapPassage(rp, `passages[${i}]`, result.errors);
      if (!passage) return;
      const passageQs: Document[] = [];
      const subQs: any[] = Array.isArray(rp.questions) ? rp.questions : [];
      subQs.forEach((sq, j) => {
        const q = this.mapQuestion(
          sq,
          `passages[${i}].questions[${j}]`,
          result.errors
        );
        if (!q) return;
        // Asociar la pregunta a la lectura
        q.passageId = passage.id;
        q.passageContext = passage.passageText;
        passageQs.push(q);
      });
      result.passages.push({ passage, questions: passageQs });
    });

    // Solo es ok si hay AL MENOS una pregunta o lectura válida y no
    // hay errores fatales (los warnings pueden estar pero ok=true).
    const totalQs =
      result.looseQuestions.length +
      result.passages.reduce((a, p) => a + p.questions.length, 0);
    if (totalQs === 0 && result.passages.length === 0) {
      result.errors.unshift(
        "El JSON está vacío o no contiene preguntas reconocibles."
      );
      return result;
    }
    result.ok = true;
    return result;
  }

  /**
   * Mapea un objeto JSON crudo a un Document de tipo QUESTION.
   * Devuelve null si la pregunta es inválida (se agrega un error).
   */
  private mapQuestion(
    raw: any,
    path: string,
    errors: string[]
  ): Document | null {
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${path}: no es un objeto.`);
      return null;
    }
    if (typeof raw.question !== "string" || !raw.question.trim()) {
      errors.push(`${path}: falta el campo 'question' (enunciado).`);
      return null;
    }
    const kind = this.mapKind(raw.type);
    if (!kind) {
      errors.push(
        `${path}: 'type' inválido o ausente. Esperado: multiple-choice, true-false, open, numeric.`
      );
      return null;
    }

    const doc: Document = {
      id: crypto.randomUUID(),
      name: raw.question.trim(),
      type: objectType.QUESTION,
      kind,
    } as Document;

    // Opciones (para MCQ y V/F)
    if (
      kind === QuestionKind.MULTIPLE_CHOICE_SINGLE ||
      kind === QuestionKind.TRUE_FALSE
    ) {
      if (!Array.isArray(raw.options) || raw.options.length < 2) {
        errors.push(
          `${path}: las preguntas de tipo '${raw.type}' necesitan al menos 2 'options'.`
        );
        return null;
      }
      const opts: Option[] = raw.options.map(
        (o: any) =>
          new Option(
            crypto.randomUUID(),
            String(o?.text ?? "").trim(),
            !!o?.correct
          )
      );
      const correctCount = opts.filter((o) => o.correct).length;
      if (kind === QuestionKind.MULTIPLE_CHOICE_SINGLE && correctCount !== 1) {
        errors.push(
          `${path}: 'multiple-choice' debe tener exactamente UNA opción correcta (encontradas: ${correctCount}).`
        );
        return null;
      }
      if (kind === QuestionKind.TRUE_FALSE && correctCount !== 1) {
        errors.push(
          `${path}: 'true-false' debe tener exactamente UNA opción marcada como correcta.`
        );
        return null;
      }
      doc.options = opts;
    }

    // Numérica
    if (kind === QuestionKind.NUMERIC) {
      const n = Number(raw.numericAnswer);
      if (isNaN(n)) {
        errors.push(
          `${path}: 'numeric' necesita 'numericAnswer' (un número).`
        );
        return null;
      }
      doc.numericAnswer = n;
      const tol = Number(raw.numericTolerance ?? 0);
      doc.numericTolerance = isNaN(tol) || tol < 0 ? 0 : tol;
    }

    // Metadata opcional
    if (typeof raw.subject === "string" && raw.subject.trim()) {
      doc.subject = raw.subject.trim();
    }
    if (typeof raw.grade === "string" && raw.grade.trim()) {
      doc.grade = raw.grade.trim();
    }
    if (typeof raw.difficulty === "number" && [1, 2, 3].includes(raw.difficulty)) {
      doc.difficulty = raw.difficulty;
    }

    return doc;
  }

  /** Convierte 'multiple-choice' a QuestionKind, etc. */
  private mapKind(type: any): QuestionKind | null {
    switch (type) {
      case "multiple-choice":
        return QuestionKind.MULTIPLE_CHOICE_SINGLE;
      case "true-false":
        return QuestionKind.TRUE_FALSE;
      case "open":
        return QuestionKind.OPEN;
      case "numeric":
        return QuestionKind.NUMERIC;
      default:
        return null;
    }
  }

  /** Mapea un passage del JSON a un Document tipo PASSAGE. */
  private mapPassage(
    raw: any,
    path: string,
    errors: string[]
  ): Document | null {
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${path}: no es un objeto.`);
      return null;
    }
    const title = String(raw.title ?? "Lectura").trim();
    const text = String(raw.text ?? "").trim();
    if (!text) {
      errors.push(`${path}: la lectura no tiene 'text' (cuerpo).`);
      return null;
    }
    return {
      id: crypto.randomUUID(),
      name: title || "Lectura sin título",
      type: objectType.PASSAGE,
      passageText: text,
      content: [],
    } as Document;
  }

  /**
   * Persiste el resultado en Firestore bajo el path indicado.
   *
   * Inserciones:
   *   - looseQuestions → cada una se crea en `path`.
   *   - passages → la lectura se crea en `path` y cada pregunta hija
   *     se crea en `path + passage.id`.
   *
   * Se ejecuta secuencialmente para mantener el orden visual.
   */
  async importToFirestore(
    result: ParseResult,
    path: string[]
  ): Promise<{ insertedQuestions: number; insertedPassages: number }> {
    let insertedQuestions = 0;
    let insertedPassages = 0;

    // 1. Preguntas sueltas
    for (const q of result.looseQuestions) {
      await this.examService.createDocument(path, q);
      insertedQuestions++;
    }

    // 2. Lecturas + sus preguntas hijas
    for (const block of result.passages) {
      await this.examService.createDocument(path, block.passage);
      insertedPassages++;
      const childPath = [...path, block.passage.id];
      for (const q of block.questions) {
        await this.examService.createDocument(childPath, q);
        insertedQuestions++;
      }
    }

    return { insertedQuestions, insertedPassages };
  }
}
