/**
 * ========================================================================
 *  Modelos multi-organización (v2)
 * ------------------------------------------------------------------------
 *  Todo el contenido pertenece a una organización. Un docente que se
 *  registra solo recibe una organización "personal" de un miembro; un
 *  colegio es una organización con varios miembros y roles.
 *
 *    /users/{uid}                          UserProfile (caché para la UI)
 *    /orgs/{orgId}                         Organization
 *    /orgs/{orgId}/members/{uid}           Member  ← fuente de verdad de roles
 *    /orgs/{orgId}/invites/{email}         Invite
 *    /orgs/{orgId}/groups/{groupId}        Group
 *    /orgs/{orgId}/students/{studentId}    Student
 *    /orgs/{orgId}/folders|stimuli|items   Banco de preguntas
 *    /orgs/{orgId}/assessments/...         Evaluaciones (assessment.model.ts)
 * ========================================================================
 */

export type Role = "admin" | "coordinator" | "teacher";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coordinator: "Coordinador",
  teacher: "Docente",
};

export type OrgKind = "personal" | "school";

/** Los planes los asigna ExamHub (consola/backend), no el cliente. */
export type Plan = "personal" | "trial" | "school" | "network";

export const PLAN_LABEL: Record<Plan, string> = {
  personal: "Docente",
  trial: "Colegio (prueba)",
  school: "Colegio",
  network: "Red de colegios",
};

export interface OrgSettings {
  /** Dígitos del código del estudiante en la hoja de respuestas. */
  studentCodeDigits: number;
  /** Escala de notas del colegio (ej. 5.0). */
  maxScore: number;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  studentCodeDigits: 6,
  maxScore: 5,
};

export interface Organization {
  id: string;
  name: string;
  kind: OrgKind;
  plan: Plan;
  /** Estudiantes licenciados. */
  seats: number;
  /** Créditos de IA por mes. */
  aiCreditsMonthly: number;
  nit?: string;
  /** Código DANE del establecimiento educativo. */
  daneCode?: string;
  city?: string;
  settings: OrgSettings;
  createdBy: string;
  createdAt: number;
}

export interface Member {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  joinedAt: number;
}

export interface Invite {
  /** Email en minúsculas (también es el id del documento). */
  email: string;
  role: Role;
  orgId: string;
  orgName: string;
  invitedBy: string;
  createdAt: number;
}

export interface OrgRef {
  name: string;
  role: Role;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  /** Caché de membresías para el selector de organización. */
  orgs: Record<string, OrgRef>;
  activeOrgId?: string;
  /** Marca de que el banco y exámenes v1 ya se migraron. */
  legacyMigratedAt?: number;
}

export interface Group {
  id: string;
  /** Ej. "11-A". */
  name: string;
  /** Grado numérico (3, 5, 9, 11…) para filtros y simulacros. */
  grade?: number;
  year: number;
  /** Jornada: mañana, tarde, única… */
  shift?: string;
  /** Sede. */
  campus?: string;
}

export interface Student {
  id: string;
  /** Código numérico que el estudiante rellena en burbujas. */
  code: string;
  fullName: string;
  groupId: string | null;
  year: number;
  active: boolean;
}

/** Id determinista del espacio personal de un usuario. */
export function personalOrgId(uid: string): string {
  return `p_${uid}`;
}

export function canManageOrg(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function canManageAcademics(role: Role | null | undefined): boolean {
  return role === "admin" || role === "coordinator";
}
