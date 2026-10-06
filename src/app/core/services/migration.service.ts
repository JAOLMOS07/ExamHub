import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
  DocumentReference,
} from "@angular/fire/firestore";
import { Document } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { QuestionKind } from "../models/questionKind.enum";
import { ExamResult, GradedExam } from "../models/gradedExam.model";
import { Assessment, KeyEntry, ResponseDoc } from "../models/assessment.model";
import { UserProfile } from "../models/org.model";
import { scoreResponse, toScale } from "../domain/scoring";
import { BANK_ROOT_ID, documentToItem } from "./ExamService.service";
import { TenantService } from "./tenant.service";

const BATCH_LIMIT = 400;

export interface MigrationReport {
  folders: number;
  passages: number;
  questions: number;
  exams: number;
  results: number;
}

/**
 * Migra los datos de un docente desde el modelo v1 al v2:
 *
 *   /{uid}/1/content/...            → /orgs/{orgId}/folders|stimuli|items
 *   /exams/{id} (ownerId == uid)    → /orgs/{orgId}/assessments/{id}
 *   /exams/{id}/results/{rid}       → .../assessments/{id}/responses/{rid}
 *
 * Idempotente: conserva los ids originales, así que correrla dos veces
 * sobreescribe en lugar de duplicar. No borra nada de v1.
 */
@Injectable({ providedIn: "root" })
export class MigrationService {
  constructor(private firestore: Firestore, private tenant: TenantService) {}

  /** ¿Hay datos v1 sin migrar para el usuario actual? */
  async needsMigration(): Promise<boolean> {
    const { uid } = await this.tenant.requireContext();
    const profile = (await getDoc(doc(this.firestore, `users/${uid}`))).data() as
      | UserProfile
      | undefined;
    if (profile?.legacyMigratedAt) return false;
    const [bank, exams] = await Promise.all([
      getDocs(query(collection(this.firestore, `${uid}/${BANK_ROOT_ID}/content`), limit(1))),
      getDocs(
        query(collection(this.firestore, "exams"), where("ownerId", "==", uid), limit(1))
      ),
    ]).catch(() => [null, null]);
    return !!(bank && !bank.empty) || !!(exams && !exams.empty);
  }

