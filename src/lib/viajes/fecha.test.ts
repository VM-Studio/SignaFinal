import { describe, expect, it } from "vitest";
import { bloqueoPorFecha, fechaViaje, previstoPara } from "./fecha";

// Sábado 10/10/2026, 10:00 en Buenos Aires (13:00 UTC).
const AHORA = new Date("2026-10-10T13:00:00Z");
const ar = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);

describe("fecha del viaje en palabras (America/Argentina/Buenos_Aires)", () => {
  it("hoy, en negro", () => {
    expect(fechaViaje(ar("2026-10-10", "08:30"), "HORA_EXACTA", { ahora: AHORA, iniciado: true })).toEqual({ texto: "HOY · 8:30", tono: "hoy", dias: 0 });
  });
  it("mañana por la tarde, en ámbar", () => {
    expect(fechaViaje(ar("2026-10-11", "14:00"), "TARDE", { ahora: AHORA })).toEqual({ texto: "MAÑANA · por la tarde", tono: "manana", dias: 1 });
  });
  it("lunes con fecha y hora, en gris", () => {
    expect(fechaViaje(ar("2026-10-12", "08:30"), "HORA_EXACTA", { ahora: AHORA })).toMatchObject({ texto: "LUNES 12/10 · 8:30", tono: "futuro" });
  });
  it("más de una semana: en N días", () => {
    expect(fechaViaje(ar("2026-10-19", "08:00"), "MANANA", { ahora: AHORA }).texto).toBe("EN 9 DÍAS · lunes 19/10 · por la mañana");
  });
  it("fecha pasada sin iniciar: ATRASADO en rojo", () => {
    expect(fechaViaje(ar("2026-10-09", "08:30"), "HORA_EXACTA", { ahora: AHORA })).toEqual({ texto: "ATRASADO · ayer 8:30", tono: "atrasado", dias: -1 });
    expect(fechaViaje(ar("2026-10-07", "08:30"), "HORA_EXACTA", { ahora: AHORA }).texto).toBe("ATRASADO · miércoles 7/10 · 8:30");
  });
  it("fecha pasada ya iniciada: no es atrasado", () => {
    expect(fechaViaje(ar("2026-10-09", "08:30"), "HORA_EXACTA", { ahora: AHORA, iniciado: true }).tono).toBe("pasado");
  });
  it("usa el día argentino, no el UTC: 23:30 del viernes es viernes aunque en UTC ya sea sábado", () => {
    const viernesNoche = ar("2026-10-09", "23:30"); // 02:30 UTC del sábado
    const ahoraViernes = ar("2026-10-09", "22:00");
    expect(fechaViaje(viernesNoche, "HORA_EXACTA", { ahora: ahoraViernes }).texto).toBe("HOY · 23:30");
    expect(fechaViaje(viernesNoche, "HORA_EXACTA", { ahora: AHORA }).texto).toBe("ATRASADO · ayer 23:30");
  });
  it("la franja con otra hora cargada muestra la hora", () => {
    expect(fechaViaje(ar("2026-10-10", "08:30"), "MANANA", { ahora: AHORA }).texto).toBe("HOY · 8:30");
    expect(fechaViaje(ar("2026-10-10", "08:00"), "MANANA", { ahora: AHORA }).texto).toBe("HOY · por la mañana");
  });
});

describe("bloqueo por fecha", () => {
  it("hoy y atrasado se pueden iniciar", () => {
    expect(bloqueoPorFecha(ar("2026-10-10", "18:00"), AHORA)).toBeNull();
    expect(bloqueoPorFecha(ar("2026-10-08", "08:00"), AHORA)).toBeNull();
  });
  it("futuro: bloqueado con el día", () => {
    expect(bloqueoPorFecha(ar("2026-10-12", "08:30"), AHORA)).toBe("Este viaje es para el lunes 12/10");
    expect(bloqueoPorFecha(ar("2026-10-11", "08:30"), AHORA)).toBe("Este viaje es para mañana (domingo 11/10)");
  });
  it("a las 00:05 un viaje del día ya no está bloqueado", () => {
    expect(bloqueoPorFecha(ar("2026-10-11", "08:30"), ar("2026-10-11", "00:05"))).toBeNull();
  });
  it("previsto para: ayer / el día", () => {
    expect(previstoPara(ar("2026-10-09", "08:30"), AHORA)).toBe("ayer");
    expect(previstoPara(ar("2026-10-06", "08:30"), AHORA)).toBe("el martes 6/10");
  });
});
