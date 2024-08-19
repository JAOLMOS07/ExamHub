import { Injectable } from "@angular/core";
import {
  Auth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  User,
} from "@angular/fire/auth";
import { signOut } from "firebase/auth";
import { BehaviorSubject, of } from "rxjs";

@Injectable({ providedIn: "root" })
export class UserService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private auth: Auth) {
    this.auth.onAuthStateChanged((user) => {
      this.currentUserSubject.next(user);
    });
  }

  public login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password).then(
      (result) => {
        this.currentUserSubject.next(result.user);
        return result.user;
      }
    );
  }

  public logout() {
    this.currentUserSubject.next(null);
    return signOut(this.auth);
  }

  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
  public sendPasswordResetEmail(email: string) {
    return sendPasswordResetEmail(this.auth, email)
      .then(() => {
        console.log("Correo de restablecimiento enviado.");
      })
      .catch((error) => {
        console.error("Error al enviar el correo de restablecimiento:", error);
        return of(error);
      });
  }
}
