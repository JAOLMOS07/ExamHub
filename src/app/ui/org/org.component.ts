import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { Subscription, combineLatest } from "rxjs";
import { SharedModule } from "../shared/shared.module";
import { TenantService } from "../../core/services/tenant.service";
import { OrgService } from "../../core/services/org.service";
import { ToastService } from "../../core/services/toast.service";
import { ConfirmService } from "../../core/services/confirm.service";
import { MigrationService } from "../../core/services/migration.service";
import {
  DEFAULT_ORG_SETTINGS,
  Invite,
  Member,
  Organization,
  OrgRef,
  PLAN_LABEL,
  ROLE_LABEL,
  Role,
  canManageOrg,
} from "../../core/models/org.model";

/**
 * Pantalla de la institución: datos del colegio, miembros, invitaciones,
 * cambio de organización y creación de un colegio nuevo.
 *
 * Ruta: /org
 */
@Component({
  selector: "app-org",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./org.component.html",
})
export class OrgComponent implements OnInit, OnDestroy {
  readonly ROLE_LABEL = ROLE_LABEL;
  readonly PLAN_LABEL = PLAN_LABEL;
  readonly roles: Role[] = ["admin", "coordinator", "teacher"];

  org: Organization | null = null;
  role: Role | null = null;
  myUid: string | null = null;
  myOrgs: { id: string; ref: OrgRef }[] = [];
  activeOrgId: string | null = null;
  members: Member[] = [];
  invites: Invite[] = [];
  pendingInvites: Invite[] = [];
  studentCount = 0;

  // Formularios
  orgForm = { name: "", nit: "", daneCode: "", city: "", studentCodeDigits: 6, maxScore: 5 };
  inviteForm: { email: string; role: Role } = { email: "", role: "teacher" };
  schoolForm = { name: "", nit: "", daneCode: "", city: "" };
  showCreateSchool = false;
  isSaving = false;
  isMigrating = false;
  migrationStatus = "";

  private subs: Subscription[] = [];
  private adminSubs: Subscription[] = [];

  constructor(
    private tenant: TenantService,
    private orgService: OrgService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private migration: MigrationService
  ) {}

  get isAdmin(): boolean {
    return canManageOrg(this.role);
  }

  get isSchool(): boolean {
    return this.org?.kind === "school";
  }

  get registerUrl(): string {
    return `${location.origin}/login`;
  }

  ngOnInit(): void {
    this.subs.push(
      combineLatest([this.tenant.org$, this.tenant.role$, this.tenant.user$]).subscribe(
        ([org, role, user]) => {
          this.org = org;
          this.role = role;
          this.myUid = user?.uid ?? null;
          if (org) {
            this.orgForm = {
              name: org.name,
              nit: org.nit ?? "",
              daneCode: org.daneCode ?? "",
              city: org.city ?? "",
              studentCodeDigits:
                org.settings?.studentCodeDigits ?? DEFAULT_ORG_SETTINGS.studentCodeDigits,
              maxScore: org.settings?.maxScore ?? DEFAULT_ORG_SETTINGS.maxScore,
            };
          }
          this.refreshAdminData();
        }
      ),
      this.tenant.profile$.subscribe((p) => {
        this.myOrgs = Object.entries(p?.orgs ?? {})
          .map(([id, ref]) => ({ id, ref }))
          .sort((a, b) => a.ref.name.localeCompare(b.ref.name));
      }),
      this.tenant.orgId$.subscribe((id) => (this.activeOrgId = id)),
      this.tenant.pendingInvites$.subscribe((inv) => (this.pendingInvites = inv)),
      this.orgService.students$().subscribe((s) => (this.studentCount = s.filter((x) => x.active).length))
    );
  }

  /** Miembros e invitaciones solo los puede leer el admin (reglas). */
  private refreshAdminData(): void {
    this.adminSubs.forEach((s) => s.unsubscribe());
    this.adminSubs = [];
    this.members = [];
    this.invites = [];
    if (!this.isAdmin) return;
    this.adminSubs.push(
      this.orgService.members$().subscribe((m) => (this.members = m)),
      this.orgService.invites$().subscribe((i) => (this.invites = i))
    );
  }

  ngOnDestroy(): void {
    [...this.subs, ...this.adminSubs].forEach((s) => s.unsubscribe());
  }

  // ---------------- Organización ----------------

