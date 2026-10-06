import { Component, OnInit } from "@angular/core";
import { UserService } from "../../../../core/services/UserService.service";
import { Router } from "@angular/router";
import { User } from "@angular/fire/auth";
import { TenantService } from "../../../../core/services/tenant.service";
import { OrgRef, ROLE_LABEL } from "../../../../core/models/org.model";

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

  readonly ROLE_LABEL = ROLE_LABEL;
  activeOrgId: string | null = null;
  orgs: { id: string; ref: OrgRef }[] = [];
  pendingInvites = 0;

  constructor(
    private userService: UserService,
    private router: Router,
    private tenant: TenantService
  ) {}

  get activeOrg(): OrgRef | null {
    return this.orgs.find((o) => o.id === this.activeOrgId)?.ref ?? null;
  }

  switchOrg(orgId: string): void {
    if (orgId !== this.activeOrgId) this.tenant.switchOrg(orgId);
    (document.activeElement as HTMLElement | null)?.blur();
  }

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
    this.tenant.orgId$.subscribe((id) => (this.activeOrgId = id));
    this.tenant.profile$.subscribe((p) => {
      this.orgs = Object.entries(p?.orgs ?? {})
        .map(([id, ref]) => ({ id, ref }))
        .sort((a, b) => a.ref.name.localeCompare(b.ref.name));
    });
    this.tenant.pendingInvites$.subscribe((inv) => (this.pendingInvites = inv.length));
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
