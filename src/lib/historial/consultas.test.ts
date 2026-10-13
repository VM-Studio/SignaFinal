import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renglonesDeDescripcion } from "./consultas";

describe("repetir: renglones desde la descripción de un pedido viejo", () => {
  it("cantidad adelante o atrás, y líneas sin cantidad", () => {
    expect(renglonesDeDescripcion("Cemento Portland, 40 bolsas")).toEqual([{ descripcion: "Cemento Portland", cantidad: "40", unidad: "bolsas" }]);
    expect(renglonesDeDescripcion("20 barras Hierro del 12\nArena fina")).toEqual([
      { cantidad: "20", unidad: "barras", descripcion: "Hierro del 12" },
      { descripcion: "Arena fina", cantidad: "", unidad: "u" },
    ]);
  });
  it("una lista adjunta no tiene renglones", () => {
    expect(renglonesDeDescripcion("Ver lista adjunta (planilla.xlsx)")).toEqual([]);
  });
});
