import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "@angular/fire/firestore";
import { Observable, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { Assessment, ResponseDoc } from "../models/assessment.model";
import { Document } from "../models/folder.model";
import { toScale } from "../domain/scoring";
import { documentToItem } from "./ExamService.service";
import { TenantService } from "./tenant.service";

const BATCH_LIMIT = 400;

/**
 * Evaluaciones calificables de la organización activa.
 *
 *   /orgs/{orgId}/assessments/{id}                 Assessment (formas + claves)
 *   /orgs/{orgId}/assessments/{id}/items/{itemId}  snapshot de lo impreso
 *   /orgs/{orgId}/assessments/{id}/responses/{id}  una por hoja calificada
 *
 * El scanner abre la evaluación por id (viene en el QR). Los QR v2
 * traen además el orgId; si no coincide con la organización activa,
 * la UI ofrece cambiar de organización.
 */
@Injectable({ providedIn: "root" })
export class GradingService {
  constructor(private firestore: Firestore, private tenant: TenantService) {}

  private assessmentPath(orgId: string, id: string): string {
    return `orgs/${orgId}/assessments/${id}`;
  }

  // ---------------------------------------------------------------------
  //  Evaluaciones
  // ---------------------------------------------------------------------

  /**
   * Guarda una evaluación recién generada y el snapshot de sus ítems.
   * Primero el documento principal (la regla del snapshot valida que
   * el creador sea el autor de la evaluación).
   */
  public async saveAssessment(
    assessment: Omit<Assessment, "orgId" | "createdBy" | "createdAt">,
    items: Document[]
  ): Promise<Assessment> {
    const { uid, orgId } = await this.tenant.requireContext();
    const full: Assessment = {
      ...assessment,
      orgId,
      createdBy: uid,
      createdAt: Date.now(),
    };
    const base = this.assessmentPath(orgId, assessment.id);
    await setDoc(doc(this.firestore, base), full);

    const unique = [...new Map(items.map((i) => [i.id, i])).values()];
    for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.firestore);
      for (const item of unique.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(this.firestore, `${base}/items/${item.id}`), {
          ...documentToItem(item),
          ...(item.passageContext ? { stimulusText: item.passageContext } : {}),
          ...(item.passageId ? { stimulusId: item.passageId } : {}),
        });
      }
      await batch.commit();
    }
    return full;
  }

  public async getAssessment(id: string, orgId?: string): Promise<Assessment | null> {
    const org = orgId ?? (await this.tenant.requireOrgId());
    const snap = await getDoc(doc(this.firestore, this.assessmentPath(org, id)));
    return snap.exists() ? (snap.data() as Assessment) : null;
  }

  /** Ítems tal como se imprimieron (para reportes y análisis). */
  public async getSnapshotItems(assessmentId: string): Promise<Document[]> {
    const orgId = await this.tenant.requireOrgId();
    const snap = await getDocs(
      collection(this.firestore, `${this.assessmentPath(orgId, assessmentId)}/items`)
    );
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const item = Document.fromPlainObject({ ...data, type: 1 });
      if (data.stimulusText) item.passageContext = data.stimulusText;
      if (data.stimulusId) item.passageId = data.stimulusId;
      return item;
    });
  }

  /** Evaluaciones de la organización, más recientes primero. */
  public listAssessments(): Observable<Assessment[]> {
    return this.tenant.activeOrgId$().pipe(
      switchMap(
        (orgId) =>
          collectionData(collection(this.firestore, `orgs/${orgId}/assessments`)) as Observable<
            Assessment[]
          >
      ),
      map((list) => list.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))),
      catchError((err) => {
        console.error("[GradingService] listAssessments falló:", err);
        return of([] as Assessment[]);
      })
    );
  }

  public async updateAssessment(
    id: string,
    data: Partial<Pick<Assessment, "title" | "groupIds" | "maxScore">>
  ): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, this.assessmentPath(orgId, id)), data);
    await batch.commit();
  }

  /** Borra la evaluación con sus respuestas y snapshot. */
  public async deleteAssessment(id: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const base = this.assessmentPath(orgId, id);
    const [responses, items] = await Promise.all([
      getDocs(collection(this.firestore, `${base}/responses`)),
      getDocs(collection(this.firestore, `${base}/items`)),
    ]);
    const refs = [...responses.docs, ...items.docs].map((d) => d.ref);
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.firestore);
      refs.slice(i, i + BATCH_LIMIT).forEach((r) => batch.delete(r));
      await batch.commit();
    }
    await deleteDoc(doc(this.firestore, base));
  }

  // ---------------------------------------------------------------------
  //  Respuestas
  // ---------------------------------------------------------------------

  public async saveResponse(
    assessmentId: string,
    response: Omit<ResponseDoc, "assessmentId" | "scannedAt" | "scannedBy">
  ): Promise<ResponseDoc> {
    const { uid, orgId } = await this.tenant.requireContext();
    const full: ResponseDoc = {
      ...response,
      assessmentId,
      scannedBy: uid,
      scannedAt: Date.now(),
    };
    await setDoc(
      doc(this.firestore, `${this.assessmentPath(orgId, assessmentId)}/responses/${response.id}`),
      full
    );
    return full;
  }

  public listResponses(assessmentId: string): Observable<ResponseDoc[]> {
    return this.tenant.activeOrgId$().pipe(
      switchMap(
        (orgId) =>
          collectionData(
            collection(this.firestore, `${this.assessmentPath(orgId, assessmentId)}/responses`)
          ) as Observable<ResponseDoc[]>
      ),
      map((list) => list.slice().sort((a, b) => b.scannedAt - a.scannedAt))
    );
  }

  public async deleteResponse(assessmentId: string, responseId: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await deleteDoc(
      doc(this.firestore, `${this.assessmentPath(orgId, assessmentId)}/responses/${responseId}`)
    );
  }

  /** Respuesta ya guardada para un estudiante (para evitar duplicados). */
  public async findResponseForStudent(
    assessmentId: string,
    studentId: string
  ): Promise<ResponseDoc | null> {
    const orgId = await this.tenant.requireOrgId();
    const snap = await getDocs(
      query(
        collection(this.firestore, `${this.assessmentPath(orgId, assessmentId)}/responses`),
        where("studentId", "==", studentId)
      )
    );
    return snap.empty ? null : (snap.docs[0].data() as ResponseDoc);
  }

  /** Nota en la escala del colegio (misma fórmula en vista previa y guardado). */
  public computeScore(correct: number, total: number, maxScore: number): number {
    return toScale(correct, total, maxScore);
  }
}
