import { describe, expect, it } from "vitest";
import { textoLlegue, textoSalgo } from "./manual";

describe("texto del botón manual según el lugar de la parada actual", () => {
  it("proveedor", () => {
    expect(textoLlegue({ lugarTipo: "PROVEEDOR_SUCURSAL" })).toBe("Llegué al proveedor");
    expect(textoSalgo({ lugarTipo: "PROVEEDOR_SUCURSAL" })).toBe("Salgo del proveedor");
  });
  it("depósito: galpón o terreno por su etiqueta", () => {
    expect(textoLlegue({ lugarTipo: "DEPOSITO", etiqueta: "Galpón" })).toBe("Llegué al galpón");
    expect(textoSalgo({ lugarTipo: "DEPOSITO", etiqueta: "Galpón" })).toBe("Salgo del galpón");
    expect(textoLlegue({ lugarTipo: "DEPOSITO", etiqueta: "Terreno" })).toBe("Llegué al terreno");
    expect(textoLlegue({ lugarTipo: "DEPOSITO", etiqueta: null })).toBe("Llegué al depósito");
  });
  it("obra y sede", () => {
    expect(textoLlegue({ lugarTipo: "OBRA" })).toBe("Llegué a la obra");
    expect(textoLlegue({ lugarTipo: "OBRA_SEDE" })).toBe("Llegué a la obra");
    expect(textoSalgo({ lugarTipo: "OBRA" })).toBe("Salgo de la obra");
  });
  it("base", () => {
    expect(textoLlegue({ lugarTipo: "BASE" })).toBe("Llegué a la base");
    expect(textoSalgo({ lugarTipo: "BASE" })).toBe("Salgo de la base");
  });
});
