export class Question {
  id: string;
  content: string;
  options: Option[];

  constructor(id: string, content: string, options: Option[]) {
    this.id = id;
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
