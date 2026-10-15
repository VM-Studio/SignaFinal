import { describe, expect, it } from "vitest";
import type { EstadoOC, Rol } from "@prisma/client";
import { celdasEditables, faltan, pasoSiguiente, puedeEditarCelda, textoFaltan, veDocumentos, type Celda, type Contexto } from "./permisosCeldas";

/** Contexto por defecto: alguien de Compras mirando un documento en Compras. */
const ctx = (c: Partial<Contexto> & { rol: Rol; estado?: EstadoOC }): Contexto => ({ estado: "EN_COMPRAS", esCreador: false, esDeSuObra: false, ...c });
const puede = (celda: Celda, c: Partial<Contexto> & { rol: Rol; estado?: EstadoOC }) => puedeEditarCelda(celda, ctx(c)).ok;

describe("permisos por celda del documento de compra", () => {
  it("chofer y depósito no ven el documento", () => {
    expect(veDocumentos("CHOFER")).toBe(false);
    expect(veDocumentos("DEPOSITO")).toBe(false);
    expect(puede("detalleDelPedido", { rol: "CHOFER", esCreador: true })).toBe(false);
    expect(celdasEditables(ctx({ rol: "DEPOSITO" }))).toEqual([]);
  });

  it("sección 1 hasta Proveedor Sugerido (e Importe): quien la creó, la obra, Compras, Dirección y Administración, antes de enviar a autorización", () => {
    for (const celda of ["obra", "detalleDelPedido", "proveedorSugerido", "fechaCaducidad", "importe"] as Celda[]) {
      expect(puede(celda, { rol: "RESPONSABLE_OBRA", estado: "BORRADOR", esCreador: true })).toBe(true);
      expect(puede(celda, { rol: "RESPONSABLE_OBRA", estado: "ENVIADA_A_COMPRAS", esDeSuObra: true })).toBe(true);
      expect(puede(celda, { rol: "COMPRAS" })).toBe(true);
      expect(puede(celda, { rol: "DIRECCION" })).toBe(true);
      expect(puede(celda, { rol: "ADMINISTRACION" })).toBe(true);
    }
    // Un responsable de OTRA obra, no.
    expect(puede("detalleDelPedido", { rol: "RESPONSABLE_OBRA", estado: "EN_COMPRAS" })).toBe(false);
  });

  it("el borrador es de quien lo arma: Compras lo ve recién cuando se lo mandan", () => {
    expect(puede("detalleDelPedido", { rol: "COMPRAS", estado: "BORRADOR" })).toBe(false);
    expect(puede("detalleDelPedido", { rol: "RESPONSABLE_OBRA", estado: "BORRADOR", esCreador: true })).toBe(true);
  });

  it("Proveedor Final, Presupuesto N° y 1.1: Compras y Dirección (la arquitecta los ve en gris)", () => {
    for (const celda of ["proveedorFinal", "presupuestoN", "observacionesOrdenPedido"] as Celda[]) {
      expect(puede(celda, { rol: "COMPRAS" })).toBe(true);
      expect(puede(celda, { rol: "DIRECCION" })).toBe(true);
      expect(puede(celda, { rol: "RESPONSABLE_OBRA", esCreador: true, esDeSuObra: true })).toBe(false);
      expect(puede(celda, { rol: "ADMINISTRACION" })).toBe(false);
    }
    expect(puedeEditarCelda("proveedorFinal", ctx({ rol: "RESPONSABLE_OBRA", esCreador: true })).ok ? "" : (puedeEditarCelda("proveedorFinal", ctx({ rol: "RESPONSABLE_OBRA", esCreador: true })) as { motivo: string }).motivo).toMatch(/Compras/);
  });

  it("enviada a autorización: la sección 1 se bloquea; Compras solo con Modificar", () => {
    for (const estado of ["ESPERANDO_AUTORIZACION", "AUTORIZADA", "ENCARGADA", "HABILITADA"] as EstadoOC[]) {
      expect(puede("importe", { rol: "RESPONSABLE_OBRA", estado, esCreador: true })).toBe(false);
      expect(puede("importe", { rol: "DIRECCION", estado })).toBe(false);
      expect(puede("importe", { rol: "COMPRAS", estado })).toBe(false);
      expect(puede("importe", { rol: "COMPRAS", estado, modificar: true })).toBe(true);
      expect(puede("proveedorFinal", { rol: "COMPRAS", estado, modificar: true })).toBe(true);
    }
    expect(puede("importe", { rol: "COMPRAS", estado: "ENTREGADA", modificar: true })).toBe(false);
  });

  it("Forma de Pago: Administración y Dirección la final; Compras solo marca Acopio", () => {
    expect(puede("formaDePago", { rol: "ADMINISTRACION", estado: "AUTORIZADA", valor: "TRANSFERENCIA" })).toBe(true);
    expect(puede("formaDePago", { rol: "DIRECCION", estado: "AUTORIZADA", valor: "ECHEQ" })).toBe(true);
    expect(puede("formaDePago", { rol: "COMPRAS", valor: "ACOPIO" })).toBe(true);
    expect(puede("formaDePago", { rol: "COMPRAS", valor: "" })).toBe(true);
    expect(puede("formaDePago", { rol: "COMPRAS", valor: "TRANSFERENCIA" })).toBe(false);
    expect(puede("formaDePago", { rol: "RESPONSABLE_OBRA", esCreador: true, valor: "ACOPIO" })).toBe(false);
  });

  it("sección 3 (Facturación): Administración y Dirección; nadie más", () => {
    for (const celda of ["empresaParaFacturar", "facturaN", "facturaImporte", "facturaFormaDePago", "condicionDePago", "facturaAdjunto"] as Celda[]) {
      expect(puede(celda, { rol: "ADMINISTRACION", estado: "AUTORIZADA" })).toBe(true);
      expect(puede(celda, { rol: "DIRECCION", estado: "HABILITADA" })).toBe(true);
      expect(puede(celda, { rol: "COMPRAS", estado: "AUTORIZADA" })).toBe(false);
      expect(puede(celda, { rol: "RESPONSABLE_OBRA", estado: "AUTORIZADA", esCreador: true })).toBe(false);
    }
  });

  it("sección 4: Fecha de Pago la pone Administración con el pago autorizado", () => {
    expect(puede("fechaDePago", { rol: "ADMINISTRACION", estado: "ENTREGADA" })).toBe(false);
    expect(puede("fechaDePago", { rol: "ADMINISTRACION", estado: "ENTREGADA", pagoAutorizado: true })).toBe(true);
    expect(puede("fechaDePago", { rol: "DIRECCION", estado: "ENTREGADA", pagoAutorizado: true })).toBe(false);
  });

  it("N° de Orden y Cuit los completa el sistema; una anulada no se edita", () => {
    expect(puede("nDeOrden", { rol: "DIRECCION" })).toBe(false);
    expect(puede("cuit", { rol: "ADMINISTRACION", estado: "AUTORIZADA" })).toBe(false);
    expect(puede("detalleDelPedido", { rol: "COMPRAS", estado: "ANULADA" })).toBe(false);
  });

  it("las importadas del Excel: la sección 1 no se toca, la facturación sí", () => {
    expect(puede("importe", { rol: "COMPRAS", estado: "ENCARGADA", importada: true, modificar: true })).toBe(false);
    expect(puede("facturaN", { rol: "ADMINISTRACION", estado: "ENCARGADA", importada: true })).toBe(true);
  });
});

