import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ToastService } from "../../core/services/toast.service";
import { SharedModule } from "../shared/shared.module";
import { PreferencesService } from "../../core/services/preferences.service";
import {
  ExamTemplate,
  UserPreferences,
} from "../../core/models/preferences.model";

type TabId = "subjects" | "grades" | "templates";

/**
 * Pantalla de Preferencias — centraliza la parametrización del
 * usuario: materias, grados y plantillas de examen.
 *
 * Acceso: `/preferences`, desde el menú de usuario en el navbar.
 */
@Component({
  selector: "app-preferences",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: "./preferences.component.html",
})
export class PreferencesComponent implements OnInit {
  activeTab: TabId = "subjects";

  prefs: UserPreferences = {
    subjects: [],
    grades: [],
    examTemplates: [],
  };

  // Inputs temporales para agregar
  newSubject = "";
  newGrade = "";

  // Estado del editor de plantilla (null = no editando)
  editingTemplate: ExamTemplate | null = null;

  constructor(
    private prefsService: PreferencesService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.prefsService.preferences$.subscribe((p) => {
      this.prefs = p;
    });
  }

  // ============== TABS ==============
  setTab(tab: TabId): void {
    this.activeTab = tab;
  }

  // ============== MATERIAS ==============
  async addSubject(): Promise<void> {
    const v = this.newSubject.trim();
    if (!v) return;
    if (this.prefs.subjects.includes(v)) {
      this.toast.warning("Esa materia ya está en la lista.", "ExamHub", 2000);
      return;
    }
    await this.prefsService.addSubject(v);
    this.newSubject = "";
    this.toast.success("Materia agregada", "ExamHub", 1500);
  }

  async removeSubject(s: string): Promise<void> {
    await this.prefsService.removeSubject(s);
  }

  // ============== GRADOS ==============
  async addGrade(): Promise<void> {
    const v = this.newGrade.trim();
    if (!v) return;
    if (this.prefs.grades.includes(v)) {
      this.toast.warning("Ese grado ya está en la lista.", "ExamHub", 2000);
      return;
    }
    await this.prefsService.addGrade(v);
    this.newGrade = "";
    this.toast.success("Grado agregado", "ExamHub", 1500);
  }

  async removeGrade(g: string): Promise<void> {
    await this.prefsService.removeGrade(g);
  }

  // ============== PLANTILLAS ==============
  startNewTemplate(): void {
    this.editingTemplate = {
      id: crypto.randomUUID(),
      name: "",
      institution: "",
      title: "",
      place: "",
      subtitle: "",
      grade: "",
      layout: "1col",
    };
  }

  editTemplate(t: ExamTemplate): void {
    this.editingTemplate = { ...t };
  }

  cancelTemplate(): void {
    this.editingTemplate = null;
  }

  async saveTemplate(): Promise<void> {
    if (!this.editingTemplate) return;
    if (!this.editingTemplate.name.trim()) {
      this.toast.warning(
        "Ponele un nombre a la plantilla.",
        "ExamHub",
        2500
      );
      return;
    }
    await this.prefsService.upsertTemplate(this.editingTemplate);
    this.toast.success("Plantilla guardada", "ExamHub", 1500);
    this.editingTemplate = null;
  }

  async removeTemplate(id: string): Promise<void> {
    await this.prefsService.removeTemplate(id);
    this.toast.success("Plantilla eliminada", "ExamHub", 1500);
  }
}
