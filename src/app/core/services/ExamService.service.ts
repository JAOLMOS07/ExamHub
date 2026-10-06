import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  DocumentReference,
} from "@angular/fire/firestore";
import { Observable, combineLatest, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { Document } from "../models/folder.model";
import { objectType } from "../models/objectType.enum";
import { TenantService } from "./tenant.service";

/** Id del nivel raíz en la navegación del banco (heredado de v1). */
export const BANK_ROOT_ID = "1";

const BATCH_LIMIT = 400;

/**
 * Banco de preguntas de la organización activa.
 *
 * Modelo v2 (plano, consultable en toda la organización):
 *   /orgs/{orgId}/folders/{id}   { name, parentId }
 *   /orgs/{orgId}/stimuli/{id}   { name, text, folderId }   ← lecturas
 *   /orgs/{orgId}/items/{id}     pregunta + { folderId, stimulusId }
 *
 * La UI sigue navegando con un `path` de ids (["1", carpeta, lectura…]);
 * este servicio lo traduce al modelo plano. Las preguntas de una
 * lectura guardan `stimulusId` en vez de copiar su texto: editar la
 * lectura actualiza todas sus preguntas.
 */
@Injectable({ providedIn: "root" })
export class ExamService {
  constructor(private firestore: Firestore, private tenant: TenantService) {}

  private col(orgId: string, name: "folders" | "stimuli" | "items") {
    return collection(this.firestore, `orgs/${orgId}/${name}`);
  }

  private static parentOf(path: string[]): string | null {
    const last = path[path.length - 1];
    return !last || last === BANK_ROOT_ID ? null : last;
  }

  // ---------------------------------------------------------------------
  //  Lectura
  // ---------------------------------------------------------------------

  public getDocuments(path: string[]): Observable<Document[]> {
    const parent = ExamService.parentOf(path);
    return this.tenant.activeOrgId$().pipe(
      switchMap((orgId) => {
        const folders$ = collectionData(
          query(this.col(orgId, "folders"), where("parentId", "==", parent))
        ).pipe(map((rows) => rows.map(folderToDocument)));
        const stimuli$ = collectionData(
          query(this.col(orgId, "stimuli"), where("folderId", "==", parent))
        ).pipe(map((rows) => rows.map(stimulusToDocument)));
        const looseItems$ = collectionData(
          query(
            this.col(orgId, "items"),
            where("folderId", "==", parent),
            where("stimulusId", "==", null)
          )
        ).pipe(map((rows) => rows.map((r) => itemToDocument(r))));
        const passageItems$ = parent
          ? combineLatest([
              collectionData(
                query(this.col(orgId, "items"), where("stimulusId", "==", parent))
              ),
              (docData(doc(this.col(orgId, "stimuli"), parent)) as Observable<
                any | undefined
              >).pipe(catchError(() => of(undefined))),
            ]).pipe(
              map(([rows, stimulus]) =>
                rows.map((r) => itemToDocument(r, stimulus?.text))
              )
            )
          : of([] as Document[]);

        return combineLatest([folders$, stimuli$, looseItems$, passageItems$]).pipe(
          map(([folders, stimuli, loose, inPassage]) => [
            ...folders.sort(byName),
            ...stimuli.sort(byName),
            ...[...loose, ...inPassage].sort(byCreation),
          ])
        );
      }),
      catchError((err) => {
        console.error("[Banco] no se pudo cargar el nivel:", err);
        return of([] as Document[]);
      })
    );
  }

  /** Todas las preguntas de la organización (búsqueda global, IA, etc.). */
  public getAllItems(): Observable<Document[]> {
    return this.tenant.activeOrgId$().pipe(
      switchMap((orgId) => collectionData(this.col(orgId, "items"))),
      map((rows) => rows.map((r) => itemToDocument(r)))
    );
  }

  public async getStimulusText(stimulusId: string): Promise<string | undefined> {
    const orgId = await this.tenant.requireOrgId();
    const snap = await getDoc(doc(this.col(orgId, "stimuli"), stimulusId));
    return snap.exists() ? (snap.data() as any).text : undefined;
  }

  // ---------------------------------------------------------------------
  //  Escritura
  // ---------------------------------------------------------------------

  public async createDocument(path: string[], document: Document): Promise<void> {
    const { uid, orgId } = await this.tenant.requireContext();
    const parent = ExamService.parentOf(path);
    const now = Date.now();
    const audit = { createdBy: uid, createdAt: now, updatedAt: now };
    const batch = writeBatch(this.firestore);

    switch (document.type) {
      case objectType.FOLDER:
        batch.set(doc(this.col(orgId, "folders"), document.id), {
          id: document.id,
          name: document.name,
          parentId: parent,
          ...audit,
        });
        break;
      case objectType.PASSAGE:
        batch.set(doc(this.col(orgId, "stimuli"), document.id), {
          id: document.id,
          name: document.name,
          text: document.passageText ?? "",
          folderId: parent,
          ...audit,
        });
        break;
      default: {
        // Pregunta creada dentro de una lectura: su carpeta es la de la
        // lectura (un nivel más arriba en el path).
        const insidePassage = !!document.passageId && document.passageId === parent;
        const folderId = insidePassage
          ? ExamService.parentOf(path.slice(0, -1))
          : parent;
        batch.set(doc(this.col(orgId, "items"), document.id), {
          ...documentToItem(document),
          folderId,
          stimulusId: document.passageId ?? null,
          source: document.source ?? "manual",
          ...audit,
        });
      }
    }
    await batch.commit();
  }

  public async updateDocument(
    path: string[],
    documentId: string,
    updatedData: Partial<Document>
  ): Promise<void> {
    const { orgId } = await this.tenant.requireContext();
    const batch = writeBatch(this.firestore);
    const updatedAt = Date.now();
    switch (updatedData.type) {
      case objectType.FOLDER:
        batch.update(doc(this.col(orgId, "folders"), documentId), {
          name: updatedData.name,
          updatedAt,
        });
        break;
      case objectType.PASSAGE:
        batch.update(doc(this.col(orgId, "stimuli"), documentId), {
          name: updatedData.name,
          text: updatedData.passageText ?? "",
          updatedAt,
        });
        break;
      default: {
        const plain = documentToItem(updatedData as Document);
        // Campos opcionales que el docente pudo haber borrado.
        for (const key of OPTIONAL_ITEM_FIELDS) {
          if (!(key in plain)) plain[key] = null;
        }
        // Editar un ítem cuenta como revisión (relevante para los de IA).
        batch.update(doc(this.col(orgId, "items"), documentId), {
          ...plain,
          reviewed: true,
          updatedAt,
        });
      }
    }
    await batch.commit();
  }

  /**
   * Borra un nodo y todo lo que contiene (subcarpetas, lecturas y
   * preguntas). Se detecta el tipo leyendo el id en cada colección.
   */
  public async deleteDocumentAndCollection(
    _path: string[],
    documentId: string
  ): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const refs: DocumentReference[] = [];

    const collectFolder = async (folderId: string) => {
      refs.push(doc(this.col(orgId, "folders"), folderId));
      const [subfolders, stimuli, items] = await Promise.all([
        getDocs(query(this.col(orgId, "folders"), where("parentId", "==", folderId))),
        getDocs(query(this.col(orgId, "stimuli"), where("folderId", "==", folderId))),
        getDocs(query(this.col(orgId, "items"), where("folderId", "==", folderId))),
      ]);
      items.docs.forEach((d) => refs.push(d.ref));
      for (const s of stimuli.docs) await collectStimulus(s.id);
      for (const f of subfolders.docs) await collectFolder(f.id);
    };
    const collectStimulus = async (stimulusId: string) => {
      refs.push(doc(this.col(orgId, "stimuli"), stimulusId));
      const items = await getDocs(
        query(this.col(orgId, "items"), where("stimulusId", "==", stimulusId))
      );
      items.docs.forEach((d) => refs.push(d.ref));
    };

    const [folder, stimulus] = await Promise.all([
      getDoc(doc(this.col(orgId, "folders"), documentId)),
      getDoc(doc(this.col(orgId, "stimuli"), documentId)),
    ]);
    if (folder.exists()) await collectFolder(documentId);
    else if (stimulus.exists()) await collectStimulus(documentId);
    else refs.push(doc(this.col(orgId, "items"), documentId));

    const unique = [...new Map(refs.map((r) => [r.path, r])).values()];
    for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.firestore);
      unique.slice(i, i + BATCH_LIMIT).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }

  /** Marca un ítem generado por IA como revisado por el docente. */
  public async markReviewed(itemId: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.col(orgId, "items"), itemId), {
      reviewed: true,
      updatedAt: Date.now(),
    });
    await batch.commit();
  }
}

