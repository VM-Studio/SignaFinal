import { describe, expect, it } from "vitest";
import { EVENTO, type Evento } from "./eventos";
import { resolverDestinatarios, type Persona } from "./destinatarios";

// Escenario: un usuario por rol y dos obras (Darwin y Laura Thomas).
const DARWIN = "obra-darwin";
const LAURA = "obra-laura";
const P: Persona[] = [
  { id: "dueno", rol: "DIRECCION", obras: [] },
  { id: "daniela", rol: "RESPONSABLE_OBRA", obras: [DARWIN] },
  { id: "cesar", rol: "RESPONSABLE_OBRA", obras: [DARWIN, LAURA] },
  { id: "vicky", rol: "RESPONSABLE_OBRA", obras: [LAURA] },
  { id: "lolo", rol: "CAPATAZ", obras: [] },
  { id: "claudio", rol: "CHOFER", obras: [] },
  { id: "cristian", rol: "CHOFER", obras: [] },
  { id: "deposito", rol: "DEPOSITO", obras: [] },
  { id: "admin", rol: "ADMINISTRACION", obras: [] },
  { id: "compras", rol: "COMPRAS", obras: [] },
];

/** Quién recibe (con "*" si es push) y con qué enlace. */
function correr(e: Evento | null, actor?: string) {
  if (!e) throw new Error("sin evento");
  const r = resolverDestinatarios(e.para, P, { enlace: e.enlace, obraId: e.obraId, actor });
  const quien = r.entregas.map((x) => `${x.usuarioId}${x.push ? "*" : ""}`).sort();
  const enlace = Object.fromEntries(r.entregas.map((x) => [x.usuarioId, x.enlace]));
  return { quien, enlace };
}

const viaje = { pedidoId: "p1", solicitanteId: "daniela", obraId: DARWIN, descripcion: "Cemento, 30 bolsas", destino: "Obra Darwin", chofer: "Claudio" };
const material = { pedidoMaterialId: "m1", solicitanteId: "daniela", obraId: DARWIN, que: "Cemento Portland, 30 bolsas", obra: "Darwin" };

