import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { Subscription, combineLatest } from "rxjs";
import { SharedModule } from "../shared/shared.module";
import { OrgService } from "../../core/services/org.service";
import { TenantService } from "../../core/services/tenant.service";
import { ToastService } from "../../core/services/toast.service";
import { ConfirmService } from "../../core/services/confirm.service";
import {
  Group,
  Organization,
  Role,
  Student,
  canManageAcademics,
} from "../../core/models/org.model";
import { parseStudentsCsv, StudentsParseResult } from "../../core/domain/studentsCsv";

/**
 * Grupos y estudiantes de la institución.
 *
 * Ruta: /students
 *
 * El código del estudiante es el que se rellena en burbujas en la hoja
 * de respuestas: con él la calificación asocia la hoja al estudiante
 * y a su grupo automáticamente.
 */
@Component({
  selector: "app-students",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./students.component.html",
})
export class StudentsComponent implements OnInit, OnDestroy {
  groups: Group[] = [];
  students: Student[] = [];
  org: Organization | null = null;
  role: Role | null = null;

  year = new Date().getFullYear();
  selectedGroupId: string | "all" | "none" = "all";
  search = "";

  groupForm: { id?: string; name: string; grade: number | null; shift: string; campus: string } = {
    name: "",
    grade: null,
    shift: "",
    campus: "",
  };
  showGroupForm = false;

  studentForm: { id?: string; code: string; fullName: string; groupId: string | null } = {
    code: "",
    fullName: "",
    groupId: null,
  };
  showStudentForm = false;

  showImport = false;
  importText = "";
  importPreview: StudentsParseResult | null = null;
  importDefaultGroupId: string | null = null;
  isImporting = false;

  private sub?: Subscription;

