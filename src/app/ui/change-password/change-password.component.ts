import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ToastService } from "../../core/services/toast.service";
import { UserService } from "../../core/services/UserService.service";

/**
 * Mapeo de códigos de error de Firebase Auth a mensajes en español
 * para el flujo de cambio de contraseña. Cubre los más comunes.
 */
const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  "auth/wrong-password": "La contraseña actual es incorrecta.",
  "auth/invalid-credential": "La contraseña actual es incorrecta.",
  "auth/invalid-login-credentials": "La contraseña actual es incorrecta.",
  "auth/too-many-requests":
    "Demasiados intentos fallidos. Espera unos minutos y vuelve a intentar.",
  "auth/network-request-failed":
    "No se pudo conectar. Revisa tu conexión a internet.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/requires-recent-login":
    "Por seguridad, cerrá sesión y volvé a iniciarla para cambiar la contraseña.",
  "auth/no-current-user": "Tu sesión expiró. Iniciá sesión de nuevo.",
};

function getFriendlyAuthError(error: any): string {
  const code: string | undefined = error?.code;
  if (code && FIREBASE_AUTH_ERRORS[code]) {
    return FIREBASE_AUTH_ERRORS[code];
  }
  return "No pudimos cambiar tu contraseña. Volvé a intentar en un momento.";
}

/**
 * Validador a nivel de grupo: verifica que `newPassword` y
 * `confirmPassword` coincidan. Se aplica al FormGroup completo.
 */
function passwordsMatchValidator(
  group: AbstractControl
): ValidationErrors | null {
  const a = group.get("newPassword")?.value;
  const b = group.get("confirmPassword")?.value;
  if (!a || !b) return null;
  return a === b ? null : { passwordsMismatch: true };
}

/**
 * Modal de cambio de contraseña para usuarios autenticados.
 *
 * Uso:
 *   <app-change-password
 *     *ngIf="showModal"
 *     (close)="showModal = false">
 *   </app-change-password>
 *
 * El componente NO controla su propia visibilidad; el padre la maneja.
 * Emite `close` cuando el usuario cancela o cuando el cambio fue exitoso.
 */
@Component({
  selector: "app-change-password",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./change-password.component.html",
  styleUrls: ["./change-password.component.css"],
})
export class ChangePasswordComponent {
  /** Permite ocultar/mostrar el toggle de ver contraseña. */
  @Input() allowReveal = true;

  /** Se emite cuando el usuario cierra el modal o termina el flow. */
  @Output() close = new EventEmitter<void>();

  form: FormGroup;
  isSubmitting = false;
  errorMessage = "";
  showCurrent = false;
  showNew = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private toast: ToastService
  ) {
    this.form = this.fb.group(
      {
        currentPassword: ["", [Validators.required, Validators.minLength(6)]],
        newPassword: ["", [Validators.required, Validators.minLength(6)]],
        confirmPassword: ["", [Validators.required, Validators.minLength(6)]],
      },
      { validators: passwordsMatchValidator }
    );
  }

  get newPasswordCtrl() {
    return this.form.get("newPassword");
  }

  get confirmCtrl() {
    return this.form.get("confirmPassword");
  }

  /** True si el form group tiene el error de mismatch y los campos fueron tocados. */
  get passwordsMismatch(): boolean {
    return (
      this.form.hasError("passwordsMismatch") &&
      !!this.confirmCtrl?.touched
    );
  }

  onCancel() {
    if (this.isSubmitting) return;
    this.close.emit();
  }

  onSubmit() {
    if (this.isSubmitting) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = "Revisá los campos antes de continuar.";
      return;
    }
    const { currentPassword, newPassword } = this.form.value;
    if (currentPassword === newPassword) {
      this.errorMessage = "La nueva contraseña debe ser distinta a la actual.";
      return;
    }
    this.errorMessage = "";
    this.isSubmitting = true;
    this.userService
      .changePassword(currentPassword, newPassword)
      .then(() => {
        this.toast.success(
          "Contraseña actualizada. La próxima vez usá la nueva.",
          "ExamHub",
          4000
        );
        this.close.emit();
      })
      .catch((error) => {
        console.error("Change password error:", error);
        this.errorMessage = getFriendlyAuthError(error);
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }
}