const OPTIONAL_ITEM_FIELDS = [
  "subject",
  "grade",
  "difficulty",
  "test",
  "competency",
  "component",
  "rationale",
  "numericAnswer",
  "numericTolerance",
  "imageUrl",
  "imagePath",
];

/** Document (UI) → documento de la colección `items`. */
export function documentToItem(d: Document): Record<string, any> {
  const plain = Document.toPlainObject(d);
  delete plain.content;
  delete plain.passageText;
  delete plain.passageContext;
  delete plain.passageId;
  return plain;
}

function folderToDocument(row: any): Document {
  return {
    id: row.id,
    name: row.name,
    type: objectType.FOLDER,
    content: [],
    folderId: row.parentId ?? null,
  } as Document;
}

function stimulusToDocument(row: any): Document {
  return {
    id: row.id,
    name: row.name,
    type: objectType.PASSAGE,
    passageText: row.text ?? "",
    content: [],
    folderId: row.folderId ?? null,
  } as Document;
}

function itemToDocument(row: any, stimulusText?: string): Document {
  const d = Document.fromPlainObject({ ...row, type: objectType.QUESTION });
  d.folderId = row.folderId ?? null;
  if (row.stimulusId) {
    d.passageId = row.stimulusId;
    if (stimulusText !== undefined) d.passageContext = stimulusText;
  }
  (d as any).createdAt = row.createdAt;
  return d;
}

const byName = (a: Document, b: Document) =>
  a.name.localeCompare(b.name, "es", { numeric: true });

const byCreation = (a: Document, b: Document) =>
  ((a as any).createdAt ?? 0) - ((b as any).createdAt ?? 0) || byName(a, b);
