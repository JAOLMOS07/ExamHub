import Anthropic from "@anthropic-ai/sdk";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Cliente de Claude para ExamHub.
 *
 * - Modelo por defecto: Claude Opus 5.5. Se puede cambiar con la
 *   variable de entorno CLAUDE_MODEL sin tocar código.
 * - Salida JSON garantizada con `output_config.format` (json_schema).
 * - El system prompt (estable) se cachea para abaratar llamadas repetidas.
 * - Fallback del lado del servidor: si el modelo rechaza la solicitud
 *   por sus salvaguardas, la API reintenta con el modelo recomendado.
 */
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

type Effort = "low" | "medium" | "high";

export interface StructuredCall {
  apiKey: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort: Effort;
  maxTokens?: number;
}

export async function callStructured<T>(call: StructuredCall): Promise<T> {
  const client = new Anthropic({ apiKey: call.apiKey });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: call.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      output_config: {
        effort: call.effort,
        format: { type: "json_schema", schema: call.schema },
      },
      messages: [{ role: "user", content: call.user }],
    });
  } catch (err) {
    throw toHttpsError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new HttpsError(
      "failed-precondition",
      "La IA no pudo procesar esta solicitud. Reformula el tema o el contenido."
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new HttpsError(
      "resource-exhausted",
      "La respuesta fue demasiado larga. Pide menos preguntas por vez."
    );
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpsError("internal", "La IA devolvió un formato inesperado. Reintenta.");
  }
}

function toHttpsError(err: unknown): HttpsError {
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpsError("resource-exhausted", "El servicio de IA está ocupado. Reintenta en un minuto.");
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[IA] Credencial de Anthropic inválida:", err.message);
    return new HttpsError("internal", "La IA no está configurada correctamente.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[IA] Solicitud inválida:", err.message);
    return new HttpsError("invalid-argument", "La solicitud a la IA no es válida.");
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`[IA] Error ${err.status}:`, err.message);
    return new HttpsError("unavailable", "La IA no está disponible en este momento. Reintenta.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpsError("unavailable", "No pudimos conectar con la IA. Reintenta.");
  }
  console.error("[IA] Error inesperado:", err);
  return new HttpsError("internal", "Error inesperado de la IA.");
}