  async saveOrg(): Promise<void> {
    if (!this.orgForm.name.trim()) {
      this.toast.warning("El nombre es obligatorio.", "ExamHub", 3000);
      return;
    }
    this.isSaving = true;
    try {
      await this.orgService.updateOrg({
        name: this.orgForm.name.trim(),
        nit: this.orgForm.nit.trim(),
        daneCode: this.orgForm.daneCode.trim(),
        city: this.orgForm.city.trim(),
        settings: {
          studentCodeDigits: clamp(Math.round(this.orgForm.studentCodeDigits), 0, 10),
          maxScore: clamp(this.orgForm.maxScore, 1, 100),
        },
      });
      this.toast.success("Datos guardados.", "ExamHub", 2500);
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos guardar los cambios.", "ExamHub", 3500);
    } finally {
      this.isSaving = false;
    }
  }

  async switchOrg(orgId: string): Promise<void> {
    await this.tenant.switchOrg(orgId);
    this.toast.success("Cambiaste de organización.", "ExamHub", 2000);
  }

  async createSchool(): Promise<void> {
    if (this.schoolForm.name.trim().length < 3) {
      this.toast.warning("Escribe el nombre del colegio.", "ExamHub", 3000);
      return;
    }
    this.isSaving = true;
    try {
      await this.tenant.createSchool(this.schoolForm);
      this.schoolForm = { name: "", nit: "", daneCode: "", city: "" };
      this.showCreateSchool = false;
      this.toast.success(
        "Colegio creado en modo prueba. Ya puedes invitar a tus docentes.",
        "ExamHub",
        4000
      );
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos crear el colegio.", "ExamHub", 3500);
    } finally {
      this.isSaving = false;
    }
  }

  // ---------------- Invitaciones ----------------

  async sendInvite(): Promise<void> {
    const email = this.inviteForm.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.toast.warning("Escribe un correo válido.", "ExamHub", 3000);
      return;
    }
    if (this.members.some((m) => m.email === email)) {
      this.toast.info("Esa persona ya es miembro.", "ExamHub", 3000);
      return;
    }
    try {
      await this.orgService.invite(email, this.inviteForm.role, this.org?.name ?? "");
      this.inviteForm.email = "";
      this.toast.success(
        `Invitación creada. Pídele a ${email} que entre a ExamHub con ese correo.`,
        "ExamHub",
        4500
      );
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos crear la invitación.", "ExamHub", 3500);
    }
  }

  async revokeInvite(invite: Invite): Promise<void> {
    await this.orgService.revokeInvite(invite.email);
  }

  async acceptInvite(invite: Invite): Promise<void> {
    try {
      await this.tenant.acceptInvite(invite);
      this.toast.success(`Ahora eres parte de ${invite.orgName}.`, "ExamHub", 3500);
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos aceptar la invitación.", "ExamHub", 3500);
    }
  }

  async declineInvite(invite: Invite): Promise<void> {
    await this.tenant.declineInvite(invite);
  }

  copyRegisterUrl(): void {
    navigator.clipboard
      ?.writeText(this.registerUrl)
      .then(() => this.toast.success("Enlace copiado.", "ExamHub", 2000));
  }

  // ---------------- Miembros ----------------

  async changeRole(member: Member, role: Role): Promise<void> {
    try {
      await this.orgService.setMemberRole(member.uid, role);
      this.toast.success("Rol actualizado.", "ExamHub", 2000);
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos cambiar el rol.", "ExamHub", 3500);
    }
  }

  async removeMember(member: Member): Promise<void> {
    const ok = await this.confirm.ask({
      title: "¿Quitar a este miembro?",
      message: `${member.email} dejará de ver el banco y las evaluaciones de la institución. Su contenido se conserva.`,
      confirmText: "Quitar",
      tone: "danger",
    });
    if (!ok) return;
    await this.orgService.removeMember(member.uid);
  }

  // ---------------- Migración ----------------

  async migrateLegacy(): Promise<void> {
    if (!this.activeOrgId || this.isMigrating) return;
    const ok = await this.confirm.ask({
      title: "¿Copiar tus datos anteriores aquí?",
      message: `Se copiarán tu banco, exámenes y calificaciones de la versión anterior a "${this.org?.name}".`,
      confirmText: "Copiar",
    });
    if (!ok) return;
    this.isMigrating = true;
    try {
      const r = await this.migration.migrate(this.activeOrgId, (m) => (this.migrationStatus = m));
      this.toast.success(
        `Listo: ${r.questions} preguntas y ${r.exams} exámenes copiados.`,
        "ExamHub",
        4000
      );
    } catch (err) {
      console.error(err);
      this.toast.danger("La migración falló. Reintentá.", "ExamHub", 4000);
    } finally {
      this.isMigrating = false;
      this.migrationStatus = "";
    }
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}
