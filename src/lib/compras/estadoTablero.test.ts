import { describe, expect, it } from "vitest";
import { estadoTableroDe, resolverEstadoTablero } from "./estadoTablero";

describe("estado del tablero (derivado del estado del documento)", () => {
  it("antes de autorización: fuera del tablero, salvo que Compras haya pedido presupuesto", () => {
    for (const estado of ["BORRADOR", "ENVIADA_A_COMPRAS", "EN_COMPRAS"] as const) {
      expect(estadoTableroDe({ estado })).toBeNull();
      expect(estadoTableroDe({ estado, presupuestoSolicitado: true })).toBe("SOLICITUD_PRESUPUESTO");
    }
  });
  it("cada estado del documento con su estado del tablero", () => {
    expect(estadoTableroDe({ estado: "ESPERANDO_AUTORIZACION" })).toBe("PEDIR_AUTORIZACION");
    expect(estadoTableroDe({ estado: "AUTORIZADA" })).toBe("AUTORIZADA");
    expect(estadoTableroDe({ estado: "ENCARGADA" })).toBe("ENCARGADO");
    expect(estadoTableroDe({ estado: "HABILITADA" })).toBe("HABILITADA");
    expect(estadoTableroDe({ estado: "ENTREGADA" })).toBe("ENTREGADO");
    expect(estadoTableroDe({ estado: "ANULADA" })).toBe("ANULADA");
    expect(estadoTableroDe({ estado: "RECHAZADA" })).toBe("ANULADA");
  });
});

describe("ajuste a mano del estado del tablero", () => {
  it("se respeta mientras lo derivado no cambie", () => {
    const r = resolverEstadoTablero({ estadoTablero: "ENTREGADO", estadoTableroAuto: "AUTORIZADA" }, "AUTORIZADA");
    expect(r.estadoTablero).toBe("ENTREGADO");
    expect(r.cambio).toBe(false);
  });
  it("se pierde con el próximo cambio real", () => {
    const r = resolverEstadoTablero({ estadoTablero: "ENTREGADO", estadoTableroAuto: "AUTORIZADA" }, "HABILITADA");
    expect(r).toEqual({ estadoTablero: "HABILITADA", estadoTableroAuto: "HABILITADA", cambio: true });
  });
});
