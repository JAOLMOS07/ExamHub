import { objectType } from "./objectType.enum";

export class Document {
  id: string;
  name: string;
  type: objectType;
  content?: Document[];
  options?: Option[];

  constructor(
    id: string,
    name: string,
    type: objectType,
    content?: Document[],
    options?: Option[]
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.content = content;
    this.options = options;
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
        : undefined
    );
  }
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
