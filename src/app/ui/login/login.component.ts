import { Component } from "@angular/core";
import { UserService } from "../../core/services/UserService.service";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { ExamService } from "../../core/services/ExamService.service";
import { NgToastService } from "ng-angular-popup";
import { LogoComponent } from "../shared/brand/logo.component";

/**
 * Mapeo de códigos de error de Firebase Auth a mensajes en español
 * amigables para el usuario final. La lista cubre los códigos más
 * comunes; cualquier otro cae al mensaje genérico.
 *
 * Referencia: https://firebase.google.com/docs/auth/admin/errors
 */
const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/user-disabled": "Esta cuenta fue deshabilitada.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "La contraseña es incorrecta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
  "auth/too-many-requests":
    "Demasiados intentos fallidos. Esperá unos minutos y volvé a intentar.",
  "auth/network-request-failed":
    "No se pudo conectar. Revisá tu conexión a internet.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
};

function getFriendlyAuthError(error: any): string {
  const code: string | undefined = error?.code;
  if (code && FIREBASE_AUTH_ERRORS[code]) {
    return FIREBASE_AUTH_ERRORS[code];
  }
  return "No pudimos iniciar sesión. Volvé a intentar en un momento.";
}

@Component({
  selector: "app-login",
  standalone: true,
  providers: [UserService, ExamService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LogoComponent],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = "";
  /** Año actual para el footer del hero. */
  year: number = new Date().getFullYear();

  constructor(
    private userService: UserService,
    private formBuilder: FormBuilder,
    private router: Router,
    private toast: NgToastService
  ) {
    this.loginForm = this.formBuilder.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit() {
    this.userService.currentUser$.subscribe((user) => {
      if (user) {
        // Reservado para redireccionar si ya hay sesión activa.
      }
    });
  }

  resetPassword() {
    const email = this.loginForm.value.email;
    if (!email || this.loginForm.get("email")?.invalid) {
      this.toast.warning(
        "Escribí tu correo arriba y volvé a apretar 'Olvidé mi contraseña'.",
        "ExamHub",
        3500
      );
      return;
    }
    this.userService
      .sendPasswordResetEmail(email)
      .then(() => {
        this.toast.success(
          "Te enviamos un correo para restablecer tu contraseña.",
          "ExamHub",
          3500
        );
      })
      .catch((error) => {
        this.toast.danger(getFriendlyAuthError(error), "ExamHub", 3500);
      });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = "Completá correo y contraseña.";
      return;
    }
    this.errorMessage = "";
    const { email, password } = this.loginForm.value;
    this.userService
      .login(email, password)
      .then(() => {
        this.router.navigate(["/home"]);
      })
      .catch((error) => {
        this.errorMessage = getFriendlyAuthError(error);
        console.error("Login error:", error);
      });
  }
}
