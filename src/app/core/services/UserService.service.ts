import { Injectable } from "@angular/core";
import {
  Auth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  User,
} from "@angular/fire/auth";
import { signOut } from "firebase/auth";
import { BehaviorSubject } from "rxjs";

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

  /**
   * Envía un correo de restablecimiento de contraseña al email indicado.
   *
   * Importante: deja que el error se propague (no lo silencia) para que
   * el componente que llama pueda mostrar el toast/mensaje adecuado.
   */
  public sendPasswordResetEmail(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   *
   * Firebase exige autenticación reciente para operaciones sensibles,
   * por eso primero hacemos `reauthenticateWithCredential` con la
   * contraseña actual y luego `updatePassword`.
   *
   * @param currentPassword Contraseña actual (para reautenticación).
   * @param newPassword     Nueva contraseña deseada.
   */
  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) {
      // Usamos el mismo shape de error que Firebase para que el mapper
      // amigable lo reconozca como "no hay sesión".
      throw { code: "auth/no-current-user" };
    }
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }
}