describe("matriz de avisos", () => {
  it("solicitud nueva normal: choferes y Dirección, solo bandeja", () => {
    const r = correr(EVENTO.solicitudNueva({ pedidoId: "p1", obraId: DARWIN, quien: "Daniela", descripcion: "Cemento", destino: "Obra Darwin", origen: "Corralón", paraCuando: new Date(), urgente: false }), "daniela");
    expect(r.quien).toEqual(["claudio", "cristian", "dueno"]);
    expect(r.enlace.claudio).toBe("/solicitudes/p1");
  });

  it("solicitud nueva urgente: push a los choferes", () => {
    const r = correr(EVENTO.solicitudNueva({ pedidoId: "p1", obraId: DARWIN, quien: "Daniela", descripcion: "Cemento", destino: "Obra Darwin", origen: "Corralón", paraCuando: new Date(), urgente: true }), "daniela");
    expect(r.quien).toEqual(["claudio*", "cristian*", "dueno"]);
  });

  it("aceptado por Claudio: push al que pidió, bandeja a Dirección; Claudio no se avisa a sí mismo", () => {
    const r = correr(EVENTO.pedidoAceptado({ ...viaje, choferId: "claudio", salida: new Date(), vehiculo: "Camión Mercedes 710" }), "claudio");
    expect(r.quien).toEqual(["daniela*", "dueno"]);
    expect(r.enlace.daniela).toBe("/mis-pedidos/p1");
    expect(r.enlace.dueno).toBe("/solicitudes/p1");
  });

  it("asignado por Dirección: push al que pidió y al chofer", () => {
    const r = correr(EVENTO.pedidoAceptado({ ...viaje, choferId: "claudio", salida: new Date(), vehiculo: "Camión Kia" }), "dueno");
    expect(r.quien).toEqual(["claudio*", "daniela*"]);
  });

  it("llegó a destino un retiro de material: el que pidió (push), Dirección y Compras (bandeja, en su pantalla)", () => {
    const r = correr(EVENTO.viajeEnDestino({ ...viaje, pedidoMaterialId: "m1", llego: new Date() }));
    expect(r.quien).toEqual(["compras", "daniela*", "dueno"]);
    expect(r.enlace.compras).toBe("/compras/m1");
  });

  it("material habilitado: el que pidió y los demás responsables de la obra (push), Compras bandeja", () => {
    const r = correr(EVENTO.materialHabilitado({ ...material, proveedor: "Corralón San Martín", horario: "8 a 12", entregaProveedor: false, cuando: null }), "otro-de-compras");
    expect(r.quien).toEqual(["cesar*", "compras", "daniela*"]);
    expect(r.enlace.daniela).toBe("/mis-pedidos/material/m1");
  });

  it("esperando aprobación: push solo al dueño", () => {
    const r = correr(EVENTO.materialParaAprobar({ ...material, oc: "3150", monto: "$ 4.030.000" }), "compras");
    expect(r.quien).toEqual(["dueno*"]);
    expect(r.enlace.dueno).toBe("/aprobaciones");
  });

  it("material nuevo: push a Compras, bandeja al dueño", () => {
    const r = correr(EVENTO.materialNuevo({ ...material, quien: "Daniela", para: new Date(), urgente: false }), "daniela");
    expect(r.quien).toEqual(["compras*", "dueno"]);
  });

  it("documento vencido: Administración, Dirección y el chofer, con push", () => {
    const r = correr(EVENTO.alerta({ regla: "DOCUMENTO", severidad: "CRITICA", titulo: "VTV vencida", detalle: "Camión Kia", enlace: "/flota/v1", claveUnica: "DOCUMENTO:v1:VTV", obraId: null, personas: ["claudio"] }));
    expect(r.quien).toEqual(["admin*", "claudio*", "dueno*"]);
    expect(r.enlace.claudio).toBe("/avisos");
  });

  it("documento por vencer: los mismos, solo bandeja", () => {
    const r = correr(EVENTO.alerta({ regla: "DOCUMENTO", severidad: "AVISO", titulo: "VTV vence en 5 días", detalle: "Camión Kia", enlace: "/flota/v1", claveUnica: "DOCUMENTO:v1:VTV", obraId: null, personas: ["claudio"] }));
    expect(r.quien).toEqual(["admin", "claudio", "dueno"]);
  });

  it("devolución vencida: quien la tiene, Depósito y Dirección (bandeja); nunca un chofer", () => {
    const r = correr(EVENTO.alerta({ regla: "DEVOLUCION_VENCIDA", severidad: "AVISO", titulo: "Hormigonera vencida", detalle: "En Obra Darwin", enlace: "/herramientas/h1", claveUnica: "DEVOLUCION_VENCIDA:h1", obraId: DARWIN, personas: ["daniela", "claudio"] }));
    expect(r.quien).toEqual(["daniela", "deposito", "dueno"]);
  });

  it("Vicky no recibe nada de Darwin, aunque la nombren", () => {
    const eventos = [
      EVENTO.materialHabilitado({ ...material, solicitanteId: "vicky", proveedor: "X", horario: null, entregaProveedor: false, cuando: null }),
      EVENTO.viajeEnDestino({ ...viaje, solicitanteId: "vicky", llego: new Date() }),
      EVENTO.alerta({ regla: "MATERIAL_SIN_RETIRAR", severidad: "AVISO", titulo: "x", detalle: "x", enlace: "/materiales/m1", claveUnica: "k", obraId: DARWIN, personas: ["vicky"] }),
    ];
    for (const e of eventos) expect(correr(e).quien.some((q) => q.startsWith("vicky"))).toBe(false);
  });

  it("Claudio no recibe nada de depósito", () => {
    const e = EVENTO.herramientaPedidaEnTuObra({ usuarioIds: ["claudio", "daniela"], herramientaId: "h1", pedidoId: "p2", quien: "César", herramienta: "Hormigonera", desdeObra: "Darwin", obra: "Laura Thomas", cuando: new Date() });
    expect(correr(e).quien).toEqual(["daniela"]);
  });

  it("cancelado por el que pidió: push al chofer que lo tenía, bandeja a Dirección", () => {
    const r = correr(EVENTO.pedidoCancelado({ ...viaje, quien: "Daniela", motivo: "Ya no hace falta", choferId: "claudio" }), "daniela");
    expect(r.quien).toEqual(["claudio*", "dueno"]);
    expect(r.enlace.claudio).toBe("/hoy");
  });
});