  async migrate(
    targetOrgId: string,
    onProgress: (msg: string) => void = () => undefined
  ): Promise<MigrationReport> {
    const { uid } = await this.tenant.requireContext();
    const report: MigrationReport = {
      folders: 0,
      passages: 0,
      questions: 0,
      exams: 0,
      results: 0,
    };
    const writes: { ref: DocumentReference; data: any }[] = [];
    const now = Date.now();
    const audit = { createdBy: uid, createdAt: now, updatedAt: now };
    const orgCol = (name: string) =>
      collection(this.firestore, `orgs/${targetOrgId}/${name}`);

    // ---------------- Banco ----------------
    const walk = async (
      path: string[],
      folderId: string | null,
      stimulusId: string | null
    ) => {
      const colPath = `${uid}/` + path.map((p) => `${p}/content`).join("/");
      const snap = await getDocs(collection(this.firestore, colPath));
      for (const d of snap.docs) {
        const node = Document.fromPlainObject({ ...d.data(), id: d.id });
        if (node.type === objectType.FOLDER) {
          report.folders++;
          writes.push({
            ref: doc(orgCol("folders"), node.id),
            data: { id: node.id, name: node.name, parentId: folderId, ...audit },
          });
          await walk([...path, node.id], node.id, null);
        } else if (node.type === objectType.PASSAGE) {
          report.passages++;
          writes.push({
            ref: doc(orgCol("stimuli"), node.id),
            data: {
              id: node.id,
              name: node.name,
              text: node.passageText ?? "",
              folderId,
              ...audit,
            },
          });
          await walk([...path, node.id], folderId, node.id);
        } else {
          report.questions++;
          writes.push({
            ref: doc(orgCol("items"), node.id),
            data: {
              ...documentToItem(node),
              folderId,
              stimulusId: stimulusId ?? node.passageId ?? null,
              source: "legacy",
              ...audit,
            },
          });
        }
      }
      onProgress(
        `Banco: ${report.folders} carpetas, ${report.passages} lecturas, ${report.questions} preguntas…`
      );
    };
    await walk([BANK_ROOT_ID], null, null);

    // ---------------- Exámenes y resultados ----------------
    const exams = await getDocs(
      query(collection(this.firestore, "exams"), where("ownerId", "==", uid))
    );
    for (const e of exams.docs) {
      const exam = e.data() as GradedExam;
      report.exams++;
      const forms = exam.versions.map((v) => ({
        id: v.versionId,
        label: v.label,
        seed: 0,
        key: v.answers.map(
          (letter): KeyEntry => ({
            itemId: null,
            kind: letter ? QuestionKind.MULTIPLE_CHOICE_SINGLE : QuestionKind.OPEN,
            letter,
          })
        ),
      }));
      const assessment: Assessment = {
        id: exam.id,
        orgId: targetOrgId,
        title: exam.title,
        type: "quiz",
        groupIds: [],
        totalQuestions: exam.totalQuestions,
        letters: exam.letters,
        sheet: {
          version: 1,
          letterCount: exam.letters.length,
          codeDigits: 0,
          totalPages: 1,
        },
        forms,
        maxScore: 5,
        createdBy: uid,
        createdAt: exam.createdAt ?? now,
        legacy: true,
        ...(exam.subject ? { subject: exam.subject } : {}),
        ...(exam.grade ? { grade: exam.grade } : {}),
      };
      writes.push({
        ref: doc(this.firestore, `orgs/${targetOrgId}/assessments/${exam.id}`),
        data: assessment,
      });

      const results = await getDocs(
        collection(this.firestore, `exams/${exam.id}/results`)
      );
      for (const r of results.docs) {
        const res = r.data() as ExamResult;
        const form = forms.find((f) => f.id === res.versionId) ?? forms[0];
        const breakdown = scoreResponse(form.key, res.answers, res.manualScores);
        report.results++;
        const response: ResponseDoc = {
          id: r.id,
          assessmentId: exam.id,
          formId: form.id,
          answers: res.answers,
          source: res.source,
          breakdown,
          score: res.score ?? toScale(breakdown.correct, breakdown.total, 5),
          scannedBy: uid,
          scannedAt: res.scannedAt ?? now,
          ...(res.studentName ? { studentName: res.studentName } : {}),
          ...(res.studentCode ? { studentCode: res.studentCode } : {}),
          ...(res.manualScores ? { manualScores: res.manualScores } : {}),
        };
        writes.push({
          ref: doc(
            this.firestore,
            `orgs/${targetOrgId}/assessments/${exam.id}/responses/${r.id}`
          ),
          data: response,
        });
      }
      onProgress(`Exámenes: ${report.exams}, calificaciones: ${report.results}…`);
    }

    // ---------------- Escritura ----------------
    // Primero los exámenes (las reglas de responses no dependen del
    // padre, pero así el progreso visible es coherente).
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.firestore);
      writes.slice(i, i + BATCH_LIMIT).forEach((w) => batch.set(w.ref, w.data));
      await batch.commit();
      onProgress(`Guardando… ${Math.min(i + BATCH_LIMIT, writes.length)}/${writes.length}`);
    }
    const batch = writeBatch(this.firestore);
    batch.set(
      doc(this.firestore, `users/${uid}`),
      { legacyMigratedAt: Date.now() },
      { merge: true }
    );
    await batch.commit();
    return report;
  }

  /** El docente decidió no migrar: no volver a preguntar. */
  async dismiss(): Promise<void> {
    const { uid } = await this.tenant.requireContext();
    const batch = writeBatch(this.firestore);
    batch.set(
      doc(this.firestore, `users/${uid}`),
      { legacyMigratedAt: -1 },
      { merge: true }
    );
    await batch.commit();
  }
}
