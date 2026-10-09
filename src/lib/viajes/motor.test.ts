import { describe, expect, it } from "vitest";
import { decidir, type Contexto, type EstadoMotor, type EtapaMotor, type Lectura } from "./motor-reglas";

// Corralón San Martín (retiro) y Obra Darwin (destino).
const RETIRO = { lat: -34.5301, lng: -58.4952 };
const OBRA = { lat: -34.5925, lng: -58.4376 };
const T0 = new Date("2026-10-09T12:00:00-03:00").getTime();

/** Un punto a "m" metros al norte de p. */
const norte = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_320, lng: p.lng });
const lectura = (p: { lat: number; lng: number }, seg: number, velocidadKmh = 0): Lectura => ({ ...p, velocidadKmh, fecha: new Date(T0 + seg * 1000) });

/** Corre una secuencia de lecturas como lo hace el motor y devuelve las transiciones y la etapa final. */
function correr(etapa: EtapaMotor, lecturas: Lectura[], o: { retiro?: typeof RETIRO | null; estado?: EstadoMotor; ahoraSeg?: number } = {}) {
  let estado: EstadoMotor = o.estado ?? {};
  const transiciones: string[] = [];
  const descartes: string[] = [];
  for (const l of lecturas) {
    const c: Contexto = {
      etapa, retiro: o.retiro === undefined ? RETIRO : o.retiro, destino: OBRA, radioRetiroM: 150, radioDestinoM: 200,
      ahora: o.ahoraSeg != null ? new Date(T0 + o.ahoraSeg * 1000) : new Date(l.fecha.getTime() + 5_000),
    };
    const d = decidir(estado, l, c);
    estado = d.estado;
    if (d.descartada) descartes.push(d.descartada);
    if (d.transicion) {
      transiciones.push(`${d.transicion.a}@${(d.transicion.fecha.getTime() - T0) / 1000}`);
      etapa = d.transicion.a;
    }
  }
  return { transiciones, etapa, estado, descartes };
}

describe("motor de viajes", () => {
  it("llegada limpia al retiro: dos lecturas adentro y quieto; vale la hora de la primera", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 2000), 0, 40), lectura(norte(RETIRO, 600), 60, 30), lectura(norte(RETIRO, 40), 120, 2), lectura(norte(RETIRO, 35), 150, 0)]);
    expect(r.transiciones).toEqual(["EN_RETIRO@120"]);
  });

  it("pasar por la puerta sin frenar no dispara la llegada", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 300), 0, 40), lectura(norte(RETIRO, 20), 30, 38), lectura(norte(RETIRO, -120), 45, 42), lectura(norte(RETIRO, -400), 70, 45)]);
    expect(r.transiciones).toEqual([]);
    expect(r.etapa).toBe("HACIA_RETIRO");
  });

  it("una sola lectura adentro no alcanza (puede ser ruido)", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 30), 0, 0), lectura(norte(RETIRO, 500), 60, 30)]);
    expect(r.transiciones).toEqual([]);
  });

  it("salida y vuelta: sale del retiro, pasa a camino a la obra y no vuelve atrás aunque regrese", () => {
    const r = correr("EN_RETIRO", [lectura(norte(RETIRO, 50), 0), lectura(norte(RETIRO, 350), 60, 25), lectura(norte(RETIRO, 30), 180, 0), lectura(norte(RETIRO, 30), 210, 0)]);
    expect(r.transiciones).toEqual(["HACIA_DESTINO@60"]);
    expect(r.etapa).toBe("HACIA_DESTINO");
  });

  it("una lectura de más de 3 minutos no cuenta", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 20), 0), lectura(norte(RETIRO, 25), 30)], { ahoraSeg: 400 });
    expect(r.descartes).toEqual(["vieja", "vieja"]);
    expect(r.transiciones).toEqual([]);
  });

  it("un salto imposible (más de 150 km/h) se descarta", () => {
    // 20 km en 60 s = 1.200 km/h: la segunda lectura es un error del GPS.
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 20_000), 0, 30), lectura(norte(RETIRO, 10), 60, 0), lectura(norte(RETIRO, 12), 90, 0)]);
    expect(r.descartes).toEqual(["salto", "salto"]);
    expect(r.transiciones).toEqual([]);
  });

  it("viaje sin punto de retiro: con la primera lectura va directo a la obra y llega", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(OBRA, 5000), 0, 40), lectura(norte(OBRA, 100), 400, 3), lectura(norte(OBRA, 90), 430, 0)], { retiro: null });
    expect(r.transiciones).toEqual(["HACIA_DESTINO@0", "EN_DESTINO@400"]);
  });

  it("llegada a la obra usa el radio de su geocerca", () => {
    const r = correr("HACIA_DESTINO", [lectura(norte(OBRA, 180), 0, 1), lectura(norte(OBRA, 175), 20, 0)]);
    expect(r.transiciones).toEqual(["EN_DESTINO@0"]);
  });

  it("confirmación rechazada: no vuelve a disparar hasta que salga del radio y vuelva a entrar", () => {
    const rechazo: EstadoMotor = { rechazo: { etapa: "EN_RETIRO", fuera: false }, ultima: { ...norte(RETIRO, 30), fecha: new Date(T0 - 30_000).toISOString() } };
    const quieto = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 30), 0), lectura(norte(RETIRO, 30), 30), lectura(norte(RETIRO, 30), 60)], { estado: rechazo });
    expect(quieto.transiciones).toEqual([]);
    const vuelve = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 30), 0), lectura(norte(RETIRO, 600), 60, 30), lectura(norte(RETIRO, 40), 180, 0), lectura(norte(RETIRO, 40), 210, 0)], { estado: rechazo });
    expect(vuelve.transiciones).toEqual(["EN_RETIRO@180"]);
  });

  it("lecturas repetidas (misma fecha) no cuentan dos veces", () => {
    const r = correr("HACIA_RETIRO", [lectura(norte(RETIRO, 30), 0), lectura(norte(RETIRO, 30), 0)]);
    expect(r.descartes).toEqual(["repetida"]);
    expect(r.transiciones).toEqual([]);
  });
});
