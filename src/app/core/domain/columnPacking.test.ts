import { estimateLines, packColumns } from "./columnPacking";

const opts = { firstPageHeight: 600, pageHeight: 650 };

describe("packColumns", () => {
  it("llena la izquierda, luego la derecha y luego otra página", () => {
    const blocks = Array.from({ length: 10 }, () => ({ height: 200 }));
    const segs = packColumns(blocks, opts);
    expect(segs).toEqual([
      { kind: "columns", left: [0, 1, 2], right: [3, 4, 5], newPage: false },
      { kind: "columns", left: [6, 7, 8], right: [9], newPage: true },
    ]);
  });

  it("no deja un encabezado solo al final de la columna", () => {
    const segs = packColumns(
      [{ height: 300 }, { height: 280 }, { height: 20, keepWithNext: true }, { height: 100 }],
      opts
    );
    expect(segs).toEqual([{ kind: "columns", left: [0, 1], right: [2, 3], newPage: false }]);
  });

  it("las lecturas largas van a ancho completo y el flujo sigue debajo", () => {
    const segs = packColumns(
      [{ height: 100 }, { height: 500, fullHeight: 250 }, { height: 100 }, { height: 100 }],
      opts
    );
    expect(segs).toEqual([
      { kind: "columns", left: [0], right: [], newPage: false },
      { kind: "full", index: 1, newPage: false },
      { kind: "columns", left: [2, 3], right: [], newPage: false },
    ]);
  });

  it("no deja páginas casi vacías: con 14 bloques chicos usa una sola página", () => {
    const segs = packColumns(Array.from({ length: 14 }, () => ({ height: 80 })), opts);
    expect(segs).toHaveLength(1);
  });
});

describe("estimateLines", () => {
  it("parte el texto según el ancho disponible", () => {
    expect(estimateLines("hola", 200, 10)).toBe(1);
    expect(estimateLines("x".repeat(200), 200, 10)).toBeGreaterThanOrEqual(5);
    expect(estimateLines("a\nb", 200, 10)).toBe(2);
  });
});
