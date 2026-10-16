import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { ToastService } from "../../core/services/toast.service";
import { SharedModule } from "../shared/shared.module";
import { PreferencesService } from "../../core/services/preferences.service";
import {
  ExamTemplate,
  UserPreferences,
} from "../../core/models/preferences.model";
import { ThemeMode, ThemeService } from "../../core/theme/theme.service";
import { BRAND_PRESETS } from "../../core/theme/palettes";

type TabId = "subjects" | "grades" | "templates" | "appearance";

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

  readonly presets = BRAND_PRESETS;
  readonly modes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: "Claro", icon: "light_mode" },
    { id: "dark", label: "Oscuro", icon: "dark_mode" },
    { id: "system", label: "Como el sistema", icon: "contrast" },
  ];
  customColor = "#0f766e";

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
    private toast: ToastService,
    public theme: ThemeService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get("tab");
    if (tab === "appearance") this.activeTab = "appearance";
    if (this.theme.prefs.custom) this.customColor = this.theme.prefs.custom;
    this.prefsService.preferences$.subscribe((p) => {
      this.prefs = p;
    });
  }

  // ============== TABS ==============
  setTab(tab: TabId): void {
    this.activeTab = tab;
  }

  // ============== APARIENCIA ==============
  swatch(id: string): string {
    const p = this.presets.find((x) => x.id === id);
    return p ? `rgb(${p.scale[600]})` : this.customColor;
  }

  setMode(mode: ThemeMode): void {
    this.theme.set({ mode });
  }

  setBrand(id: string): void {
    this.theme.set({ brand: id });
  }

  setCustom(hex: string): void {
    this.customColor = hex;
    this.theme.set({ brand: "custom", custom: hex });
  }

  resetTheme(): void {
    this.theme.set({ mode: "system", brand: "indigo", custom: undefined });
    this.toast.success("Apariencia restablecida.", "ExamHub", 2000);
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
