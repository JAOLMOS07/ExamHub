import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { callStructured } from "./claude";
import {
  ITEM_DESIGN_SYSTEM,
  REPORT_SYSTEM,
  REVIEW_SYSTEM,
  TAG_SYSTEM,
  generateSchema,
  reportSchema,
  reviewSchema,
  tagSchema,
} from "./prompts";
import { getCompetency, getTest } from "./saber11";

initializeApp();
const db = getFirestore();

/** API key de Anthropic en Secret Manager:
 *    firebase functions:secrets:set ANTHROPIC_API_KEY */
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const callableOpts = {
  secrets: [ANTHROPIC_API_KEY],
  region: "us-central1",
  timeoutSeconds: 300,
  memory: "512MiB" as const,
  maxInstances: 10,
};

// ---------------------------------------------------------------------------
//  Seguridad y créditos
// ---------------------------------------------------------------------------

/** Valida sesión + membresía y descuenta créditos del mes (transacción). */
async function authorize(req: CallableRequest<any>, cost: number): Promise<string> {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión para usar la IA.");
  const orgId = String(req.data?.orgId ?? "");
  if (!orgId) throw new HttpsError("invalid-argument", "Falta la organización.");

  const orgRef = db.doc(`orgs/${orgId}`);
  const memberRef = db.doc(`orgs/${orgId}/members/${uid}`);
  const period = new Date().toISOString().slice(0, 7);
  const usageRef = db.doc(`orgs/${orgId}/usage/${period}`);

  await db.runTransaction(async (tx) => {
    const [org, member, usage] = await Promise.all([
      tx.get(orgRef),
      tx.get(memberRef),
      tx.get(usageRef),
    ]);
    if (!member.exists) throw new HttpsError("permission-denied", "No perteneces a esta organización.");
    const limit = Number(org.get("aiCreditsMonthly") ?? 0);
    const used = Number(usage.get("credits") ?? 0);
    if (used + cost > limit) {
      throw new HttpsError(
        "resource-exhausted",
        `Se agotaron los créditos de IA del mes (${used}/${limit}).`
      );
    }
    tx.set(
      usageRef,
      {
        credits: FieldValue.increment(cost),
        calls: FieldValue.increment(1),
        [`byUser.${uid}`]: FieldValue.increment(cost),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  });
  return uid;
}

function str(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

// ---------------------------------------------------------------------------
//  Generar ítems tipo ICFES
// ---------------------------------------------------------------------------

export const aiGenerateItems = onCall(callableOpts, async (req) => {
  const d = req.data ?? {};
  const test = getTest(d.test);
  if (!test) throw new HttpsError("invalid-argument", "Prueba ICFES inválida.");
  const count = Math.min(10, Math.max(1, Math.floor(Number(d.count) || 3)));
  await authorize(req, count);

  const competency = getCompetency(d.test, d.competency);
  const component = test.components?.find((c) => c.id === d.component);
  const lines = [
    `Genera ${count} ítems para la prueba ${test.label} (${test.id}).`,
    competency
      ? `Todos deben evaluar la competencia ${competency.id} (${competency.label}).`
      : "Distribúyelos entre las competencias de la prueba.",
    component ? `Componente: ${component.label}.` : "",
    `Grado: ${str(d.grade, 20) || "11"}.`,
    d.topic ? `Tema o contenido: ${str(d.topic, 300)}.` : "",
    d.difficulty ? `Dificultad objetivo: ${Number(d.difficulty)} (1 fácil, 2 media, 3 difícil).` : "Mezcla dificultades.",
    `Cada ítem con ${test.id === "ingles" ? "3 o más" : "4"} opciones.`,
    d.withStimulus
      ? "Escribe primero un contexto común (lectura, situación o tabla descrita en texto, 150 a 400 palabras) y haz que todos los ítems dependan de él."
      : "Cada ítem trae su propio contexto breve dentro del enunciado; deja el contexto común con título y texto vacíos.",
  ].filter(Boolean);

  const result = await callStructured<{
    stimulus: { title: string; text: string };
    items: {
      stem: string;
      options: string[];
      correctIndex: number;
      rationale: string;
      competency: string;
      difficulty: number;
    }[];
  }>({
    apiKey: ANTHROPIC_API_KEY.value(),
    system: ITEM_DESIGN_SYSTEM,
    user: lines.join("\n"),
    schema: generateSchema,
    effort: "high",
  });

  // Validación defensiva antes de devolver al cliente.
  const items = (result.items ?? [])
    .filter(
      (it) =>
        it.stem?.trim() &&
        Array.isArray(it.options) &&
        it.options.length >= 2 &&
        it.correctIndex >= 0 &&
        it.correctIndex < it.options.length
    )
    .map((it) => ({
      ...it,
      competency: test.competencies.some((c) => c.id === it.competency)
        ? it.competency
        : competency?.id ?? null,
    }));
  if (items.length === 0) {
    throw new HttpsError("internal", "La IA no produjo ítems válidos. Reintenta.");
  }
  return {
    test: test.id,
    component: component?.id ?? null,
    stimulus: result.stimulus?.text?.trim() ? result.stimulus : null,
    items,
  };
});

// ---------------------------------------------------------------------------
//  Revisar un ítem
// ---------------------------------------------------------------------------

export const aiReviewItem = onCall(callableOpts, async (req) => {
  await authorize(req, 1);
  const it = req.data?.item ?? {};
  const options: { text: string; correct: boolean }[] = Array.isArray(it.options)
    ? it.options.slice(0, 12)
    : [];
  const user = [
    `Grado: ${str(it.grade, 20) || "no indicado"}`,
    `Alineación declarada: ${str(it.test, 40) || "ninguna"} / ${str(it.competency, 60) || "ninguna"}`,
    `Tipo: ${str(it.kind, 40)}`,
    `Enunciado:\n${str(it.stem, 6000)}`,
    options.length
      ? `Opciones:\n${options
          .map((o, i) => `${String.fromCharCode(65 + i)}. ${str(o.text, 1000)}${o.correct ? "  [CLAVE]" : ""}`)
          .join("\n")}`
      : "Sin opciones (pregunta abierta o numérica).",
  ].join("\n\n");
  return callStructured({
    apiKey: ANTHROPIC_API_KEY.value(),
    system: REVIEW_SYSTEM,
    user,
    schema: reviewSchema,
    effort: "medium",
  });
});

// ---------------------------------------------------------------------------
//  Etiquetar ítems (alineación masiva del banco)
// ---------------------------------------------------------------------------

export const aiTagItems = onCall(callableOpts, async (req) => {
  const items: { id: string; stem: string; options?: string[] }[] = Array.isArray(req.data?.items)
    ? req.data.items.slice(0, 25)
    : [];
  if (items.length === 0) throw new HttpsError("invalid-argument", "No hay preguntas para clasificar.");
  await authorize(req, Math.ceil(items.length / 10));
  const user = items
    .map(
      (it) =>
        `id: ${str(it.id, 64)}\n${str(it.stem, 2000)}${
          it.options?.length ? "\n" + it.options.map((o) => `- ${str(o, 300)}`).join("\n") : ""
        }`
    )
    .join("\n\n---\n\n");
  return callStructured({
    apiKey: ANTHROPIC_API_KEY.value(),
    system: TAG_SYSTEM,
    user,
    schema: tagSchema,
    effort: "low",
  });
});

// ---------------------------------------------------------------------------
//  Informe pedagógico de una evaluación (solo datos agregados)
// ---------------------------------------------------------------------------

export const aiAssessmentReport = onCall(callableOpts, async (req) => {
  await authorize(req, 3);
  const orgId = String(req.data.orgId);
  const assessmentId = str(req.data?.assessmentId, 128);
  const groupId = req.data?.groupId ? str(req.data.groupId, 128) : null;
  const base = db.doc(`orgs/${orgId}/assessments/${assessmentId}`);
  const assessment = await base.get();
  if (!assessment.exists) throw new HttpsError("not-found", "No encontramos la evaluación.");

  let responsesQuery: FirebaseFirestore.Query = base.collection("responses");
  if (groupId) responsesQuery = responsesQuery.where("groupId", "==", groupId);
  const [responses, snapshot] = await Promise.all([
    responsesQuery.get(),
    base.collection("items").get(),
  ]);
  if (responses.empty) throw new HttpsError("failed-precondition", "Aún no hay respuestas calificadas.");

  const forms: { id: string; key: { itemId: string | null; letter: string | null }[] }[] =
    assessment.get("forms") ?? [];
  const keyByForm = new Map(forms.map((f) => [f.id, f.key]));
  const stems = new Map(snapshot.docs.map((d) => [d.id, str(d.get("name"), 220)]));

  const testAcc = new Map<string, number[]>();
  const compAcc = new Map<string, { c: number; t: number }>();
  const itemAcc = new Map<string, { c: number; n: number }>();
  const globals: number[] = [];

  for (const r of responses.docs) {
    const b = r.get("breakdown") ?? {};
    for (const [testId, t] of Object.entries<any>(b.byTest ?? {})) {
      if (!testAcc.has(testId)) testAcc.set(testId, []);
      testAcc.get(testId)!.push(Number(t.score) || 0);
    }
    for (const [k, v] of Object.entries<any>(b.byCompetency ?? {})) {
      const a = compAcc.get(k) ?? { c: 0, t: 0 };
      a.c += Number(v.correct) || 0;
      a.t += Number(v.total) || 0;
      compAcc.set(k, a);
    }
    if (typeof b.global === "number") globals.push(b.global);
    const key = keyByForm.get(r.get("formId")) ?? [];
    const answers: unknown[] = r.get("answers") ?? [];
    key.forEach((k, i) => {
      if (!k.itemId || k.letter === null) return;
      const a = itemAcc.get(k.itemId) ?? { c: 0, n: 0 };
      a.n++;
      if (answers[i] === k.letter) a.c++;
      itemAcc.set(k.itemId, a);
    });
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const lines: string[] = [
    `Evaluación: ${str(assessment.get("title"), 120)} (${assessment.get("type") === "simulacro" ? "simulacro" : "evaluación de aula"})`,
    `Estudiantes calificados: ${responses.size}${groupId ? " (un solo grupo)" : ""}`,
  ];
  if (globals.length) lines.push(`Puntaje global estimado promedio: ${avg(globals)} / 500`);
  lines.push("", "Promedio por prueba (0-100):");
  for (const [testId, scores] of testAcc) {
    lines.push(`- ${getTest(testId)?.label ?? testId}: ${avg(scores)}`);
  }
  lines.push("", "Porcentaje de aciertos por competencia:");
  for (const [k, a] of compAcc) {
    const [testId, compId] = k.split(":");
    const label = getCompetency(testId, compId)?.label ?? compId;
    lines.push(`- ${getTest(testId)?.label ?? testId} / ${label}: ${a.t ? Math.round((a.c / a.t) * 100) : 0}%`);
  }
  const hardest = [...itemAcc.entries()]
    .filter(([, a]) => a.n >= 5)
    .map(([id, a]) => ({ id, p: a.c / a.n }))
    .sort((x, y) => x.p - y.p)
    .slice(0, 8);
  if (hardest.length) {
    lines.push("", "Preguntas con menor porcentaje de acierto:");
    for (const h of hardest) {
      lines.push(`- ${Math.round(h.p * 100)}% de acierto: "${stems.get(h.id) ?? h.id}"`);
    }
  }

  const report = await callStructured<Record<string, unknown>>({
    apiKey: ANTHROPIC_API_KEY.value(),
    system: REPORT_SYSTEM,
    user: lines.join("\n"),
    schema: reportSchema,
    effort: "medium",
  });
  const saved = { ...report, groupId, responses: responses.size, createdAt: Date.now(), createdBy: req.auth!.uid };
  await db.doc(`orgs/${orgId}/stats/${assessmentId}_${groupId ?? "all"}`).set({ aiReport: saved }, { merge: true });
  return saved;
});
