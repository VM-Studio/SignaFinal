import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aptitud } from "./reglas";
import { diaISO, sumarDias, aFecha } from "@/lib/formato";

type V = Parameters<typeof aptitud>[0];
const dia = (n: number) => aFecha(sumarDias(diaISO(), n), "12:00");
const vehiculo = (docs: { tipo: string; vencimiento: Date | null }[], extra: Partial<V> = {}) =>
  ({ activo: true, estado: "DISPONIBLE", soloDocumentacion: false, tipo: "CAMION", capacidadCargaKg: 3000, viajes: [], documentos: docs, ...extra }) as unknown as V;
const pedido = { pesoKg: null, necesitaCamion: false };

describe("aptitud: la documentación avisa pero no frena el viaje", () => {
  it("sin documentación cargada: se puede usar, con el aviso", () => {
    expect(aptitud(vehiculo([]), pedido)).toEqual({ apto: true, aviso: "Ojo: sin seguro cargado · sin VTV cargada" });
  });
  it("VTV vencida: se puede usar, con el aviso", () => {
    expect(aptitud(vehiculo([{ tipo: "SEGURO", vencimiento: dia(30) }, { tipo: "VTV", vencimiento: dia(-1) }]), pedido)).toEqual({ apto: true, aviso: "Ojo: VTV vencida" });
  });
  it("todo vigente (vence hoy cuenta como vigente): sin aviso", () => {
    expect(aptitud(vehiculo([{ tipo: "SEGURO", vencimiento: dia(0) }, { tipo: "VTV", vencimiento: dia(90) }]), pedido)).toEqual({ apto: true });
  });
  it("lo que sí frena: taller, otro viaje y las Hilux (solo documentación)", () => {
    expect(aptitud(vehiculo([], { estado: "EN_TALLER" }), pedido).apto).toBe(false);
    expect(aptitud(vehiculo([], { estado: "EN_VIAJE" }), pedido).apto).toBe(false);
    expect(aptitud(vehiculo([], { soloDocumentacion: true }), pedido).apto).toBe(false);
  });
  it("los avisos se suman", () => {
    expect(aptitud(vehiculo([{ tipo: "SEGURO", vencimiento: dia(-3) }, { tipo: "VTV", vencimiento: dia(10) }], { tipo: "CAMIONETA" }), { pesoKg: null, necesitaCamion: true }).aviso).toBe("Ojo: seguro vencido · el pedido es para camión");
  });
});