  constructor(
    private orgService: OrgService,
    private tenant: TenantService,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  get canEdit(): boolean {
    return canManageAcademics(this.role);
  }

  get yearGroups(): Group[] {
    return this.groups.filter((g) => g.year === this.year);
  }

  get years(): number[] {
    const set = new Set<number>([new Date().getFullYear(), ...this.groups.map((g) => g.year)]);
    return [...set].sort((a, b) => b - a);
  }

  get filteredStudents(): Student[] {
    const q = this.search.trim().toLowerCase();
    return this.students.filter((s) => {
      if (s.year !== this.year) return false;
      if (this.selectedGroupId === "none" && s.groupId) return false;
      if (
        this.selectedGroupId !== "all" &&
        this.selectedGroupId !== "none" &&
        s.groupId !== this.selectedGroupId
      ) {
        return false;
      }
      return !q || s.fullName.toLowerCase().includes(q) || s.code.includes(q);
    });
  }

  get activeCount(): number {
    return this.students.filter((s) => s.active).length;
  }

  countIn(groupId: string): number {
    return this.students.filter((s) => s.groupId === groupId && s.year === this.year).length;
  }

  groupName(groupId: string | null): string {
    return this.groups.find((g) => g.id === groupId)?.name ?? "Sin grupo";
  }

  ngOnInit(): void {
    this.sub = combineLatest([
      this.orgService.groups$(),
      this.orgService.students$(),
      this.tenant.org$,
      this.tenant.role$,
    ]).subscribe(([groups, students, org, role]) => {
      this.groups = groups;
      this.students = students;
      this.org = org;
      this.role = role;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ---------------- Grupos ----------------

  editGroup(group?: Group): void {
    this.groupForm = group
      ? {
          id: group.id,
          name: group.name,
          grade: group.grade ?? null,
          shift: group.shift ?? "",
          campus: group.campus ?? "",
        }
      : { name: "", grade: null, shift: "", campus: "" };
    this.showGroupForm = true;
  }

  async saveGroup(): Promise<void> {
    const name = this.groupForm.name.trim();
    if (!name) {
      this.toast.warning("Escribe el nombre del grupo (ej. 11-A).", "ExamHub", 3000);
      return;
    }
    const gradeFromName = parseInt(name, 10);
    try {
      const id = await this.orgService.saveGroup({
        id: this.groupForm.id,
        name,
        year: this.year,
        grade: this.groupForm.grade ?? (Number.isFinite(gradeFromName) ? gradeFromName : undefined),
        shift: this.groupForm.shift.trim() || undefined,
        campus: this.groupForm.campus.trim() || undefined,
      });
      this.selectedGroupId = id;
      this.showGroupForm = false;
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos guardar el grupo.", "ExamHub", 3500);
    }
  }

  async deleteGroup(group: Group): Promise<void> {
    const n = this.countIn(group.id);
    const ok = await this.confirm.ask({
      title: `¿Eliminar el grupo ${group.name}?`,
      message: n > 0 ? `Sus ${n} estudiantes quedarán sin grupo.` : "El grupo está vacío.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    for (const s of this.students.filter((x) => x.groupId === group.id)) {
      await this.orgService.saveStudent({ ...s, groupId: null });
    }
    await this.orgService.deleteGroup(group.id);
    this.selectedGroupId = "all";
  }

  // ---------------- Estudiantes ----------------

  editStudent(student?: Student): void {
    this.studentForm = student
      ? { id: student.id, code: student.code, fullName: student.fullName, groupId: student.groupId }
      : {
          code: "",
          fullName: "",
          groupId:
            this.selectedGroupId === "all" || this.selectedGroupId === "none"
              ? null
              : this.selectedGroupId,
        };
    this.showStudentForm = true;
  }

  async saveStudent(): Promise<void> {
    const code = this.studentForm.code.replace(/\s+/g, "");
    const fullName = this.studentForm.fullName.trim();
    if (!/^\d+$/.test(code) || !fullName) {
      this.toast.warning("Código (solo dígitos) y nombre son obligatorios.", "ExamHub", 3500);
      return;
    }
    const duplicate = this.students.find((s) => s.code === code && s.id !== this.studentForm.id);
    if (duplicate) {
      this.toast.warning(`El código ${code} ya es de ${duplicate.fullName}.`, "ExamHub", 3500);
      return;
    }
    try {
      await this.orgService.saveStudent({
        id: this.studentForm.id,
        code,
        fullName,
        groupId: this.studentForm.groupId,
        year: this.year,
        active: true,
      });
      this.showStudentForm = false;
    } catch (err) {
      console.error(err);
      this.toast.danger("No pudimos guardar al estudiante.", "ExamHub", 3500);
    }
  }

  async deleteStudent(student: Student): Promise<void> {
    const ok = await this.confirm.ask({
      title: `¿Eliminar a ${student.fullName}?`,
      message: "Sus calificaciones guardadas se conservan.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (ok) await this.orgService.deleteStudent(student.id);
  }

  // ---------------- Importación ----------------

  previewImport(): void {
    this.importPreview = parseStudentsCsv(this.importText);
  }

  async runImport(): Promise<void> {
    if (!this.importPreview || this.importPreview.rows.length === 0) return;
    const seats = this.org?.seats ?? 0;
    const newOnes = this.importPreview.rows.filter(
      (r) => !this.students.some((s) => s.code === r.code)
    ).length;
    if (this.org?.kind === "school" && this.activeCount + newOnes > seats) {
      const ok = await this.confirm.ask({
        title: "Superarías el cupo de estudiantes",
        message: `Tu plan incluye ${seats} estudiantes y quedarías con ${this.activeCount + newOnes}. Puedes importar igual y luego ampliar el plan.`,
        confirmText: "Importar igual",
      });
      if (!ok) return;
    }
    this.isImporting = true;
    try {
      const r = await this.orgService.importStudents(this.importPreview.rows, {
        year: this.year,
        defaultGroupId: this.importDefaultGroupId,
        existing: this.students.filter((s) => s.year === this.year),
        groups: this.groups,
      });
      this.toast.success(
        `Importación lista: ${r.created} nuevos, ${r.updated} actualizados${
          r.groupsCreated ? `, ${r.groupsCreated} grupos creados` : ""
        }.`,
        "ExamHub",
        4500
      );
      this.importText = "";
      this.importPreview = null;
      this.showImport = false;
    } catch (err) {
      console.error(err);
      this.toast.danger("La importación falló.", "ExamHub", 3500);
    } finally {
      this.isImporting = false;
    }
  }
}
