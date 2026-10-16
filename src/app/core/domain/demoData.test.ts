import { demoStudents, simulateAnswers } from "./demoData";
import { createRng } from "./rng";
import { QuestionKind } from "../models/questionKind.enum";
import { KeyEntry } from "../models/assessment.model";

describe("datos de ejemplo", () => {
  it("crea estudiantes únicos y deterministas por grupo", () => {
    const a = demoStudents(["11-A", "11-B"], 15);
    expect(a).toHaveLength(30);
    expect(new Set(a.map((s) => s.fullName)).size).toBe(30);
    expect(a.filter((s) => s.group === "11-B")).toHaveLength(15);
    expect(demoStudents(["11-A", "11-B"], 15)).toEqual(a);
  });

  it("más habilidad, más aciertos; solo letras válidas", () => {
    const key: KeyEntry[] = Array.from({ length: 200 }, (_, i) => ({
      itemId: String(i),
      kind: QuestionKind.MULTIPLE_CHOICE_SINGLE,
      letter: "ABCD"[i % 4],
    }));
    const hits = (ability: number) =>
      simulateAnswers(key, ["A", "B", "C", "D"], ability, () => 2, createRng(1)).filter(
        (a, i) => a === key[i].letter
      ).length;
    expect(hits(1.5)).toBeGreaterThan(hits(-1.5) + 60);
    const all = simulateAnswers(key, ["A", "B", "C", "D"], 0, () => 2, createRng(3));
    expect(all.every((a) => a === null || "ABCD".includes(a))).toBe(true);
  });
});
