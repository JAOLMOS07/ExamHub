import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  query,
  where,
  writeBatch,
} from "@angular/fire/firestore";
import { Auth } from "@angular/fire/auth";
import { Observable, firstValueFrom, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { CatalogUnit, documentsToFolder, unitsFromImport, unitsToFolder } from "../domain/catalog";
import { ImportFolder } from "../domain/bankImport";
import { Document } from "../models/folder.model";
import { ExamService } from "./ExamService.service";
import { QuestionService } from "./questionService.service";
import { TenantService } from "./tenant.service";

const BATCH_LIMIT = 400;

/**
 * Banco ExamHub: catálogo global de preguntas tipo Saber 11.
 *
 *   /catalog/{unitId}          una pregunta suelta o una lectura con sus preguntas
 *   /platformAdmins/{uid}      quién publica y modera (se crea a mano en la consola)
 *
 * Todos leen lo publicado; cualquier docente propone (queda pendiente);
 * solo los administradores de la plataforma publican, aprueban o rechazan.
 */
@Injectable({ providedIn: "root" })
export class CatalogService {
  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private tenant: TenantService,
    private exams: ExamService,
    private tray: QuestionService
  ) {}

  private col() {
    return collection(this.firestore, "catalog");
  }

  async isPlatformAdmin(): Promise<boolean> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    try {
      return (await getDoc(doc(this.firestore, `platformAdmins/${uid}`))).exists();
    } catch {
      return false;
    }
  }

  /** Lo publicado de una prueba (se carga por prueba para leer menos). */
  published$(test: string): Observable<CatalogUnit[]> {
    return (
      collectionData(query(this.col(), where("status", "==", "published"), where("test", "==", test))) as Observable<
        CatalogUnit[]
      >
    ).pipe(
      map((list) => list.slice().sort(byTopic)),
      catchError((err) => {
        console.error("[Catálogo] no se pudo cargar:", err);
        return of([] as CatalogUnit[]);
      })
    );
  }

  async publishedOf(tests: string[]): Promise<CatalogUnit[]> {
    const lists = await Promise.all(tests.map((t) => firstValueFrom(this.published$(t))));
    return lists.flat();
  }

  myContributions$(): Observable<CatalogUnit[]> {
    return this.tenant.activeOrgId$().pipe(
      switchMap(() => {
        const uid = this.auth.currentUser?.uid;
        if (!uid) return of([] as CatalogUnit[]);
        return collectionData(query(this.col(), where("contributedBy.uid", "==", uid))) as Observable<CatalogUnit[]>;
      }),
      map((list) => list.slice().sort((a, b) => b.createdAt - a.createdAt)),
      catchError(() => of([] as CatalogUnit[]))
    );
  }

  pending$(): Observable<CatalogUnit[]> {
    return (collectionData(query(this.col(), where("status", "==", "pending"))) as Observable<CatalogUnit[]>).pipe(
      map((list) => list.slice().sort((a, b) => a.createdAt - b.createdAt)),
      catchError(() => of([] as CatalogUnit[]))
    );
  }

  // ---------------------------------------------------------------------
  //  Escritura
  // ---------------------------------------------------------------------

  private async write(units: CatalogUnit[]): Promise<void> {
    for (let i = 0; i < units.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.firestore);
      units.slice(i, i + BATCH_LIMIT).forEach((u) => batch.set(doc(this.col(), u.id), u));
      await batch.commit();
    }
  }

  /** Administradores: publica directo un banco importado (JSON o Word). */
  async publishImport(root: ImportFolder): Promise<{ published: number; questions: number; skipped: string[] }> {
    const uid = this.auth.currentUser?.uid ?? "";
    const { units, skipped } = unitsFromImport(root, { status: "published", source: "examhub" }, () => crypto.randomUUID());
    units.forEach((u) => (u.reviewedBy = uid));
    await this.write(units);
    return { published: units.length, questions: units.reduce((a, u) => a + u.questionCount, 0), skipped };
  }

  /** Docentes: proponen preguntas de su banco; quedan pendientes de revisión. */
  async contribute(docs: Document[]): Promise<{ sent: number; skipped: string[] }> {
    const user = this.auth.currentUser;
    if (!user) throw new Error("Inicia sesión para compartir preguntas.");
    const org = await firstValueFrom(this.tenant.org$);
    const contributedBy = {
      uid: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "Docente",
      ...(org?.name ? { orgName: org.name } : {}),
    };
    const { units, skipped } = unitsFromImport(
      documentsToFolder(docs),
      { status: "pending", source: "docente", contributedBy },
      () => crypto.randomUUID()
    );
    await this.write(units);
    return { sent: units.reduce((a, u) => a + u.questionCount, 0), skipped };
  }

  async review(unitId: string, approve: boolean, reason = ""): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.col(), unitId), {
      status: approve ? "published" : "rejected",
      reviewedBy: this.auth.currentUser?.uid ?? "",
      updatedAt: Date.now(),
      ...(approve ? {} : { rejectReason: reason || "No cumple los criterios del banco." }),
    });
    await batch.commit();
  }

  async remove(unitId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.col(), unitId));
    await batch.commit();
  }

  // ---------------------------------------------------------------------
  //  Usar en la institución
  // ---------------------------------------------------------------------

  /**
   * Copia las unidades al banco de la institución activa (carpeta nueva
   * con una subcarpeta por prueba). Con `toTray`, además quedan en el
   * examen en curso, listas para "Generar examen".
   */
  async copyToBank(units: CatalogUnit[], folderName: string, toTray = false): Promise<number> {
    const { items, questions } = await this.exams.importTree(["1"], unitsToFolder(units, folderName), "catalog");
    if (toTray) items.forEach((d) => this.tray.addQuestion(d));
    return questions;
  }
}

const byTopic = (a: CatalogUnit, b: CatalogUnit) =>
  (a.topic ?? "").localeCompare(b.topic ?? "", "es") || a.createdAt - b.createdAt;
