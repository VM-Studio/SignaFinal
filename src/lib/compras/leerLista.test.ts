import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { leerListaExcel, textoDeLista } from "./leerLista";

async function libro(hojas: { nombre: string; filas: unknown[][]; oculta?: boolean; combinar?: string }[]) {
  const wb = new ExcelJS.Workbook();
  for (const h of hojas) {
    const ws = wb.addWorksheet(h.nombre, h.oculta ? { state: "hidden" } : undefined);
    h.filas.forEach((f) => ws.addRow(f));
    if (h.combinar) ws.mergeCells(h.combinar);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("leerListaExcel: la lista de materiales adjunta pasa al Detalle del Pedido", () => {
  it("con encabezado: título arriba, columnas Ítem · Descripción · Cant. · Unidad · Precio, secciones y total", async () => {
    const datos = await libro([{
      nombre: "Materiales",
      combinar: "A1:E1",
      filas: [
        ["LISTA DE MATERIALES - OBRA DARWIN"],
        [],
        ["Ítem", "Descripción", "Cant.", "Unidad", "Precio unitario"],
        [null, "ALBAÑILERÍA"],
        [1, "Cemento Portland 50 kg", 40, "bolsas", 9800],
        [2, "Arena gruesa", "6", "m3", 30000],
        [3, "Hierro del 8", 12.5, "Barras", 7000],
        [4, "Malla sima 15x15", { formula: "2*5", result: 10 }, "", 0],
        [null, "Total", null, null, 1234567],
      ],
    }]);
    const r = await leerListaExcel(datos);
    expect(r).toEqual([
      { descripcion: "ALBAÑILERÍA", cantidad: null, unidad: null },
      { descripcion: "Cemento Portland 50 kg", cantidad: 40, unidad: "bolsas" },
      { descripcion: "Arena gruesa", cantidad: 6, unidad: "m³" },
      { descripcion: "Hierro del 8", cantidad: 12.5, unidad: "barras" },
      { descripcion: "Malla sima 15x15", cantidad: 10, unidad: "u" },
    ]);
    expect(textoDeLista(r)).toBe("ALBAÑILERÍA\n40 bolsas Cemento Portland 50 kg\n6 m³ Arena gruesa\n12,5 barras Hierro del 8\n10 u Malla sima 15x15");
  });

  it("encabezado con Material y Cantidad (la unidad viene en la cantidad)", async () => {
    const datos = await libro([{ nombre: "Hoja1", filas: [["Material", "Cantidad"], ["Bolsas de cal", "20 bolsas"], ["Ladrillo hueco 12", "1.200"], ["Tornillos", "1,5 kg"]] }]);
    expect(await leerListaExcel(datos)).toEqual([
      { descripcion: "Bolsas de cal", cantidad: 20, unidad: "bolsas" },
      { descripcion: "Ladrillo hueco 12", cantidad: 1200, unidad: "u" },
      { descripcion: "Tornillos", cantidad: 1.5, unidad: "kg" },
    ]);
  });

  it("sin encabezado: texto y número a la derecha; salta títulos sin cantidad", async () => {
    const datos = await libro([{ nombre: "Lista", filas: [["Pedido Darwin"], ["Cemento", 40, "bolsas"], [1, "Arena fina", 3, "m3"], ["Caños PVC 110", 8]] }]);
    expect(await leerListaExcel(datos)).toEqual([
      { descripcion: "Cemento", cantidad: 40, unidad: "bolsas" },
      { descripcion: "Arena fina", cantidad: 3, unidad: "m³" },
      { descripcion: "Caños PVC 110", cantidad: 8, unidad: "u" },
    ]);
  });

  it("salta hojas ocultas y vacías; un archivo que no es Excel no rompe", async () => {
    const datos = await libro([
      { nombre: "Oculta", oculta: true, filas: [["Descripción", "Cantidad"], ["No va", 1]] },
      { nombre: "Vacía", filas: [] },
      { nombre: "Lista", filas: [["Descripción", "Cantidad"], ["Sí va", 2]] },
    ]);
    expect(await leerListaExcel(datos)).toEqual([{ descripcion: "Sí va", cantidad: 2, unidad: "u" }]);
    expect(await leerListaExcel(Buffer.from("no soy un excel"))).toEqual([]);
  });
});
