import { pickCornerSquares, pickMarked } from "./markDetection";
import { computeSheetLayout, legacySheetPage, SHEET_V2, SHEET_V3 } from "./answerSheetLayout";
import { assignForms, pendingFromRoster } from "./roster";
import { parseStudentsCsv } from "./studentsCsv";
import { decodeQrPayload, encodeQrPayload } from "../utils/qrPayload.util";
import { FIDUCIAL_POSITIONS } from "../utils/omrLayout.const";

describe("computeSheetLayout", () => {
  it("reparte un simulacro de 130 preguntas en varias páginas", () => {
    const layout = computeSheetLayout({
      questionLetters: new Array(130).fill(4),
      letterCount: 4,
      codeDigits: 6,
    });
    const perPage = layout.rowsPerColumn * layout.columns;
    expect(perPage).toBeGreaterThanOrEqual(100);
    expect(layout.pages.length).toBe(Math.ceil(130 / perPage));
    const all = layout.pages.flatMap((p) => p.questions.map((q) => q.index));
    expect(all).toEqual(Array.from({ length: 130 }, (_, i) => i));
  });

  it("todas las burbujas quedan dentro del área entre fiduciales", () => {
    const layout = computeSheetLayout({
      questionLetters: new Array(200).fill(5),
      letterCount: 5,
      codeDigits: 10,
    });
    const minX = FIDUCIAL_POSITIONS.tl.x + SHEET_V2.fiducialSize;
    const maxX = FIDUCIAL_POSITIONS.tr.x;
    const minY = FIDUCIAL_POSITIONS.tl.y + SHEET_V2.fiducialSize;
    const maxY = FIDUCIAL_POSITIONS.bl.y;
    for (const page of layout.pages) {
      const points = [
        ...page.questions.flatMap((q) => q.bubbles),
        ...page.codeColumns.flat(),
      ];
      for (const b of points) {
        expect(b.x - SHEET_V2.bubbleR).toBeGreaterThan(minX);
        expect(b.x + SHEET_V2.bubbleR).toBeLessThan(maxX);
        expect(b.y - SHEET_V2.bubbleR).toBeGreaterThan(minY);
        expect(b.y + SHEET_V2.bubbleR).toBeLessThan(maxY);
      }
    }
  });

  it("sin código del estudiante caben más preguntas por página", () => {
    const withCode = computeSheetLayout({ questionLetters: [], letterCount: 4, codeDigits: 6 });
    const noCode = computeSheetLayout({ questionLetters: [], letterCount: 4, codeDigits: 0 });
    expect(noCode.rowsPerColumn).toBeGreaterThan(withCode.rowsPerColumn);
  });

  it("las preguntas abiertas reservan fila pero no tienen burbujas", () => {
    const layout = computeSheetLayout({ questionLetters: [4, 0, 4], letterCount: 4, codeDigits: 0 });
    expect(layout.pages[0].questions[1].bubbles).toHaveLength(0);
  });

  it("balanceado: 14 preguntas en 2 columnas de 7 y 40 en 4 de 10", () => {
    const cols = (n: number) => {
      const page = computeSheetLayout({ questionLetters: new Array(n).fill(4), letterCount: 4, codeDigits: 6, balanced: true }).pages[0];
      const xs = new Set(page.questions.map((q) => q.numberPos.x));
      const rows = new Set(page.questions.map((q) => q.numberPos.y));
      return [xs.size, rows.size];
    };
    expect(cols(14)).toEqual([2, 7]);
    expect(cols(40)).toEqual([4, 10]);
  });

  it("balanceado: las burbujas siguen dentro del área entre fiduciales", () => {
    for (const n of [5, 14, 37, 130]) {
      const layout = computeSheetLayout({ questionLetters: new Array(n).fill(5), letterCount: 5, codeDigits: 8, balanced: true });
      for (const b of layout.pages.flatMap((p) => p.questions.flatMap((q) => q.bubbles))) {
        expect(b.x - SHEET_V2.bubbleR).toBeGreaterThan(FIDUCIAL_POSITIONS.tl.x + SHEET_V2.fiducialSize);
        expect(b.x + SHEET_V2.bubbleR).toBeLessThan(FIDUCIAL_POSITIONS.tr.x);
      }
      const all = layout.pages.flatMap((p) => p.questions.map((q) => q.index));
      expect(all).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("el layout legacy reproduce la hoja v1", () => {
    const page = legacySheetPage(10, 4);
    expect(page.questions).toHaveLength(10);
    expect(page.questions[0].bubbles[0]).toEqual({ x: 95, y: 295 });
  });
});

describe("QR", () => {
  it("v2 incluye la organización y se valida la firma", () => {
    const raw = encodeQrPayload({ orgId: "org1", examId: "ex", versionId: "v3", page: 2, totalPages: 3 });
    expect(raw.startsWith("EH|2|org1|")).toBe(true);
    expect(decodeQrPayload(raw)).toEqual({ orgId: "org1", examId: "ex", versionId: "v3", page: 2, totalPages: 3 });
    expect(decodeQrPayload(raw.replace("v3", "v4"))).toBeNull();
  });

  it("v3 lleva el estudiante de la hoja personalizada", () => {
    const raw = encodeQrPayload({ orgId: "o", examId: "e", versionId: "v1", page: 1, totalPages: 2, studentId: "stu9" });
    expect(raw.startsWith("EH|3|o|e|v1|1|2|stu9|")).toBe(true);
    expect(decodeQrPayload(raw)).toEqual({ orgId: "o", examId: "e", versionId: "v1", page: 1, totalPages: 2, studentId: "stu9" });
  });

  it("sigue leyendo QR v1", () => {
    const raw = encodeQrPayload({ examId: "a1b2", versionId: "v2", page: 1, totalPages: 1 });
    expect(raw.startsWith("EH|1|a1b2|")).toBe(true);
    expect(decodeQrPayload(raw)).toEqual({ examId: "a1b2", versionId: "v2", page: 1, totalPages: 1 });
  });
});

describe("parseStudentsCsv", () => {
  it("detecta encabezado y separador", () => {
    const r = parseStudentsCsv("Nombre;Código;Grupo\nAna Pérez;1001;11-A\nLuis Gómez;1002;11-B");
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { code: "1001", fullName: "Ana Pérez", group: "11-A" },
      { code: "1002", fullName: "Luis Gómez", group: "11-B" },
    ]);
  });

  it("sin encabezado asume código, nombre, grupo y reporta errores", () => {
    const r = parseStudentsCsv("1001,Ana\nabc,Luis\n1001,Repetido");
    expect(r.rows).toEqual([{ code: "1001", fullName: "Ana" }]);
    expect(r.errors).toHaveLength(2);
  });
});

describe("geometría v3", () => {
  it("sin código caben más preguntas y todo queda dentro de los fiduciales", () => {
    const v3 = computeSheetLayout({ questionLetters: new Array(300).fill(4), letterCount: 4, codeDigits: 0, balanced: true, geometry: 3 });
    expect(v3.rowsPerColumn * v3.columns).toBeGreaterThanOrEqual(140);
    for (const b of v3.pages.flatMap((p) => p.questions.flatMap((q) => q.bubbles))) {
      expect(b.y - SHEET_V2.bubbleR).toBeGreaterThan(SHEET_V3.qr.y + SHEET_V3.qr.fit);
      expect(b.y + SHEET_V2.bubbleR).toBeLessThan(FIDUCIAL_POSITIONS.bl.y);
    }
  });

  it("con código, la grilla empieza debajo del bloque de dígitos", () => {
    const v3 = computeSheetLayout({ questionLetters: [4], letterCount: 4, codeDigits: 8, geometry: 3 });
    const lastDigit = v3.pages[0].codeColumns[0][9].y;
    expect(v3.pages[0].questions[0].bubbles[0].y - SHEET_V2.bubbleR).toBeGreaterThan(lastDigit + SHEET_V2.bubbleR);
  });
});

describe("assignForms", () => {
  it("alterna formas por orden de lista dentro de cada grupo", () => {
    const r = assignForms(
      [
        { id: "3", fullName: "Carlos", groupId: "A" },
        { id: "1", fullName: "Ana", groupId: "A" },
        { id: "2", fullName: "Beto", groupId: "A" },
        { id: "4", fullName: "Diana", groupId: "B" },
      ],
      ["A", "B"],
      ["v1", "v2"]
    );
    expect(r.map((e) => [e.name, e.formId])).toEqual([
      ["Ana", "v1"], ["Beto", "v2"], ["Carlos", "v1"], ["Diana", "v1"],
    ]);
    expect(pendingFromRoster(r, ["1", "4"]).map((e) => e.name)).toEqual(["Beto", "Carlos"]);
  });
});

describe("pickMarked", () => {
  it("elige la única burbuja rellena", () => {
    expect(pickMarked([230, 60, 225, 228])).toBe(1);
  });
  it("devuelve null si todas están vacías", () => {
    expect(pickMarked([230, 228, 225, 231])).toBeNull();
  });
  it("detecta doble marca", () => {
    expect(pickMarked([70, 65, 225, 228])).toBe("MULTI");
  });
  it("tolera una marca clara junto a un borrón leve", () => {
    expect(pickMarked([40, 120, 225, 228])).toBe(0);
  });
});

describe("pickCornerSquares", () => {
  const aspect = (548 - 47) / (762 - 154);
  const sq = (cx: number, cy: number, area = 900) => ({ cx, cy, area });

  it("encuentra las esquinas en una hoja girada y con ruido", () => {
    const rot = (x: number, y: number) => {
      const a = (5 * Math.PI) / 180;
      return sq(x * Math.cos(a) - y * Math.sin(a) + 200, x * Math.sin(a) + y * Math.cos(a) + 80);
    };
    const tl = rot(47, 154);
    const tr = rot(548, 154);
    const bl = rot(47, 762);
    const br = rot(548, 762);
    const qrFinder = { ...rot(522, 177), area: 350 };
    const r = pickCornerSquares([qrFinder, br, tl, bl, tr], aspect);
    expect(r).toEqual({ tl, tr, bl, br });
  });

  it("ignora el contorno interior duplicado de una marca", () => {
    const inner = { cx: 47, cy: 762, area: 300 };
    const r = pickCornerSquares(
      [inner, sq(47, 154), sq(548, 154), sq(47, 762), sq(548, 762), { cx: 380, cy: 190, area: 2500 }],
      aspect
    );
    expect(r?.bl).toEqual(sq(47, 762));
  });

  it("rechaza geometrías que no son la hoja", () => {
    expect(pickCornerSquares([sq(0, 0), sq(100, 0), sq(0, 30), sq(100, 30)], aspect)).toBeNull();
  });
});
