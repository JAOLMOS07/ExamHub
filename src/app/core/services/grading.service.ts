import { Injectable } from "@angular/core";
import {
  Auth,
  onAuthStateChanged,
} from "@angular/fire/auth";
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  collectionData,
  deleteDoc,
} from "@angular/fire/firestore";
import { Observable, from, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import {
  ExamResult,
  GradedExam,
  PlanAtCreation,
} from "../models/gradedExam.model";

/**
 * Días de retención del examen según el plan del usuario al momento de
 * generarlo. Si el usuario downgradeea después, los exámenes viejos
 * conservan su retención original.
 */
const RETENTION_DAYS: Record<PlanAtCreation, number> = {
  free: 90,
  pro: 365,
  school: 365 * 3,
};

/**
 * Path raíz de la colección de exámenes calificables.
 *
 * Decisión: usamos una colección global `/exams` y filtramos por
 * `ownerId` en lugar de anidar bajo el UID del usuario. Esto permite
 * que el scanner haga `getDoc('/exams/{id}')` sin tener que conocer
 * el UID del dueño del examen (lo lee del doc). Las reglas de seguridad
 * garantizan que solo el `ownerId` puede leer/escribir su examen.
 */
const EXAMS_COLLECTION = "exams";
const RESULTS_SUBCOLLECTION = "results";

@Injectable({ providedIn: "root" })
export class GradingService {
  /** UID del usuario autenticado. Mismo patrón que ExamService. */
  private userUUID: string | null = null;

  constructor(private firestore: Firestore, private auth: Auth) {
    this.userUUID = this.auth.currentUser?.uid ?? null;
    onAuthStateChanged(this.auth, (user) => {
      this.userUUID = user ? user.uid : null;
    });
  }

  private requireUid(): string {
    if (!this.userUUID) {
      throw new Error(
        "GradingService: no hay usuario autenticado. Iniciá sesión antes de operar."
      );
    }
    return this.userUUID;
  }

  // ---------------------------------------------------------------------
  //  Exámenes
  // ---------------------------------------------------------------------

  /**
   * Persiste un examen recién generado, antes de imprimir los PDFs.
   *
   * Idempotente: si ya existe un doc con ese id, lo sobreescribe. Esto
   * permite que el flujo "regenerar versiones" del docente actualice el
   * answerKey sin crear duplicados.
   */
  public async saveExam(
    exam: Omit<GradedExam, "ownerId" | "createdAt" | "expiresAt">,
    planAtCreation: PlanAtCreation = "free"
  ): Promise<GradedExam> {
    const ownerId = this.requireUid();
    const now = Date.now();
    const retentionDays = RETENTION_DAYS[planAtCreation];
    const fullExam: GradedExam = {
      ...exam,
      ownerId,
      planAtCreation,
      createdAt: now,
      expiresAt: now + retentionDays * 24 * 60 * 60 * 1000,
    };
    const ref = doc(this.firestore, EXAMS_COLLECTION, exam.id);
    await setDoc(ref, { ...fullExam });
    return fullExam;
  }

  /**
   * Recupera un examen por id (usado por el scanner tras decodificar QR).
   *
   * Devuelve `null` si no existe. Las Security Rules se encargan de
   * impedir que un profe acceda al examen de otro.
   */
  public async getExamById(examId: string): Promise<GradedExam | null> {
    const ref = doc(this.firestore, EXAMS_COLLECTION, examId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as GradedExam;
  }

  /**
   * Lista los exámenes calificables del usuario actual, ordenados por
   * fecha de creación descendente. Se usa en /grade para mostrar la
   * lista "tus exámenes para calificar".
   *
   * Nota: NO ponemos `orderBy("createdAt")` en el query porque eso
   * combinado con `where("ownerId")` requiere un índice compuesto en
   * Firestore. Ordenamos client-side para que funcione sin esa
   * configuración extra (con 50 ítems el cost es nulo).
   */
  public listMyExams(maxItems = 50): Observable<GradedExam[]> {
    const uid = this.requireUid();
    const col = collection(this.firestore, EXAMS_COLLECTION);
    const q = query(
      col,
      where("ownerId", "==", uid),
      limit(maxItems)
    );
    return (
      collectionData(q, { idField: "id" }) as Observable<GradedExam[]>
    ).pipe(
      map((exams) =>
        exams.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      ),
      catchError((err) => {
        // Sin esto el componente queda en "Cargando…" para siempre cuando
        // las reglas no están desplegadas o falta un índice. Logueamos
        // a la consola del browser (revisalo si esto se dispara) y
        // emitimos array vacío para que la UI pase a estado "empty".
        console.error("[GradingService] listMyExams falló:", err);
        return of([] as GradedExam[]);
      })
    );
  }

  /**
   * Borra un examen y todos sus resultados. Pensado para "limpiar mi
   * lista" en /grade. La cascada se hace en cliente porque Firebase no
   * la soporta nativamente.
   */
  public async deleteExam(examId: string): Promise<void> {
    const resultsCol = collection(
      this.firestore,
      EXAMS_COLLECTION,
      examId,
      RESULTS_SUBCOLLECTION
    );
    const resultsSnap = await getDocs(resultsCol);
    await Promise.all(
      resultsSnap.docs.map((d) =>
        deleteDoc(doc(this.firestore, d.ref.path))
      )
    );
    await deleteDoc(doc(this.firestore, EXAMS_COLLECTION, examId));
  }

  // ---------------------------------------------------------------------
  //  Resultados
  // ---------------------------------------------------------------------

  /**
   * Guarda el resultado de un estudiante.
   */
  public async saveResult(
    examId: string,
    result: Omit<ExamResult, "examId" | "scannedAt">
  ): Promise<ExamResult> {
    const full: ExamResult = {
      ...result,
      examId,
      scannedAt: Date.now(),
    };
    const ref = doc(
      this.firestore,
      EXAMS_COLLECTION,
      examId,
      RESULTS_SUBCOLLECTION,
      result.id
    );
    await setDoc(ref, { ...full });
    return full;
  }

  /**
   * Lista los resultados de un examen, ordenados por fecha de scan.
   */
  public listResults(examId: string): Observable<ExamResult[]> {
    const col = collection(
      this.firestore,
      EXAMS_COLLECTION,
      examId,
      RESULTS_SUBCOLLECTION
    );
    const q = query(col, orderBy("scannedAt", "desc"));
    return collectionData(q, { idField: "id" }) as Observable<ExamResult[]>;
  }

  /**
   * Borra UN resultado individual (sin tocar el examen ni los otros
   * resultados). Útil para corregir un escaneo malo.
   */
  public async deleteResult(examId: string, resultId: string): Promise<void> {
    const ref = doc(
      this.firestore,
      EXAMS_COLLECTION,
      examId,
      RESULTS_SUBCOLLECTION,
      resultId
    );
    await deleteDoc(ref);
  }

  /**
   * Busca un resultado previo con el mismo `imageHash`. Sirve para
   * detectar scans duplicados (mismo alumno escaneado dos veces).
   * Devuelve null si no hay duplicado.
   */
  public async findDuplicateByImageHash(
    examId: string,
    imageHash: string
  ): Promise<ExamResult | null> {
    if (!imageHash) return null;
    const col = collection(
      this.firestore,
      EXAMS_COLLECTION,
      examId,
      RESULTS_SUBCOLLECTION
    );
    const q = query(col, where("imageHash", "==", imageHash), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as ExamResult);
  }

  /**
   * Helper de cliente: dada la cantidad de aciertos y la escala del
   * docente (ej. 5.0), devuelve la nota redondeada a 1 decimal.
   *
   * Lo dejo en el servicio para que todos los componentes usen el mismo
   * cálculo (consistencia entre vista previa y guardado).
   */
  public computeScore(
    correct: number,
    total: number,
    maxScore: number
  ): number {
    if (total <= 0) return 0;
    const raw = (correct / total) * maxScore;
    return Math.round(raw * 10) / 10;
  }
}
