import { describe, expect, it } from "vitest";
import { lineaARenglon, pasarARenglones } from "./renglones";

describe("Pasar a renglones (líneas reales de la planilla)", () => {
  it("cantidad adelante con guion: 40 - bolsas de cemento", () => {
    expect(lineaARenglon("40 - bolsas de cemento")).toEqual({ cantidad: 40, unidad: "bolsas", descripcion: "cemento" });
  });
  it("16 Unidades - Protex Seal 77 Flex Impermeabilizante.", () => {
    expect(lineaARenglon("16 Unidades - Protex Seal 77 Flex Impermeabilizante.")).toEqual({ cantidad: 16, unidad: "u", descripcion: "Protex Seal 77 Flex Impermeabilizante" });
  });
  it("1 unidad: reja de ventilación esmaltada 15x15 blanco", () => {
    expect(lineaARenglon("1 unidad: reja de ventilación esmaltada 15x15 blanco")).toEqual({ cantidad: 1, unidad: "u", descripcion: "reja de ventilación esmaltada 15x15 blanco" });
  });
  it("sin unidad: 10 BOLSAS DE CEMENTO / 3 rollos malla seguridad", () => {
    expect(lineaARenglon("10 BOLSAS DE CEMENTO")).toEqual({ cantidad: 10, unidad: "bolsas", descripcion: "CEMENTO" });
    expect(lineaARenglon("3 rollos malla seguridad")).toEqual({ cantidad: 3, unidad: "rollos", descripcion: "malla seguridad" });
  });
  it("numeración de la lista y cantidad atrás: 2) Corte y Plegado Dº40,5 Prep. (T. x 2.44) 21,50 Un", () => {
    expect(lineaARenglon("2) Corte y Plegado Dº40,5 Prep. (T. x 2.44) 21,50 Un")).toEqual({ cantidad: 21.5, unidad: "u", descripcion: "Corte y Plegado Dº40,5 Prep. (T. x 2.44)" });
  });
  it("sin cantidad: queda 1 u con la línea entera (Compras la corrige)", () => {
    expect(lineaARenglon("4)Válvulas y Broncería.")).toEqual({ cantidad: 1, unidad: "u", descripcion: "Válvulas y Broncería" });
    expect(lineaARenglon("HOMIGON 19 m3 + corte de h25")).toEqual({ cantidad: 1, unidad: "u", descripcion: "HOMIGON 19 m3 + corte de h25" });
  });
  it("una lista entera: ignora líneas vacías y '???'", () => {
    expect(pasarARenglones("40 - bolsas de cemento\n\n5) ???\n24 unidades: rejilla 15x25")).toEqual([
      { cantidad: 40, unidad: "bolsas", descripcion: "cemento" },
      { cantidad: 24, unidad: "u", descripcion: "rejilla 15x25" },
    ]);
  });
  it("decimales con coma y m³: 19,5 m3 de hormigón H25", () => {
    expect(lineaARenglon("19,5 m3 de hormigón H25")).toEqual({ cantidad: 19.5, unidad: "m³", descripcion: "hormigón H25" });
  });
});
