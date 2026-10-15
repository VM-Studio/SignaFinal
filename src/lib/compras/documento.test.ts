import { describe, expect, it } from "vitest";
import { conOCCargada, estadoInicial, estadoSegunHabilitaciones, fuenteDe, puedePasar, TRANSICIONES } from "./documento";

describe("recorrido del documento de compra", () => {
  it("borrador → enviada a Compras → en Compras → esperando autorización → autorizada", () => {
    expect(puedePasar("BORRADOR", "ENVIADA_A_COMPRAS")).toBe(true);
    expect(puedePasar("ENVIADA_A_COMPRAS", "EN_COMPRAS")).toBe(true);
    expect(puedePasar("EN_COMPRAS", "ESPERANDO_AUTORIZACION")).toBe(true);
    expect(puedePasar("ESPERANDO_AUTORIZACION", "AUTORIZADA")).toBe(true);
  });
  it("la arquitecta nunca la manda a autorización: de borrador no se salta a esperando autorización", () => {
    expect(puedePasar("BORRADOR", "ESPERANDO_AUTORIZACION")).toBe(false);
    expect(puedePasar("ENVIADA_A_COMPRAS", "ESPERANDO_AUTORIZACION")).toBe(false);
  });
  it("rechazada vuelve a Compras; Compras puede devolverla a borrador", () => {
    expect(puedePasar("ESPERANDO_AUTORIZACION", "EN_COMPRAS")).toBe(true);
    expect(puedePasar("EN_COMPRAS", "BORRADOR")).toBe(true);
    expect(puedePasar("ENVIADA_A_COMPRAS", "BORRADOR")).toBe(true);
  });
  it("encargada y habilitada después de autorizada; anulada no vuelve", () => {
    expect(puedePasar("AUTORIZADA", "ENCARGADA")).toBe(true);
    expect(puedePasar("AUTORIZADA", "HABILITADA")).toBe(true);
    expect(puedePasar("ENCARGADA", "HABILITADA")).toBe(true);
    expect(puedePasar("HABILITADA", "ENTREGADA")).toBe(true);
    expect(TRANSICIONES.ANULADA).toEqual([]);
  });
  it("Compras o el dueño la empiezan en Compras; la gente de obra en borrador (o enviada, con Pedir materiales)", () => {
    expect(estadoInicial("COMPRAS", false)).toBe("EN_COMPRAS");
    expect(estadoInicial("DIRECCION", false)).toBe("EN_COMPRAS");
    expect(estadoInicial("RESPONSABLE_OBRA", false)).toBe("BORRADOR");
    expect(estadoInicial("CAPATAZ", true)).toBe("ENVIADA_A_COMPRAS");
    expect(estadoInicial("ADMINISTRACION", false)).toBe("BORRADOR");
    expect(fuenteDe("CAPATAZ")).toBe("ARQUITECTA");
    expect(fuenteDe("ADMINISTRACION")).toBe("ADMINISTRACION");
  });
});

describe("estado según las habilitaciones", () => {
  it("sin habilitaciones activas: autorizada o encargada", () => {
    expect(estadoSegunHabilitaciones("AUTORIZADA", false, [])).toBe("AUTORIZADA");
    expect(estadoSegunHabilitaciones("ENCARGADA", false, [{ estado: "CANCELADO" }])).toBe("ENCARGADA");
  });
  it("algo listo, pedido o en camino: habilitada", () => {
    expect(estadoSegunHabilitaciones("AUTORIZADA", false, [{ estado: "LISTO" }])).toBe("HABILITADA");
    expect(estadoSegunHabilitaciones("ENCARGADA", true, [{ estado: "ENTREGADO" }, { estado: "EN_CAMINO" }])).toBe("HABILITADA");
  });
  it("todo entregado: entregada solo si Compras marcó que no falta nada", () => {
    expect(estadoSegunHabilitaciones("ENCARGADA", true, [{ estado: "ENTREGADO" }])).toBe("ENTREGADA");
    expect(estadoSegunHabilitaciones("ENCARGADA", false, [{ estado: "ENTREGADO" }])).toBe("HABILITADA");
  });
});

describe("bandeja de Compras: con OC cargada o solo indicaciones", () => {
  it("con proveedor sugerido, importe o más de 3 celdas de la sección 1", () => {
    expect(conOCCargada({ proveedorSugerido: "Corralón", importe: null, importeAConfirmar: false, celdasSeccion1: 2 })).toBe(true);
    expect(conOCCargada({ proveedorSugerido: null, importe: 100, importeAConfirmar: false, celdasSeccion1: 2 })).toBe(true);
    expect(conOCCargada({ proveedorSugerido: null, importe: null, importeAConfirmar: false, celdasSeccion1: 4 })).toBe(true);
    expect(conOCCargada({ proveedorSugerido: " ", importe: null, importeAConfirmar: false, celdasSeccion1: 3 })).toBe(false);
  });
});
