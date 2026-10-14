import { writeFileSync } from "node:fs";
import { generarPDFOC } from "../src/lib/compras/pdfOC";
(async () => {
  const pdf = await generarPDFOC({
    tipo: "OC", numero: "OC-0417", version: 1, empresa: { nombre: "SIGNA DESARROLLOS S.A", cuit: "30-71704281-2" },
    fechaPedido: new Date("2026-09-15T15:00:00Z"), fechaCaducidad: new Date("2026-09-22T15:00:00Z"), fechaEntrega: new Date("2026-10-17T15:00:00Z"),
    solicitadoPor: "César", obra: "Merit", direccionObra: "Av. Libertador 1500, Vicente López",
    detallePedido: "HORMIGON 19 m3 + corte de h25 15 pp6.20\n+ super con bomba de arrastre.",
    renglones: [{ descripcion: "Hormigón H25", cantidad: 19, unidad: "m³", precioUnitario: 280000, subtotal: null }, { descripcion: "Bomba de arrastre", cantidad: 1, unidad: "u", precioUnitario: 450000, subtotal: null }],
    proveedorSugerido: "FENOMIX", proveedorFinal: { nombre: "Fenomix", cuit: "30-71234567-8", sucursal: "Planta Pilar · Ruta 8 km 50,5, Pilar", telefono: "11 4791-2200", contacto: "Hernán" },
    presupuestoNumero: "P-2231", importe: 5773055.25, importeAConfirmar: false, moneda: "ARS", cotizacionUsd: null,
    formaPago: "Transferencia", condicionPago: "Anticipo", observaciones: "Se reprogramó para el sáb 17/10, 8.30 hrs", semaforo: null,
    autorizacion: { estado: "Autorizada", por: "Dirección", en: new Date("2026-10-10T18:30:00Z"), motivo: null, aprobada: true },
    facturacion: { empresa: "SIGNA DESARROLLOS S.A", cuit: "30-71704281-2", numero: "0003-00012345", importe: 5773055.25, fecha: new Date("2026-10-12T12:00:00Z"), formaPago: "Echeq", condicion: "Saldo a 30 días" },
    ordenPago: { autorizadaPor: "Dirección", autorizadaEn: new Date("2026-10-13T13:00:00Z"), fechaPago: new Date("2026-10-15T12:00:00Z"), importe: 5773055.25, observaciones: null },
    creadaPor: "Compras",
  });
  writeFileSync(process.argv[2], pdf);
})();
