import { Injectable } from "@angular/core";
import { Document } from "../models/folder.model";
import { ExamService } from "./ExamService.service";

/**
 * Preguntas y lecturas ya mapeadas al modelo del banco, listas para
 * guardar. (El parseo de JSON y texto vive en domain/bankImport.ts.)
 */
export interface ParseResult {
  ok: boolean;
  errors: string[];
  looseQuestions: Document[];
  passages: { passage: Document; questions: Document[] }[];
}

/** Guarda en el banco lo que propone el generador con IA integrada. */
@Injectable({ providedIn: "root" })
export class BankImportService {
  constructor(private examService: ExamService) {}

  /**
   * Persiste el resultado bajo `path`: las preguntas sueltas en el
   * nivel actual y cada lectura con sus preguntas hijas.
   */
  async importToFirestore(
    result: ParseResult,
    path: string[]
  ): Promise<{ insertedQuestions: number; insertedPassages: number }> {
    let insertedQuestions = 0;
    let insertedPassages = 0;

    for (const q of result.looseQuestions) {
      await this.examService.createDocument(path, q);
      insertedQuestions++;
    }
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
