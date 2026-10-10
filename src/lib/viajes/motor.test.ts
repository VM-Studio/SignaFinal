import { describe, expect, it } from "vitest";
import { decidir, type EstadoMotor, type Lectura, type ParadaMotor } from "./motor-reglas";

// Corralón San Martín (retiro), Obra Chubut y Obra Darwin (entregas).
const CORRALON = { lat: -34.5875, lng: -58.4575 };
const CHUBUT = { lat: -34.6280, lng: -58.4710 };
const DARWIN = { lat: -34.5925, lng: -58.4376 };
const T0 = new Date("2026-10-09T12:00:00-03:00").getTime();

/** Un punto a "m" metros al norte de p. */
const norte = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_320, lng: p.lng });
const lectura = (p: { lat: number; lng: number }, seg: number, velocidadKmh = 0): Lectura => ({ ...p, velocidadKmh, fecha: new Date(T0 + seg * 1000) });

type Estado = ParadaMotor["estado"] | "COMPLETADA";
type Viaje = { clave: string; punto: typeof CORRALON; radioM: number; estado: Estado; retiro?: string }[];

/**
 * Corre lecturas como el motor (con las paradas en su estado): aplica cada transición (llegada → LLEGO,
 * salida → COMPLETADA y la siguiente EN_CAMINO; llegada adelantada → esa parada pasa a ser la actual).
 */
function correr(viaje: Viaje, lecturas: Lectura[], o: { estado?: EstadoMotor; ahoraSeg?: number } = {}) {
  let estado: EstadoMotor = o.estado ?? {};
  const transiciones: string[] = [];
  const descartes: string[] = [];
  for (const l of lecturas) {
    const pendientes = viaje.filter((p) => p.estado !== "COMPLETADA");
    const hechas = new Set(viaje.filter((p) => p.estado === "COMPLETADA" || p.estado === "LLEGO").map((p) => p.clave));
    const d = decidir(estado, l, {
      paradas: pendientes.map((p) => ({ clave: p.clave, punto: p.punto, radioM: p.radioM, estado: p.estado as ParadaMotor["estado"], habilitada: !p.retiro || hechas.has(p.retiro) })),
      ahora: o.ahoraSeg != null ? new Date(T0 + o.ahoraSeg * 1000) : new Date(l.fecha.getTime() + 5_000),
    });
    estado = d.estado;
    if (d.descartada) descartes.push(d.descartada);
    const t = d.transicion;
    if (!t) continue;
    transiciones.push(`${t.tipo}:${t.clave}@${(t.fecha.getTime() - T0) / 1000}${t.adelantada ? " (adelantada)" : ""}`);
    const i = viaje.findIndex((p) => p.clave === t.clave);
    if (t.tipo === "llegada") {
      // Adelantada: esa parada pasa a ser la actual (se reordena).
      const [p] = viaje.splice(i, 1);
      const primera = viaje.findIndex((x) => x.estado !== "COMPLETADA");
      viaje.splice(primera < 0 ? viaje.length : primera, 0, { ...p, estado: "LLEGO" });
      for (const x of viaje) if (x.estado === "EN_CAMINO") x.estado = "PENDIENTE";
    } else {
      viaje[i].estado = "COMPLETADA";
      const sig = viaje.find((x) => x.estado === "PENDIENTE");
      if (sig) sig.estado = "EN_CAMINO";
    }
  }
  return { transiciones, estado, descartes, orden: viaje.map((p) => `${p.clave}:${p.estado}`) };
}

const simple = (): Viaje => [
  { clave: "R", punto: CORRALON, radioM: 150, estado: "EN_CAMINO" },
  { clave: "D", punto: DARWIN, radioM: 200, estado: "PENDIENTE", retiro: "R" },
];

