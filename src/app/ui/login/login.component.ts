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

@Component({
  selector: "app-login",
  standalone: true,
  providers: [UserService, ExamService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = "";

  constructor(
    private userService: UserService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit() {
    this.userService.currentUser$.subscribe((user) => {
      if (user) {
      }
    });
  }

  resetPassword() {
    const { email, password } = this.loginForm.value;
    this.userService.sendPasswordResetEmail(email).then(() => {
      window.alert("Se envió un correo para restablecer la contraseña");
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.userService
        .login(email, password)
        .then(() => {
          console.log("Login successful");
          this.router.navigate(["/home"]);
        })
        .catch((error) => {
          this.errorMessage = error.message;
          console.error("Login error:", error);
        });
    }
  }
}
