import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "@angular/fire/firestore";
import { firstValueFrom } from "rxjs";
import { filter, take } from "rxjs/operators";
import { ExamService } from "./ExamService.service";
import { GradingService } from "./grading.service";
import { OrgService } from "./org.service";
import { TenantService } from "./tenant.service";
import { Document } from "../models/folder.model";
import { FormDef, ResponseDoc } from "../models/assessment.model";
import { DEFAULT_ORG_SETTINGS } from "../models/org.model";
import { parseBankJson } from "../domain/bankImport";
import {
  DEMO_ASSESSMENT_PREFIX,
  DEMO_FOLDER,
  DEMO_TAG,
  demoStudents,
  simulateAnswers,
} from "../domain/demoData";
import { buildForm, formLabel, hasBubbles } from "../domain/formBuilder";
import { assignForms } from "../domain/roster";
import { createRng } from "../domain/rng";
import { scoreResponse, toScale } from "../domain/scoring";
import { computeSheetLayout } from "../domain/answerSheetLayout";
import { ALPHABET } from "../utils/alphabet.const";

const DAY = 24 * 60 * 60 * 1000;

/**
 * "example": todo marcado como ejemplo, se borra con un clic.
 * "showcase": colegio de presentación para ventas y videos, sin marcas
 * (solo administradores de la plataforma, en una cuenta dedicada).
 */
export type DemoMode = "example" | "showcase";

interface DemoSim {
  title: string;
  shift: number;
  daysAgo: number;
  seed: number;
  /** Índices de los grupos que lo presentan. */
  groups: number[];
  grade: string;
  type?: "quiz" | "simulacro";
  /** Solo preguntas de esta prueba (quices). */
  test?: string;
}

const PLAN: Record<DemoMode, { folder: string; groups: string[]; perGroup: number; sims: DemoSim[] }> = {
  example: {
    folder: DEMO_FOLDER,
    groups: [`11-A ${DEMO_TAG}`, `11-B ${DEMO_TAG}`],
    perGroup: 15,
    sims: [
      { title: `${DEMO_ASSESSMENT_PREFIX} Simulacro diagnóstico`, shift: -0.35, daysAgo: 42, seed: 11, groups: [0, 1], grade: "11" },
      { title: `${DEMO_ASSESSMENT_PREFIX} Simulacro 2`, shift: 0, daysAgo: 7, seed: 29, groups: [0, 1], grade: "11" },
    ],
  },
  showcase: {
    folder: "Banco Saber 11",
    groups: ["11-A", "11-B", "10-A"],
    perGroup: 20,
    sims: [
      { title: "Simulacro diagnóstico", shift: -0.35, daysAgo: 70, seed: 11, groups: [0, 1], grade: "11" },
      { title: "Simulacro 2", shift: 0, daysAgo: 35, seed: 29, groups: [0, 1], grade: "11" },
      { title: "Simulacro 3", shift: 0.3, daysAgo: 6, seed: 47, groups: [0, 1], grade: "11" },
      { title: "Simulacro diagnóstico grado 10", shift: -0.5, daysAgo: 14, seed: 61, groups: [2], grade: "10" },
      { title: "Quiz de Matemáticas", shift: -0.1, daysAgo: 3, seed: 73, groups: [2], grade: "10", type: "quiz", test: "matematicas" },
    ],
  },
};

/**
 * Carga (y borra) un colegio de ejemplo para demos: banco Saber 11,
 * dos grupos con 15 estudiantes cada uno y dos simulacros calificados
 * con respuestas simuladas. Todo queda marcado con "(ejemplo)" /
 * "[Ejemplo]" para poder borrarlo sin tocar datos reales.
 */
@Injectable({ providedIn: "root" })
export class DemoService {
  constructor(
    private firestore: Firestore,
    private tenant: TenantService,
    private exams: ExamService,
    private grading: GradingService,
    private org: OrgService
  ) {}

  async seed(progress: (msg: string) => void = () => {}, mode: DemoMode = "example"): Promise<void> {
    const plan = PLAN[mode];
    const year = new Date().getFullYear();
    const groupNames = plan.groups;

    progress("Cargando el banco de preguntas…");
    const raw = await fetch("assets/demo/banco-saber11.json").then((r) => r.text());
    const parsed = parseBankJson(raw);
    const root = { name: "", questions: [], passages: [], folders: [{ ...parsed.root, name: plan.folder }] };
    const { items } = await this.exams.importTree(["1"], root, "import");

    progress("Creando grupos y estudiantes…");
    const fake = demoStudents(groupNames, plan.perGroup);
    const groups = await firstValueFrom(this.org.groups$());
    await this.org.importStudents(
      fake.map((s) => ({ code: s.code, fullName: s.fullName, group: s.group })),
      { year, defaultGroupId: null, existing: [], groups }
    );
    const [allGroups, allStudents] = await Promise.all([
      firstValueFrom(this.org.groups$().pipe(filter((g) => groupNames.every((n) => g.some((x) => x.name === n))), take(1))),
      firstValueFrom(this.org.students$().pipe(filter((s) => fake.every((f) => s.some((x) => x.code === f.code))), take(1))),
    ]);
    const demoGroups = groupNames.map((n) => allGroups.find((g) => g.name === n && g.year === year)!);
    const abilityByCode = new Map(fake.map((f) => [f.code, f.ability]));

    for (const sim of plan.sims) {
      progress(`Calificando "${sim.title.replace(DEMO_ASSESSMENT_PREFIX, "").trim()}"…`);
      const groupIds = sim.groups.map((i) => demoGroups[i].id);
      const students = allStudents.filter((s) => s.groupId && groupIds.includes(s.groupId));
      const simItems = sim.test ? items.filter((it) => it.test === sim.test) : items;
      await this.createGradedAssessment(sim, simItems, students, groupIds, abilityByCode);
    }
  }