describe("motor de viajes (por paradas)", () => {
  it("llegada limpia al retiro: dos lecturas adentro y quieto; vale la hora de la primera", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 2000), 0, 40), lectura(norte(CORRALON, 600), 60, 30), lectura(norte(CORRALON, 40), 120, 2), lectura(norte(CORRALON, 35), 150, 0)]);
    expect(r.transiciones).toEqual(["llegada:R@120"]);
  });

  it("pasar por la puerta sin frenar no dispara la llegada", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 300), 0, 40), lectura(norte(CORRALON, 20), 30, 38), lectura(norte(CORRALON, -120), 45, 42), lectura(norte(CORRALON, -400), 70, 45)]);
    expect(r.transiciones).toEqual([]);
  });

  it("una sola lectura adentro no alcanza (puede ser ruido)", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 30), 0, 0), lectura(norte(CORRALON, 500), 60, 30)]);
    expect(r.transiciones).toEqual([]);
  });

  it("salida: se aleja más de 300 m, la parada queda completada y no vuelve atrás aunque regrese", () => {
    const v = simple();
    v[0].estado = "LLEGO";
    const r = correr(v, [lectura(norte(CORRALON, 50), 0), lectura(norte(CORRALON, 350), 60, 25), lectura(norte(CORRALON, 30), 180, 0), lectura(norte(CORRALON, 30), 210, 0)]);
    expect(r.transiciones).toEqual(["salida:R@60"]);
    expect(r.orden).toEqual(["R:COMPLETADA", "D:EN_CAMINO"]);
  });

  it("la última parada no se cierra sola al irse (falta Viaje terminado)", () => {
    const v = simple();
    v[0].estado = "COMPLETADA";
    v[1].estado = "LLEGO";
    expect(correr(v, [lectura(norte(DARWIN, 20), 0), lectura(norte(DARWIN, 900), 60, 30)]).transiciones).toEqual([]);
  });

  it("una lectura de más de 3 minutos no cuenta", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 20), 0), lectura(norte(CORRALON, 25), 30)], { ahoraSeg: 400 });
    expect(r.descartes).toEqual(["vieja", "vieja"]);
    expect(r.transiciones).toEqual([]);
  });

  it("un salto imposible (más de 150 km/h) se descarta", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 20_000), 0, 30), lectura(norte(CORRALON, 10), 60, 0), lectura(norte(CORRALON, 12), 90, 0)]);
    expect(r.descartes).toEqual(["salto", "salto"]);
    expect(r.transiciones).toEqual([]);
  });

  it("la llegada a la obra usa el radio de su geocerca", () => {
    const v = simple();
    v[0].estado = "COMPLETADA";
    v[1].estado = "EN_CAMINO";
    const r = correr(v, [lectura(norte(DARWIN, 180), 0, 1), lectura(norte(DARWIN, 175), 20, 0)]);
    expect(r.transiciones).toEqual(["llegada:D@0"]);
  });

  it("confirmación rechazada: no vuelve a disparar hasta que salga del radio y vuelva a entrar", () => {
    const rechazo: EstadoMotor = { rechazo: { clave: "R", fuera: false }, ultima: { ...norte(CORRALON, 30), fecha: new Date(T0 - 30_000).toISOString() } };
    const quieto = correr(simple(), [lectura(norte(CORRALON, 30), 0), lectura(norte(CORRALON, 30), 30), lectura(norte(CORRALON, 30), 60)], { estado: rechazo });
    expect(quieto.transiciones).toEqual([]);
    const vuelve = correr(simple(), [lectura(norte(CORRALON, 30), 0), lectura(norte(CORRALON, 600), 60, 30), lectura(norte(CORRALON, 40), 180, 0), lectura(norte(CORRALON, 40), 210, 0)], { estado: rechazo });
    expect(vuelve.transiciones).toEqual(["llegada:R@180"]);
  });

  it("lecturas repetidas (misma fecha) no cuentan dos veces", () => {
    const r = correr(simple(), [lectura(norte(CORRALON, 30), 0), lectura(norte(CORRALON, 30), 0)]);
    expect(r.descartes).toEqual(["repetida"]);
    expect(r.transiciones).toEqual([]);
  });

  it("tres paradas y orden alterado: carga en el corralón, iba a Darwin y llega primero a Chubut", () => {
    const v: Viaje = [
      { clave: "R", punto: CORRALON, radioM: 150, estado: "EN_CAMINO" },
      { clave: "D", punto: DARWIN, radioM: 200, estado: "PENDIENTE", retiro: "R" },
      { clave: "C", punto: CHUBUT, radioM: 200, estado: "PENDIENTE", retiro: "R" },
    ];
    const r = correr(v, [
      lectura(norte(CORRALON, 30), 0), lectura(norte(CORRALON, 25), 30), // llega al corralón
      lectura(norte(CORRALON, 900), 600, 30), // sale
      lectura(norte(CHUBUT, 50), 1500, 2), lectura(norte(CHUBUT, 40), 1530, 0), // se queda quieto en Chubut, no en Darwin
      lectura(norte(CHUBUT, 1200), 2400, 35), // sale de Chubut
      lectura(norte(DARWIN, 60), 3300, 1), lectura(norte(DARWIN, 50), 3330, 0), // llega a Darwin
    ]);
    expect(r.transiciones).toEqual(["llegada:R@0", "salida:R@600", "llegada:C@1500 (adelantada)", "salida:C@2400", "llegada:D@3300"]);
    expect(r.orden).toEqual(["R:COMPLETADA", "C:COMPLETADA", "D:LLEGO"]);
  });

  it("no detecta una entrega cuyo retiro todavía no se hizo (precedencia)", () => {
    const v: Viaje = [
      { clave: "R", punto: CORRALON, radioM: 150, estado: "EN_CAMINO" },
      { clave: "C", punto: CHUBUT, radioM: 200, estado: "PENDIENTE", retiro: "R" },
    ];
    expect(correr(v, [lectura(norte(CHUBUT, 20), 0), lectura(norte(CHUBUT, 20), 30)]).transiciones).toEqual([]);
  });
});
