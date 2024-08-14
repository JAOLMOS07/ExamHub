import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  doc,
  setDoc,
  collectionData,
  CollectionReference,
} from "@angular/fire/firestore";
import { Auth } from "@angular/fire/auth";
import { Document } from "../models/folder.model";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { deleteDoc, getDocs } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

@Injectable({
  providedIn: "root",
})
export class ExamService {
  userUUID!: string | null;

  constructor(private firestore: Firestore, private auth: Auth) {
    // Escucha al usuario autenticado y guarda su UUID
    if (this.auth.currentUser) {
      this.userUUID = this.auth.currentUser?.uid;
    }
  }

  private getCollectionReference(path: string[]): CollectionReference {
    // Construye la referencia de la colección según el path
    let collectionPath = `${this.userUUID}`;
    path.forEach((folderId) => {
      collectionPath += `/${folderId}/content`;
    });
    return collection(this.firestore, collectionPath);
  }

  public createDocument(path: string[], document: Document): Promise<void> {
    const collectionRef = this.getCollectionReference(path);
    const docRef = doc(collectionRef, document.id);
    return setDoc(docRef, Document.toPlainObject(document)); // Usamos toPlainObject
  }

  public getDocuments(path: string[]): Observable<Document[]> {
    const collectionRef = this.getCollectionReference(path);
    return collectionData(collectionRef, { idField: "id" }).pipe(
      map((docs: any[]) => docs.map((doc) => Document.fromPlainObject(doc))) // Usamos fromPlainObject
    ) as Observable<Document[]>;
  }
  public async deleteDocumentAndCollection(
    path: string[],
    documentId: string
  ): Promise<void> {
    const docRef = doc(this.getCollectionReference(path), documentId);

    // Elimina el documento y su colección
    await this.deleteCollectionRecursively(docRef);
  }

  private async deleteCollectionRecursively(docRef: any): Promise<void> {
    // Obtén todos los documentos en la colección
    const subcollectionDocs = await getDocs(collection(docRef, "content"));

    // Elimina cada documento en la colección
    for (const docSnap of subcollectionDocs.docs) {
      const subDocRef = doc(docRef, "content", docSnap.id);
      await this.deleteCollectionRecursively(subDocRef); // Elimina recursivamente subcolecciones
      await deleteDoc(subDocRef);
    }

    // Elimina el documento en sí (si es una colección principal)
    await deleteDoc(docRef);
  }
}
