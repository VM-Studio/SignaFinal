import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { generarPDFOC, type DatosPDFOC } from "./pdfOC";

const base: DatosPDFOC = {
  numero: "OC-2026-0012", fecha: new Date("2026-10-10T15:00:00Z"), fechaNecesaria: new Date("2026-10-13T15:00:00Z"),
  obra: { nombre: "Darwin 1299", direccion: "Darwin 1299, Villa Crespo, CABA" }, sede: null, solicitante: "Daniela", creadaPor: "Compras",
  proveedor: { nombre: "Corralón San Martín", cuit: "30-71234567-8", telefono: "11 4791-2200", email: null },
  sucursal: { nombre: "Sucursal Pilar", direccion: "Ruta 8 km 50,5, Pilar", telefono: null, contacto: "Hernán", horario: "lun a sáb 7 a 13" },
  renglones: [
    { descripcion: "Cemento Portland x 50 kg", cantidad: 40, unidad: "bolsas", precioUnitario: 11500, subtotal: 460000 },
    { descripcion: "Hierro del 8", cantidad: 20, unidad: "barras", precioUnitario: 9800, subtotal: 196000 },
  ],
  metodoPago: "ACOPIO", moneda: "ARS", condiciones: "50% anticipo, saldo contra entrega",
  subtotal: 656000, ivaPorcentaje: 21, iva: 137760, total: 793760, observaciones: "Entregar por la calle Darwin.", aprobada: null,
};

async function texto(pdf: Uint8Array) {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true });
  return text.replace(/\s+/g, " ");
}

describe("PDF de la orden de compra", () => {
  it("lleva todos los campos de la OC", async () => {
    const t = await texto(await generarPDFOC(base));
    for (const esperado of [
      "ORDEN DE COMPRA", "OC-2026-0012", "10/10/2026", "13/10/2026", "Daniela", "Corralón San Martín", "CUIT 30-71234567-8", "Sucursal Pilar", "Ruta 8 km 50,5",
      "Contacto: Hernán", "Obra Darwin 1299", "Cemento Portland x 50 kg", "40", "bolsas", "Hierro del 8", "Acopio", "50% anticipo, saldo contra entrega",
      "Subtotal", "IVA 21 %", "Total", "793.760,00", "Entregar por la calle Darwin.", "Compras", "Autorizó",
    ]) expect(t).toContain(esperado);
    expect(t).not.toContain("BORRADOR");
  }, 30_000);

  it("borrador: marca BORRADOR y sin número", async () => {
    const t = await texto(await generarPDFOC({ ...base, numero: null }, { borrador: true }));
    expect(t).toContain("BORRADOR");
    expect(t).toContain("Sin número (borrador)");
  }, 30_000);

  it("sin precios: dice 'según presupuesto adjunto' y no muestra totales", async () => {
    const t = await texto(await generarPDFOC({ ...base, renglones: base.renglones.map((r) => ({ ...r, precioUnitario: null, subtotal: null })), subtotal: null, iva: null, total: null }));
    expect(t).toContain("según presupuesto adjunto");
    expect(t).not.toContain("Subtotal");
  }, 30_000);

  it("aprobada: sello con quién y cuándo", async () => {
    const t = await texto(await generarPDFOC({ ...base, aprobada: { por: "Dirección", en: new Date("2026-10-10T18:30:00Z") } }));
    expect(t).toContain("APROBADA por Dirección el 10/10/2026");
    expect(t).toContain("15:30");
  }, 30_000);
});
