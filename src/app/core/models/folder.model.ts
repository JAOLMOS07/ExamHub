import { objectType } from "./objectType.enum";
import { QuestionKind } from "./questionKind.enum";

/**
 * Nodo del banco — puede ser una CARPETA o una PREGUNTA.
 *
 * Para preguntas, `kind` indica el tipo. Si `kind` está ausente
 * (preguntas creadas en v1) se asume MULTIPLE_CHOICE_SINGLE para
 * retro-compatibilidad.
 *
 * Campos específicos por tipo:
 *   - MULTIPLE_CHOICE_SINGLE: usa `options` con una sola `correct: true`.
 *   - TRUE_FALSE:             usa `options` con exactamente dos: V y F.
 *   - OPEN:                   no usa `options`. Se corrige a mano.
 *   - NUMERIC:                usa `numericAnswer` + `numericTolerance`.
 */
export class Document {
  id: string;
  name: string;
  type: objectType;
  content?: Document[];
  options?: Option[];

  /** Solo presente si type === QUESTION. */
  kind?: QuestionKind;
  /** Respuesta esperada para preguntas numéricas. */
  numericAnswer?: number;
  /** Tolerancia ± aceptada (en valor absoluto). 0 = exacta. */
  numericTolerance?: number;

  /**
   * Texto introductorio para nodos tipo PASSAGE (lecturas).
   * Se renderiza en el PDF como bloque antes de las preguntas hijas.
   */
  passageText?: string;

  /**
   * Para preguntas hijas de una lectura: id de la lectura padre.
   * Permite que una pregunta "sepa" a qué lectura pertenece sin
   * necesidad de cargar el banco completo. Si dos preguntas tienen
   * el mismo passageId, comparten el mismo bloque de contexto en el
   * examen y se renderizan juntas, debajo de la lectura, sin mezclarse
   * con preguntas de otros contextos.
   */
  passageId?: string;

  /**
   * Texto del contexto/lectura DENORMALIZADO en la pregunta hija.
   * Lo guardamos copiado en la pregunta para que el generador del
   * examen pueda imprimir el bloque de lectura aunque el Document de
   * la lectura no esté explícitamente en el examen actual (solo se
   * seleccionaron algunas preguntas). Si la lectura se edita después,
   * las preguntas ya creadas conservan el texto viejo — limitación
   * conocida; en v2 podemos resolver con sincronización en cascada.
   */
  passageContext?: string;

  /**
   * URL pública (descargable con autenticación) de la imagen adjunta
   * a la pregunta. Sirve para diagramas, mapas, fotos de fenómenos,
   * gráficos, etc. Una imagen por pregunta en v1.
   */
  imageUrl?: string;

  /**
   * Path interno de la imagen en Firebase Storage. Lo necesitamos
   * para poder BORRARLA cuando se elimina la pregunta o se reemplaza
   * la imagen. La `imageUrl` por sí sola no permite eliminar el
   * archivo subyacente.
   */
  imagePath?: string;

  /** Materia/área de la pregunta. Texto libre con autocompletar
   *  basado en lo ya usado en el banco. Ej: "Matemática", "Sociales". */
  subject?: string;

  /** Grado/curso al que está dirigida la pregunta. Ej: "6°", "Primero medio". */
  grade?: string;

  /** Nivel de dificultad (1=fácil, 2=media, 3=difícil). Se persiste
   *  como número para facilitar filtros y ordenamientos. */
  difficulty?: number;

  constructor(
    id: string,
    name: string,
    type: objectType,
    content?: Document[],
    options?: Option[],
    kind?: QuestionKind,
    numericAnswer?: number,
    numericTolerance?: number,
    passageText?: string,
    passageId?: string,
    passageContext?: string,
    imageUrl?: string,
    imagePath?: string,
    subject?: string,
    grade?: string,
    difficulty?: number
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.content = content;
    this.options = options;
    this.kind = kind;
    this.numericAnswer = numericAnswer;
    this.numericTolerance = numericTolerance;
    this.passageText = passageText;
    this.passageId = passageId;
    this.passageContext = passageContext;
    this.imageUrl = imageUrl;
    this.imagePath = imagePath;
    this.subject = subject;
    this.grade = grade;
    this.difficulty = difficulty;
  }

  static toPlainObject(doc: Document): any {
    const plainObject: any = {
      id: doc.id,
      name: doc.name,
      type: doc.type,
    };

    if (doc.content) {
      plainObject.content = doc.content.map((c) => Document.toPlainObject(c));
    }

    if (doc.options) {
      plainObject.options = doc.options.map((o) => Option.toPlainObject(o));
    }

    // Solo persistimos los campos nuevos cuando tienen valor — Firestore
    // se queja si guardamos `undefined`.
    if (doc.kind) {
      plainObject.kind = doc.kind;
    }
    if (doc.numericAnswer !== undefined && doc.numericAnswer !== null) {
      plainObject.numericAnswer = doc.numericAnswer;
    }
    if (doc.numericTolerance !== undefined && doc.numericTolerance !== null) {
      plainObject.numericTolerance = doc.numericTolerance;
    }
    if (doc.passageText) {
      plainObject.passageText = doc.passageText;
    }
    if (doc.passageId) {
      plainObject.passageId = doc.passageId;
    }
    if (doc.passageContext) {
      plainObject.passageContext = doc.passageContext;
    }
    if (doc.imageUrl) {
      plainObject.imageUrl = doc.imageUrl;
    }
    if (doc.imagePath) {
      plainObject.imagePath = doc.imagePath;
    }
    if (doc.subject) {
      plainObject.subject = doc.subject;
    }
    if (doc.grade) {
      plainObject.grade = doc.grade;
    }
    if (doc.difficulty !== undefined && doc.difficulty !== null) {
      plainObject.difficulty = doc.difficulty;
    }

    return plainObject;
  }

  static fromPlainObject(obj: any): Document {
    return new Document(
      obj.id,
      obj.name,
      obj.type,
      obj.content
        ? obj.content.map((c: any) => Document.fromPlainObject(c))
        : undefined,
      obj.options
        ? obj.options.map((o: any) => Option.fromPlainObject(o))
        : undefined,
      obj.kind as QuestionKind | undefined,
      obj.numericAnswer,
      obj.numericTolerance,
      obj.passageText,
      obj.passageId,
      obj.passageContext,
      obj.imageUrl,
      obj.imagePath,
      obj.subject,
      obj.grade,
      obj.difficulty
    );
  }
}

/**
 * Devuelve el tipo efectivo de una pregunta. Las preguntas viejas no
 * tienen `kind`; se asume opción múltiple por retro-compatibilidad.
 */
export function getQuestionKind(doc: Document): QuestionKind {
  return doc.kind ?? QuestionKind.MULTIPLE_CHOICE_SINGLE;
}

export class Option {
  id: string;
  content: string;
  correct: boolean;

  constructor(id: string, content: string, correct: boolean) {
    this.id = id;
    this.content = content;
    this.correct = correct;
  }

  static toPlainObject(option: Option): any {
    return { ...option };
  }

  static fromPlainObject(obj: any): Option {
    return new Option(obj.id, obj.content, obj.correct);
  }
}
