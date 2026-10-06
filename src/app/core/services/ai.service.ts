import { Injectable } from "@angular/core";
import { Functions, httpsCallable } from "@angular/fire/functions";
import { environment } from "../../../environments/environment";
import { TenantService } from "./tenant.service";

export interface ItemReview {
  qualityScore: number;
  issues: { severity: "alta" | "media" | "baja"; message: string }[];
  suggestedAlignment?: { test: string; competency: string };
}

export interface GeneratedItem {
  stem: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  competency: string | null;
  difficulty: number;
}

export interface GenerateResult {
  test: string;
  component: string | null;
  stimulus: { title: string; text: string } | null;
  items: GeneratedItem[];
}

export interface GenerateRequest {
  test: string;
  competency?: string;
  component?: string;
  grade?: string;
  topic?: string;
  count: number;
  difficulty?: number;
  withStimulus: boolean;
}

export interface AssessmentReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actions: string[];
  itemsToReview: string[];
  responses: number;
  createdAt: number;
}

/**
 * Puente con las Cloud Functions de IA (`functions/src/index.ts`).
 * La API key de Anthropic vive solo en el backend; el cliente envía el
 * orgId y el backend valida membresía y descuenta créditos.
 */
@Injectable({ providedIn: "root" })
export class AiService {
  readonly enabled = environment.features?.enableAi === true;

  constructor(private functions: Functions, private tenant: TenantService) {}

  private async call<T>(name: string, data: Record<string, unknown>): Promise<T> {
    if (!this.enabled) throw { code: "functions/unavailable" };
    const orgId = await this.tenant.requireOrgId();
    const fn = httpsCallable<Record<string, unknown>, T>(this.functions, name, {
      timeout: 300_000,
    });
    const res = await fn({ ...data, orgId });
    return res.data;
  }

  generateItems(req: GenerateRequest): Promise<GenerateResult> {
    return this.call("aiGenerateItems", { ...req });
  }

  reviewItem(item: {
    stem: string;
    kind: string;
    options: { text: string; correct: boolean }[];
    test?: string;
    competency?: string;
    grade?: string;
  }): Promise<ItemReview> {
    return this.call("aiReviewItem", { item });
  }

  tagItems(
    items: { id: string; stem: string; options?: string[] }[]
  ): Promise<{ tags: { id: string; test: string; competency: string; difficulty: number }[] }> {
    return this.call("aiTagItems", { items });
  }

  assessmentReport(assessmentId: string, groupId?: string | null): Promise<AssessmentReport> {
    return this.call("aiAssessmentReport", { assessmentId, groupId: groupId ?? null });
  }

  /** Mensaje para el docente a partir del error de la función. */
  friendlyError(err: any): string {
    const code: string = err?.code ?? "";
    if (code.endsWith("resource-exhausted")) {
      return err?.message || "Se agotaron los créditos de IA de este mes.";
    }
    if (code.endsWith("permission-denied")) return "No tienes permiso para usar la IA en esta organización.";
    if (code.endsWith("unauthenticated")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
    if (code.endsWith("unavailable")) return "La IA no está disponible en este momento.";
    if (code.endsWith("failed-precondition") || code.endsWith("invalid-argument") || code.endsWith("not-found")) {
      return err?.message || "La solicitud no es válida.";
    }
    return "La IA no pudo completar la solicitud. Reintenta en un momento.";
  }
}
