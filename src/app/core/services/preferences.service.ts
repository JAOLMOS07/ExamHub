import { Injectable } from "@angular/core";
import {
  Firestore,
  doc,
  docData,
  setDoc,
  DocumentReference,
} from "@angular/fire/firestore";
import { Auth, onAuthStateChanged } from "@angular/fire/auth";
import { BehaviorSubject, Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";
import {
  DEFAULT_PREFERENCES,
  ExamTemplate,
  UserPreferences,
} from "../models/preferences.model";

/**
 * Gestiona las preferencias del usuario (materias, grados, plantillas
 * de examen). Persisten en Firestore en `users/<uid>/preferences/profile`
 * — un único documento.
 *
 * Mantiene una caché en memoria via BehaviorSubject. Los componentes
 * se suscriben a `preferences$` y reciben actualizaciones reactivas.
 */
@Injectable({ providedIn: "root" })
export class PreferencesService {
  private prefsSubject = new BehaviorSubject<UserPreferences>(
    DEFAULT_PREFERENCES
  );
  public preferences$ = this.prefsSubject.asObservable();

  private currentUid: string | null = null;

  constructor(private firestore: Firestore, private auth: Auth) {
    // Cargar preferencias cuando el usuario se autentique. Si cambia
    // de cuenta, recargamos. Si se desloguea, volvemos al default.
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUid = user?.uid ?? null;
      if (user) {
        await this.loadFromFirestore(user.uid);
      } else {
        this.prefsSubject.next(DEFAULT_PREFERENCES);
      }
    });
  }

  /** Snapshot actual (síncrono). */
  get current(): UserPreferences {
    return this.prefsSubject.value;
  }

  private getDocRef(uid: string): DocumentReference {
    return doc(this.firestore, `users/${uid}/preferences/profile`);
  }

  /**
   * Carga inicial desde Firestore. Si no existe el documento (primer
   * uso), inicializa con DEFAULT_PREFERENCES y los persiste.
   */
  private async loadFromFirestore(uid: string): Promise<void> {
    const ref = this.getDocRef(uid);
    docData(ref)
      .pipe(catchError(() => of(null)))
      .subscribe(async (data: any) => {
        if (!data) {
          // Primer uso: persistir defaults para que el usuario los
          // pueda editar después.
          await setDoc(ref, DEFAULT_PREFERENCES);
          this.prefsSubject.next({ ...DEFAULT_PREFERENCES });
          return;
        }
        // Merge defensivo con defaults — si faltan campos (versiones
        // viejas del documento), usamos los del default.
        this.prefsSubject.next({
          subjects: Array.isArray(data.subjects)
            ? data.subjects
            : DEFAULT_PREFERENCES.subjects,
          grades: Array.isArray(data.grades)
            ? data.grades
            : DEFAULT_PREFERENCES.grades,
          examTemplates: Array.isArray(data.examTemplates)
            ? data.examTemplates
            : [],
        });
      });
  }

  /** Guarda el snapshot completo a Firestore. */
  private async save(prefs: UserPreferences): Promise<void> {
    if (!this.currentUid) {
      throw new Error("No hay sesión activa para guardar preferencias.");
    }
    await setDoc(this.getDocRef(this.currentUid), prefs);
    this.prefsSubject.next(prefs);
  }

  // ============== MATERIAS ==============
  async addSubject(subject: string): Promise<void> {
    const v = subject.trim();
    if (!v) return;
    const current = this.current;
    if (current.subjects.includes(v)) return;
    await this.save({
      ...current,
      subjects: [...current.subjects, v].sort((a, b) => a.localeCompare(b)),
    });
  }

  async removeSubject(subject: string): Promise<void> {
    const current = this.current;
    await this.save({
      ...current,
      subjects: current.subjects.filter((s) => s !== subject),
    });
  }

  // ============== GRADOS ==============
  async addGrade(grade: string): Promise<void> {
    const v = grade.trim();
    if (!v) return;
    const current = this.current;
    if (current.grades.includes(v)) return;
    await this.save({
      ...current,
      grades: [...current.grades, v],
    });
  }

  async removeGrade(grade: string): Promise<void> {
    const current = this.current;
    await this.save({
      ...current,
      grades: current.grades.filter((g) => g !== grade),
    });
  }

  /** Reemplaza la lista completa (útil al reordenar). */
  async setGrades(grades: string[]): Promise<void> {
    await this.save({ ...this.current, grades: [...grades] });
  }

  // ============== PLANTILLAS DE EXAMEN ==============
  async upsertTemplate(template: ExamTemplate): Promise<void> {
    const current = this.current;
    const existing = current.examTemplates.findIndex(
      (t) => t.id === template.id
    );
    const list = [...current.examTemplates];
    if (existing >= 0) {
      list[existing] = template;
    } else {
      list.push(template);
    }
    await this.save({ ...current, examTemplates: list });
  }

  async removeTemplate(id: string): Promise<void> {
    const current = this.current;
    await this.save({
      ...current,
      examTemplates: current.examTemplates.filter((t) => t.id !== id),
    });
  }
}