describe("lo que falta para el paso siguiente", () => {
  it("Enviar a Compras: alcanza con obra + detalle", () => {
    expect(faltan("enviarACompras", { obra: "o1", detalleDelPedido: "40 bolsas" })).toEqual([]);
    expect(textoFaltan(faltan("enviarACompras", { obra: "o1" }))).toBe("Faltan: Detalle del Pedido");
  });
  it("Enviar a autorización: Proveedor Final e Importe (\"Faltan: Proveedor Final, Importe\")", () => {
    const v = { empresa: "rs", solicitadoPor: "u:x", obra: "o1", detalleDelPedido: "40 bolsas" };
    expect(textoFaltan(faltan("enviarAAutorizacion", v))).toBe("Faltan: Proveedor Final, Importe");
    expect(faltan("enviarAAutorizacion", { ...v, proveedorFinal: "p|s", importe: "?" })).toEqual([]);
  });
  it("el paso depende de quién mira: la arquitecta nunca ve el de autorización", () => {
    expect(pasoSiguiente("RESPONSABLE_OBRA", "BORRADOR")).toBe("enviarACompras");
    expect(pasoSiguiente("RESPONSABLE_OBRA", "EN_COMPRAS")).toBeNull();
    expect(pasoSiguiente("COMPRAS", "EN_COMPRAS")).toBe("enviarAAutorizacion");
    expect(pasoSiguiente("ADMINISTRACION", "AUTORIZADA")).toBe("facturar");
  });
});
