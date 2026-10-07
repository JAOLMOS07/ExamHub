import { Component, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { User } from "@angular/fire/auth";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { UserService } from "../../../../core/services/UserService.service";
import { TenantService } from "../../../../core/services/tenant.service";
import {
  Organization,
  OrgRef,
  PLAN_LABEL,
  ROLE_LABEL,
  Role,
} from "../../../../core/models/org.model";

interface NavItem {
  label: string;
  icon: string;
  link: string;
  exact?: boolean;
}

/**
 * Shell de la app: barra lateral fija en escritorio (≥ lg) y barra
 * superior con cajón en móvil. Muestra la institución activa (con
 * selector), la navegación principal y el usuario.
 *
 * Cada pantalla autenticada la incluye con `<app-navbar />`; al
 * montarse agrega `eh-has-sidebar` al body para que el contenido deje
 * el espacio de la barra (styles.css).
 */
@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.css",
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly ROLE_LABEL = ROLE_LABEL;
  readonly PLAN_LABEL = PLAN_LABEL;
  readonly nav: NavItem[] = [
    { label: "Banco de preguntas", icon: "folder_open", link: "/home" },
    { label: "Evaluaciones", icon: "fact_check", link: "/grade" },
    { label: "Estudiantes", icon: "groups", link: "/students" },
    { label: "Institución", icon: "apartment", link: "/org" },
  ];

  user: User | null = null;
  org: Organization | null = null;
  role: Role | null = null;
  activeOrgId: string | null = null;
  orgs: { id: string; ref: OrgRef }[] = [];
  pendingInvites = 0;

  showChangePassword = false;
  mobileOpen = false;
  orgMenuOpen = false;
  userMenuOpen = false;

  private subs: Subscription[] = [];

  constructor(
    private userService: UserService,
    private router: Router,
    private tenant: TenantService
  ) {}

  ngOnInit(): void {
    document.body.classList.add("eh-has-sidebar");
    this.subs.push(
      this.userService.currentUser$.subscribe((user) => (this.user = user)),
      this.tenant.orgId$.subscribe((id) => (this.activeOrgId = id)),
      this.tenant.org$.subscribe((org) => (this.org = org)),
      this.tenant.role$.subscribe((role) => (this.role = role)),
      this.tenant.profile$.subscribe((p) => {
        this.orgs = Object.entries(p?.orgs ?? {})
          .map(([id, ref]) => ({ id, ref }))
          .sort((a, b) => a.ref.name.localeCompare(b.ref.name));
      }),
      this.tenant.pendingInvites$.subscribe((inv) => (this.pendingInvites = inv.length)),
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => this.closeMenus())
    );
  }

  ngOnDestroy(): void {
    document.body.classList.remove("eh-has-sidebar");
    this.subs.forEach((s) => s.unsubscribe());
  }

  get activeOrgName(): string {
    return this.org?.name ?? this.orgs.find((o) => o.id === this.activeOrgId)?.ref.name ?? "";
  }

  get isPersonal(): boolean {
    return !!this.activeOrgId?.startsWith("p_");
  }

  get displayName(): string {
    return this.user?.displayName || this.user?.email?.split("@")[0] || "";
  }

  get initials(): string {
    const base = this.user?.displayName || this.user?.email?.split("@")[0] || "";
    const parts = base.split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
  }

  switchOrg(orgId: string): void {
    this.orgMenuOpen = false;
    if (orgId !== this.activeOrgId) this.tenant.switchOrg(orgId);
  }

  closeMenus(): void {
    this.mobileOpen = false;
    this.orgMenuOpen = false;
    this.userMenuOpen = false;
  }

  openChangePassword(): void {
    this.userMenuOpen = false;
    this.showChangePassword = true;
  }

  closeChangePassword(): void {
    this.showChangePassword = false;
  }

  logout(): void {
    this.userService
      .logout()
      .then(() => this.router.navigate(["/login"]))
      .catch((error) => console.error("Logout error:", error));
  }
}
