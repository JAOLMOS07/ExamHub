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
import { deleteDoc, getDocs, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

@Injectable({
  providedIn: "root",
})
export class ExamService {
  userUUID!: string | null;

  constructor(private firestore: Firestore, private auth: Auth) {
    if (this.auth.currentUser) {
      this.userUUID = this.auth.currentUser?.uid;
    }
  }

  private getCollectionReference(path: string[]): CollectionReference {
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
