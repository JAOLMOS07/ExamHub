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
}