  private async createGradedAssessment(
    sim: DemoSim,
    items: Document[],
    students: { id: string; fullName: string; groupId: string | null; code: string }[],
    groupIds: string[],
    abilityByCode: Map<string, number>
  ): Promise<void> {
    const letterCount = 4;
    const letters = ALPHABET.slice(0, letterCount);
    const forms: FormDef[] = [];
    let totalPages = 1;
    for (let i = 0; i < 2; i++) {
      const seed = sim.seed * 1000 + i;
      const form = buildForm(items, { seed, groupByTest: true });
      forms.push({ id: `v${i + 1}`, label: formLabel(i + 1), seed, key: form.key });
      totalPages = Math.max(
        totalPages,
        computeSheetLayout({
          questionLetters: form.questions.map((q) => (hasBubbles(q) ? q.options?.length ?? 0 : 0)),
          letterCount,
          codeDigits: 0,
          balanced: true,
          geometry: 3,
        }).pages.length
      );
    }
    const roster = assignForms(students, groupIds, forms.map((f) => f.id));
    const assessment = await this.grading.saveAssessment(
      {
        id: crypto.randomUUID(),
        title: sim.title,
        type: sim.type ?? "simulacro",
        taxonomyId: "saber11",
        groupIds,
        totalQuestions: Math.max(...forms.map((f) => f.key.length)),
        letters,
        sheet: { version: 3, letterCount, codeDigits: 0, totalPages, balanced: true },
        forms,
        maxScore: DEFAULT_ORG_SETTINGS.maxScore,
        identification: "personalized",
        roster,
        grade: sim.grade,
      },
      items
    );

    const difficulty = new Map(items.map((it) => [it.id, it.difficulty ?? 2]));
    const rng = createRng(sim.seed);
    const { orgId, uid } = await this.tenant.requireContext();
    const batch = writeBatch(this.firestore);
    const baseTime = Date.now() - sim.daysAgo * DAY;
    // Fecha del simulacro en el pasado: los reportes de evolución la usan.
    batch.update(doc(this.firestore, `orgs/${orgId}/assessments/${assessment.id}`), {
      createdAt: baseTime,
    });
    roster.forEach((entry, i) => {
      const student = students.find((s) => s.id === entry.studentId)!;
      const form = forms.find((f) => f.id === entry.formId)!;
      const answers = simulateAnswers(
        form.key,
        letters,
        abilityByCode.get(student.code) ?? 0,
        (id) => difficulty.get(id ?? "") ?? 2,
        rng,
        sim.shift
      );
      const breakdown = scoreResponse(form.key, answers);
      const id = crypto.randomUUID();
      const response: ResponseDoc = {
        id,
        assessmentId: assessment.id,
        formId: form.id,
        studentId: student.id,
        studentName: student.fullName,
        studentCode: student.code,
        ...(student.groupId ? { groupId: student.groupId } : {}),
        answers,
        source: "omr",
        breakdown,
        score: toScale(breakdown.correct, breakdown.total, assessment.maxScore),
        scannedBy: uid,
        scannedAt: baseTime + i * 60_000,
      };
      batch.set(doc(this.firestore, `orgs/${orgId}/assessments/${assessment.id}/responses/${id}`), response);
    });
    await batch.commit();
  }

  /** ¿Ya hay datos de ejemplo (o de presentación) en la organización activa? */
  async hasDemo(mode: DemoMode = "example"): Promise<boolean> {
    const orgId = await this.tenant.requireOrgId();
    const snap = await getDocs(
      query(collection(this.firestore, `orgs/${orgId}/folders`), where("name", "==", PLAN[mode].folder))
    );
    return !snap.empty;
  }

  /** Borra todo lo marcado como ejemplo. */
  async clear(progress: (msg: string) => void = () => {}): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const base = `orgs/${orgId}`;

    progress("Borrando simulacros de ejemplo…");
    const assessments = await getDocs(collection(this.firestore, `${base}/assessments`));
    for (const a of assessments.docs) {
      if (String(a.data()["title"] ?? "").startsWith(DEMO_ASSESSMENT_PREFIX)) {
        await this.grading.deleteAssessment(a.id);
      }
    }

    progress("Borrando estudiantes y grupos de ejemplo…");
    const groups = await getDocs(collection(this.firestore, `${base}/groups`));
    const demoGroups = groups.docs.filter((g) => String(g.data()["name"]).endsWith(DEMO_TAG));
    for (const g of demoGroups) {
      const students = await getDocs(
        query(collection(this.firestore, `${base}/students`), where("groupId", "==", g.id))
      );
      const batch = writeBatch(this.firestore);
      students.docs.forEach((s) => batch.delete(s.ref));
      batch.delete(g.ref);
      await batch.commit();
    }

    progress("Borrando el banco de ejemplo…");
    const folders = await getDocs(
      query(collection(this.firestore, `${base}/folders`), where("name", "==", DEMO_FOLDER))
    );
    for (const f of folders.docs) await this.exams.deleteDocumentAndCollection([], f.id);
  }
}
