import { describe, expect, it } from "vitest";
import { calcularTotales, puedePasar, resumenRenglones, TRANSICIONES_OC } from "./estados";

describe("estados de la orden de compra", () => {
  it("borrador → esperando aprobación → aprobada", () => {
    expect(puedePasar("BORRADOR", "ESPERANDO_APROBACION")).toBe(true);
    expect(puedePasar("ESPERANDO_APROBACION", "APROBADA")).toBe(true);
  });
  it("no se aprueba un borrador ni algo rechazado", () => {
    expect(puedePasar("BORRADOR", "APROBADA")).toBe(false);
    expect(puedePasar("RECHAZADA", "APROBADA")).toBe(false);
    expect(puedePasar("RECHAZADA", "ESPERANDO_APROBACION")).toBe(false);
  });
  it("rechazada y anulada no vuelven (se corrige con una OC nueva, número nuevo)", () => {
    expect(TRANSICIONES_OC.RECHAZADA).toEqual([]);
    expect(TRANSICIONES_OC.ANULADA).toEqual([]);
  });
  it("aprobada vuelve a esperando solo al deshacer, y se puede anular", () => {
    expect(puedePasar("APROBADA", "ESPERANDO_APROBACION")).toBe(true);
    expect(puedePasar("APROBADA", "ANULADA")).toBe(true);
    expect(puedePasar("APROBADA", "RECHAZADA")).toBe(false);
  });
});

describe("totales", () => {
  it("con IVA 21 %", () => {
    expect(calcularTotales([{ cantidad: 40, precioUnitario: 11500 }, { cantidad: 2, precioUnitario: 1000.5 }], 21)).toEqual({ conPrecios: true, subtotal: 462001, iva: 97020.21, total: 559021.21 });
  });
  it("sin IVA", () => expect(calcularTotales([{ cantidad: 3, precioUnitario: 100 }], null)).toEqual({ conPrecios: true, subtotal: 300, iva: 0, total: 300 }));
  it("sin precios: sin totales ('según presupuesto adjunto')", () => expect(calcularTotales([{ cantidad: 3, precioUnitario: null }], 21).conPrecios).toBe(false));
  it("resumen para el aviso", () => {
    expect(resumenRenglones([{ descripcion: "cemento", cantidad: 40, unidad: "bolsas" }, { descripcion: "a", cantidad: 1, unidad: "u" }, { descripcion: "b", cantidad: 1, unidad: "u" }, { descripcion: "c", cantidad: 1, unidad: "u" }])).toBe("40 bolsas cemento + 3 ítems");
  });
});
