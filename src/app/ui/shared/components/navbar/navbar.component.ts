import { Component, OnInit } from "@angular/core";
import { UserService } from "../../../../core/services/UserService.service";
import { Router } from "@angular/router";
import { User } from "@angular/fire/auth";

/**
 * Navbar superior. Muestra:
 *   - Logo de marca a la izquierda (link a /home).
 *   - Estado de sesión: email del usuario y dropdown con logout.
 *
 * Se renderiza en todas las pantallas dentro del shell autenticado.
 */
@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.css",
})
export class NavbarComponent implements OnInit {
  user: User | null = null;
  /** Controla la visibilidad del modal de cambio de contraseña. */
  showChangePassword = false;

  constructor(private userService: UserService, private router: Router) {}

  /** Abre el modal de cambio de contraseña desde el dropdown de usuario. */
  openChangePassword(): void {
    this.showChangePassword = true;
  }

  /** Cierra el modal de cambio de contraseña (cancelado o exitoso). */
  closeChangePassword(): void {
    this.showChangePassword = false;
  }

  ngOnInit(): void {
    this.userService.currentUser$.subscribe((user) => {
      this.user = user;
    });
  }

  /** Iniciales del email del usuario para mostrar en el avatar. */
  get initials(): string {
    const email = this.user?.email ?? "";
    if (!email) return "??";
    const namePart = email.split("@")[0] ?? "";
    const parts = namePart.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return namePart.substring(0, 2).toUpperCase();
  }

  logout() {
    this.userService
      .logout()
      .then(() => {
        this.router.navigate(["/login"]);
      })
      .catch((error) => {
        console.error("Logout error:", error);
      });
  }
}
