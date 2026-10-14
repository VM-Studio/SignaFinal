import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { generarPDFOC, type DatosPDFOC } from "./pdfOC";

const base: DatosPDFOC = {
  tipo: "OC", numero: "OC-0417", version: 1,
  empresa: { nombre: "SIGNA DESARROLLOS S.A", cuit: "30-71704281-2" },
  fechaPedido: new Date("2026-09-15T15:00:00Z"), fechaCaducidad: new Date("2026-09-22T15:00:00Z"), fechaEntrega: new Date("2026-10-17T15:00:00Z"),
  solicitadoPor: "César", obra: "Merit", direccionObra: "Av. Libertador 1500, Vicente López",
  detallePedido: "HORMIGON 19 m3 + corte de h25 15 pp6.20 + super con bomba de arrastre.",
  renglones: [{ descripcion: "Hormigón H25", cantidad: 19, unidad: "m³", precioUnitario: null, subtotal: null }],
  proveedorSugerido: "FENOMIX", proveedorFinal: { nombre: "Fenomix", cuit: "30-71234567-8", sucursal: "Planta Pilar · Ruta 8 km 50,5, Pilar", telefono: "11 4791-2200", contacto: "Hernán" },
  presupuestoNumero: "P-2231", importe: 5773055.25, importeAConfirmar: false, moneda: "ARS", cotizacionUsd: null,
  formaPago: "Transferencia", condicionPago: "Anticipo", observaciones: "Se reprogramó para el sáb 17/10, 8.30 hrs", semaforo: null,
  autorizacion: { estado: "Esperando autorización", por: null, en: null, motivo: null, aprobada: false },
  facturacion: null, ordenPago: null, creadaPor: "Compras",
};

async function texto(pdf: Uint8Array) {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true });
  return text.replace(/\s+/g, " ");
}

describe("PDF calcado de la plantilla de Compras", () => {
  it("lleva el título, el número y las etiquetas exactas de la planilla", async () => {
    const t = await texto(await generarPDFOC(base));
    for (const esperado of [
      "ORDEN DE COMPRA", "OC-0417", "1. Orden de Pedido", "Empresa", "SIGNA DESARROLLOS S.A", "Fecha del pedido", "15/09/2026", "Fecha de caducidad", "22/09/2026",
      "N° de Orden", "Solicitado por", "César", "Obra", "Merit", "Detalle del Pedido", "HORMIGON 19 m3", "Proveedor Sugerido", "FENOMIX", "Proveedor Final", "Fenomix",
      "Presupuesto N°", "P-2231", "Importe", "5.773.055,25", "Forma de Pago", "Transferencia", "Condición de Pago", "Anticipo",
      "1.1 Observaciones de la Orden de Pedido.", "Se reprogramó", "2. Autorización a la Orden de Pedido:", "ESPERANDO AUTORIZACIÓN",
    ]) expect(t).toContain(esperado);
    expect(t).not.toContain("BORRADOR");
    // 3 y 4 solo si tienen datos.
    expect(t).not.toContain("3. Facturación");
    expect(t).not.toContain("4. Orden de Pago");
  }, 30_000);

  it("pedido especial: título PEDIDO ESPECIAL y el semáforo arriba", async () => {
    const t = await texto(await generarPDFOC({ ...base, tipo: "PE", numero: "PE-0151", semaforo: "EN_PROCESO" }));
    expect(t).toContain("PEDIDO ESPECIAL");
    expect(t).toContain("PE-0151");
    expect(t).toContain("ESTADO DE LA ORDEN: EN PROCESO (FALTA ENTREGAR O PAGAR)");
  }, 30_000);

  it("las fechas sin hora de la base (medianoche UTC) salen con su día, no el anterior", async () => {
    const t = await texto(await generarPDFOC({ ...base, fechaPedido: new Date("2026-10-10T00:00:00Z"), fechaCaducidad: new Date("2026-10-11T00:00:00Z") }));
    expect(t).toContain("10/10/2026");
    expect(t).toContain("11/10/2026");
    expect(t).not.toContain("09/10/2026");
  }, 30_000);

  it("borrador: marca BORRADOR y 'Se asigna al enviar'", async () => {
    const t = await texto(await generarPDFOC({ ...base, numero: null }, { borrador: true }));
    expect(t).toContain("BORRADOR");
    expect(t).toContain("Se asigna al enviar");
  }, 30_000);

  it("importe a confirmar (los ???? de la planilla)", async () => {
    const t = await texto(await generarPDFOC({ ...base, importe: null, importeAConfirmar: true }));
    expect(t).toContain("A confirmar");
  }, 30_000);

  it("autorizada (v2): sello con quién y cuándo, y facturación y orden de pago cuando tienen datos", async () => {
    const t = await texto(await generarPDFOC({
      ...base, version: 2,
      autorizacion: { estado: "Autorizada", por: "Dirección", en: new Date("2026-10-10T18:30:00Z"), motivo: null, aprobada: true },
      facturacion: { empresa: "DARWIN 1299 S.A", cuit: "30-71672062-0", numero: "0003-00012345", importe: 5773055.25, fecha: new Date("2026-10-12T12:00:00Z"), formaPago: "Echeq", condicion: "Saldo a 30 días" },
      ordenPago: { autorizadaPor: "Dirección", autorizadaEn: new Date("2026-10-13T13:00:00Z"), fechaPago: new Date("2026-10-15T12:00:00Z"), importe: 5773055.25, observaciones: null },
    }));
    for (const esperado of ["OC-0417 v2", "AUTORIZADA", "Autorizó Dirección el 10/10/2026 15:30", "3. Facturación", "Empresa para Facturar", "DARWIN 1299 S.A", "Cuit", "30-71672062-0", "Factura N°", "0003-00012345", "4. Orden de Pago", "Autorización a la Orden de Pago", "Fecha de Pago", "15/10/2026"]) expect(t).toContain(esperado);
  }, 30_000);
});
