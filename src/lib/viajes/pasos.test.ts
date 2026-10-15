import { describe, expect, it } from "vitest";
import { pasosDelViaje, type ParadaPaso } from "./pasos";
import { kmDelViaje, metrosPorGps } from "./km";

const P = (id: string, nombre: string, estado = "PENDIENTE"): ParadaPaso => ({ id, nombre, estado });
const titulos = (paradas: ParadaPaso[], e = { iniciado: false, terminado: false }) => pasosDelViaje(paradas, e).pasos.map((p) => p.titulo);

describe("pasos del chofer: uno por pantalla, armados con las paradas", () => {
  it("viaje simple (1 retiro, 1 entrega): exactamente 4 pasos", () => {
    expect(titulos([P("r", "Corralón San Martín"), P("e", "Obra Darwin")])).toEqual(["Iniciar viaje", "Llegué a Corralón San Martín", "En camino a Obra Darwin", "Terminar viaje"]);
  });
  it("varios retiros para una obra: Llegué y En camino por cada retiro, Terminar en la obra", () => {
    expect(titulos([P("h", "Terreno Humboldt"), P("c", "Corralón San Martín"), P("d", "Obra Darwin")])).toEqual([
      "Iniciar viaje", "Llegué a Terreno Humboldt", "En camino a Corralón San Martín", "Llegué a Corralón San Martín", "En camino a Obra Darwin", "Terminar viaje",
    ]);
  });
  it("un retiro para varias obras: entrega en cada obra y Terminar en la última", () => {
    expect(titulos([P("c", "Corralón"), P("a", "Obra A"), P("b", "Obra B")])).toEqual([
      "Iniciar viaje", "Llegué a Corralón", "En camino a Obra A", "Llegué a Obra A", "En camino a Obra B", "Terminar viaje",
    ]);
  });
  it("sin retiro: Iniciar y Terminar", () => {
    expect(titulos([P("d", "Obra Darwin")])).toEqual(["Iniciar viaje", "Terminar viaje"]);
  });
  it("nunca hay un 'Salgo' aparte ni pasos repetidos", () => {
    const t = titulos([P("c", "Corralón"), P("a", "Obra A"), P("b", "Obra B")]);
    expect(t.some((x) => /^Salgo/.test(x))).toBe(false);
    expect(new Set(t).size).toBe(t.length);
  });
  it("el paso actual sale del estado de las paradas", () => {
    const paradas = [P("c", "Corralón", "LLEGO"), P("d", "Obra Darwin", "PENDIENTE")];
    const r = pasosDelViaje(paradas, { iniciado: true, terminado: false });
    expect(r.actual?.titulo).toBe("En camino a Obra Darwin");
    expect([r.numero, r.total]).toEqual([3, 4]);
    expect(pasosDelViaje([P("c", "Corralón", "COMPLETADA"), P("d", "Obra Darwin", "EN_CAMINO")], { iniciado: true, terminado: false }).actual?.tipo).toBe("TERMINAR");
    expect(pasosDelViaje(paradas, { iniciado: true, terminado: true }).actual).toBeNull();
  });
  it("llegada que marcó el GPS sin confirmar: el 'Llegué' sigue siendo el paso actual (verde)", () => {
    const r = pasosDelViaje([P("c", "Corralón", "LLEGO"), P("d", "Obra Darwin")], { iniciado: true, terminado: false, porConfirmar: "c" });
    expect(r.actual?.clave).toBe("llegue:c");
  });
});

describe("km del viaje sin que el chofer escriba un número", () => {
  const t0 = new Date("2026-10-15T12:00:00Z").getTime();
  const pos = (lat: number, lng: number, s: number, precisionM?: number) => ({ lat, lng, fecha: new Date(t0 + s * 1000), precisionM });
  it("suma los tramos entre lecturas GPS", () => {
    // ~1,1 km por cada 0,01° de latitud, cada 60 s (66 km/h).
    const m = metrosPorGps([pos(-34.5, -58.5, 0), pos(-34.51, -58.5, 60), pos(-34.52, -58.5, 120)])!;
    expect(Math.round(m / 100)).toBe(22);
  });
  it("descarta los saltos imposibles y las lecturas imprecisas", () => {
    const m = metrosPorGps([pos(-34.5, -58.5, 0), pos(-35.5, -58.5, 10), pos(-34.51, -58.5, 60), pos(-34.6, -58.5, 70, 900)])!;
    expect(Math.round(m / 100)).toBe(11);
  });
  it("no cuenta el temblor del GPS parado", () => {
    expect(metrosPorGps([pos(-34.5, -58.5, 0), pos(-34.50005, -58.5, 30), pos(-34.5, -58.50005, 60)])).toBe(0);
  });
  it("con GPS usa el GPS; sin posiciones, la ruta", () => {
    expect(kmDelViaje({ posiciones: [pos(-34.5, -58.5, 0), pos(-34.6, -58.5, 600)], rutaM: 12_000 })).toEqual({ km: 11, fuente: "GPS" });
    expect(kmDelViaje({ posiciones: [], rutaM: 12_400 })).toEqual({ km: 12, fuente: "RUTA" });
  });
  it("si el GPS se cortó (cubre menos de la mitad de la ruta), la ruta", () => {
    expect(kmDelViaje({ posiciones: [pos(-34.5, -58.5, 0), pos(-34.51, -58.5, 60)], rutaM: 30_000 })).toEqual({ km: 30, fuente: "RUTA" });
  });
});
