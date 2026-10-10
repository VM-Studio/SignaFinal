import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { aNumero, leerPlanilla, renglonesDeGrilla } from "./importar";

describe("importar renglones de una planilla", () => {
  it("lee un Excel de ejemplo (con título arriba y encabezados)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedido Darwin");
    ws.addRow(["Lista de materiales - Obra Darwin"]);
    ws.addRow([]);
    ws.addRow(["Descripción", "Cantidad", "Unidad"]);
    ws.addRow(["Cemento Portland x 50 kg", 40, "bolsas"]);
    ws.addRow(["Hierro del 8", "20", "barras"]);
    ws.addRow(["Arena gruesa", "6,5", "m3"]);
    ws.addRow(["Total", 66.5, ""]);
    const r = await leerPlanilla(Buffer.from(await wb.xlsx.writeBuffer()), "planilla-darwin.xlsx");
    expect(r).toEqual({
      ok: true, hoja: "Pedido Darwin",
      renglones: [
        { descripcion: "Cemento Portland x 50 kg", cantidad: 40, unidad: "bolsas" },
        { descripcion: "Hierro del 8", cantidad: 20, unidad: "barras" },
        { descripcion: "Arena gruesa", cantidad: 6.5, unidad: "m3" },
      ],
    });
  });

  it("CSV con punto y coma, sin columna de unidad (\"40 bolsas\" en cantidad)", async () => {
    const r = await leerPlanilla(Buffer.from("Material;Cant\nCemento;40 bolsas\nCal;15 bolsas\n"), "lista.csv");
    expect(r).toEqual({ ok: true, hoja: null, renglones: [{ descripcion: "Cemento", cantidad: 40, unidad: "bolsas" }, { descripcion: "Cal", cantidad: 15, unidad: "bolsas" }] });
  });

  it("sin encabezados: primera columna de texto y primera de números", () => {
    expect(renglonesDeGrilla([["Ladrillo hueco 12", 3000], ["Ladrillo común", 500]])).toEqual([
      { descripcion: "Ladrillo hueco 12", cantidad: 3000, unidad: "u" },
      { descripcion: "Ladrillo común", cantidad: 500, unidad: "u" },
    ]);
  });

  it("si no se puede leer, lo dice", async () => {
    expect(await leerPlanilla(Buffer.from("x"), "viejo.xls")).toMatchObject({ ok: false, motivo: expect.stringContaining(".xls") });
    expect(await leerPlanilla(Buffer.from("no es un excel"), "roto.xlsx")).toMatchObject({ ok: false });
    expect(await leerPlanilla(Buffer.from("%PDF"), "lista.pdf")).toMatchObject({ ok: false, motivo: expect.stringContaining("a mano") });
  });

  it("números en formato argentino", () => {
    expect(aNumero("1.250,5")).toBe(1250.5);
    expect(aNumero("1.250")).toBe(1250);
    expect(aNumero("40 bolsas")).toBe(40);
    expect(aNumero("")).toBeNull();
  });
});
