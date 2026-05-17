import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  doc,
  setDoc,
  collectionData,
  CollectionReference,
} from "@angular/fire/firestore";
import { Auth, onAuthStateChanged } from "@angular/fire/auth";
import { Document } from "../models/folder.model";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { deleteDoc, getDocs, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

@Injectable({
  providedIn: "root",
})
export class ExamService {
  /**
   * UID del usuario autenticado. Se mantiene sincronizado con Firebase Auth
   * vía onAuthStateChanged para que no quede null si el servicio se
   * instancia antes de que termine el login (bug histórico de v1).
   */
  userUUID: string | null = null;

  constructor(private firestore: Firestore, private auth: Auth) {
    // Lectura síncrona: si ya hay sesión hidratada al construir el
    // servicio (caso común al navegar de /login a /home), el UID
    // queda disponible inmediatamente.
    this.userUUID = this.auth.currentUser?.uid ?? null;

    // Suscripción para cambios futuros (login/logout posteriores).
    onAuthStateChanged(this.auth, (user) => {
      this.userUUID = user ? user.uid : null;
    });
  }

  private getCollectionReference(path: string[]): CollectionReference {
    if (!this.userUUID) {
      throw new Error(
        "ExamService: no hay usuario autenticado. Iniciá sesión antes de operar sobre Firestore."
      );
    }
    let collectionPath = `${this.userUUID}`;
    path.forEach((folderId) => {
      collectionPath += `/${folderId}/content`;
    });
    return collection(this.firestore, collectionPath);
  }

  public createDocument(path: string[], document: Document): Promise<void> {
    const collectionRef = this.getCollectionReference(path);
    const docRef = doc(collectionRef, document.id);
    return setDoc(docRef, Document.toPlainObject(document));
  }

  public getDocuments(path: string[]): Observable<Document[]> {
    const collectionRef = this.getCollectionReference(path);
    return collectionData(collectionRef, { idField: "id" }).pipe(
      map((docs: any[]) => docs.map((doc) => Document.fromPlainObject(doc)))
    ) as Observable<Document[]>;
  }
  public async deleteDocumentAndCollection(
    path: string[],
    documentId: string
  ): Promise<void> {
    const docRef = doc(this.getCollectionReference(path), documentId);

    await this.deleteCollectionRecursively(docRef);
  }

  private async deleteCollectionRecursively(docRef: any): Promise<void> {
    const subcollectionDocs = await getDocs(collection(docRef, "content"));

    for (const docSnap of subcollectionDocs.docs) {
      const subDocRef = doc(docRef, "content", docSnap.id);
      await this.deleteCollectionRecursively(subDocRef);
      await deleteDoc(subDocRef);
    }

    await deleteDoc(docRef);
  }

  public async updateDocument(
    path: string[],
    documentId: string,
    updatedData: Partial<Document>
  ): Promise<void> {
    const docRef = doc(this.getCollectionReference(path), documentId);

    const plainData = Document.toPlainObject(updatedData as Document);
    await updateDoc(docRef, plainData);
  }
}
