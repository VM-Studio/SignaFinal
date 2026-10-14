import { describe, expect, it } from "vitest";
import { estadoTableroDe, resolverEstadoTablero } from "./estadoTablero";

import type { EstadoMaterial } from "@prisma/client";

const pedido = (estado: EstadoMaterial, presupuestoSolicitado = false) => ({ estado, presupuestoSolicitado });

describe("estado del tablero (derivado del estado real)", () => {
  it("borrador: fuera del tablero, salvo que Compras haya pedido presupuesto", () => {
    expect(estadoTableroDe({ estado: "BORRADOR", pedido: pedido("EN_COMPRA") })).toBeNull();
    expect(estadoTableroDe({ estado: "BORRADOR", pedido: pedido("EN_COMPRA", true) })).toBe("SOLICITUD_PRESUPUESTO");
  });
  it("enviada a aprobación → Pedir autorización", () => {
    expect(estadoTableroDe({ estado: "ESPERANDO_APROBACION", pedido: pedido("ESPERANDO_APROBACION") })).toBe("PEDIR_AUTORIZACION");
  });
  it("aprobada → Autorizada", () => {
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("APROBADO") })).toBe("AUTORIZADA");
    expect(estadoTableroDe({ estado: "APROBADA" })).toBe("AUTORIZADA");
  });
  it("aprobada y encargada al proveedor, o con algo habilitado → Encargado", () => {
    expect(estadoTableroDe({ estado: "APROBADA", encargadaEn: new Date(), pedido: pedido("APROBADO") })).toBe("ENCARGADO");
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("APROBADO"), habilitaciones: [{ estado: "ENTREGADO" }] })).toBe("ENCARGADO");
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("LISTO_PARA_RETIRAR") })).toBe("ENCARGADO");
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("EN_CAMINO") })).toBe("ENCARGADO");
  });
  it("una habilitación cancelada no cuenta como encargado", () => {
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("APROBADO"), habilitaciones: [{ estado: "CANCELADO" }] })).toBe("AUTORIZADA");
  });
  it("todas las habilitaciones entregadas (pedido ENTREGADO) → Entregado", () => {
    expect(estadoTableroDe({ estado: "APROBADA", pedido: pedido("ENTREGADO"), habilitaciones: [{ estado: "ENTREGADO" }] })).toBe("ENTREGADO");
  });
  it("rechazada o anulada → Anulada", () => {
    expect(estadoTableroDe({ estado: "RECHAZADA", pedido: pedido("EN_COMPRA") })).toBe("ANULADA");
    expect(estadoTableroDe({ estado: "ANULADA" })).toBe("ANULADA");
  });
});

describe("ajuste a mano en el tablero", () => {
  it("se respeta mientras el estado real no cambie", () => {
    const r = resolverEstadoTablero({ estadoTablero: "ENCARGADO", estadoTableroAuto: "AUTORIZADA" }, "AUTORIZADA");
    expect(r.estadoTablero).toBe("ENCARGADO");
    expect(r.cambio).toBe(false);
  });
  it("cuando cambia el estado real, manda el real", () => {
    const r = resolverEstadoTablero({ estadoTablero: "ENCARGADO", estadoTableroAuto: "AUTORIZADA" }, "ENTREGADO");
    expect(r).toEqual({ estadoTablero: "ENTREGADO", estadoTableroAuto: "ENTREGADO", cambio: true });
  });
  it("sin ajuste, sigue al real", () => {
    expect(resolverEstadoTablero({ estadoTablero: null, estadoTableroAuto: null }, "PEDIR_AUTORIZACION").estadoTablero).toBe("PEDIR_AUTORIZACION");
  });
});
