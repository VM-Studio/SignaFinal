import { describe, expect, it } from "vitest";
import { claveRecordatorio, planRecordatorios, sigueValiendo, TEXTO_RECORDATORIO, vigente } from "./recordatorios-plan";

const ar = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);
const hhmm = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

describe("recordatorios programados", () => {
  const viaje = ar("2026-10-12", "08:30");

  it("aceptado con días de anticipación: 18:00 del día anterior, 7:00 del día y 4 de 'sin iniciar' cada 60 min", () => {
    const plan = planRecordatorios(viaje, ar("2026-10-10", "10:00"));
    expect(plan.map((r) => `${r.tipo} ${hhmm(r.programadoPara)}`)).toEqual([
      "VIAJE_MANANA 11/10, 18:00",
      "VIAJE_HOY 12/10, 07:00",
      "VIAJE_SIN_INICIAR 12/10, 08:30",
      "VIAJE_SIN_INICIAR 12/10, 09:30",
      "VIAJE_SIN_INICIAR 12/10, 10:30",
      "VIAJE_SIN_INICIAR 12/10, 11:30",
    ]);
  });

  it("aceptado el mismo día después de las 7: no programa los que ya pasaron", () => {
    const plan = planRecordatorios(viaje, ar("2026-10-12", "07:40"));
    expect(plan.map((r) => r.tipo)).toEqual(["VIAJE_SIN_INICIAR", "VIAJE_SIN_INICIAR", "VIAJE_SIN_INICIAR", "VIAJE_SIN_INICIAR"]);
  });

  it("'todavía no iniciaste' no pasa de medianoche", () => {
    const plan = planRecordatorios(ar("2026-10-12", "22:30"), ar("2026-10-12", "10:00"));
    expect(plan.filter((r) => r.tipo === "VIAJE_SIN_INICIAR").map((r) => hhmm(r.programadoPara))).toEqual(["12/10, 22:30", "12/10, 23:30"]);
  });

  it("sin duplicados: claves únicas y estables (programar dos veces da lo mismo)", () => {
    const a = planRecordatorios(viaje, ar("2026-10-10", "10:00")).map((r) => claveRecordatorio("claudio", "p1", r));
    const b = planRecordatorios(viaje, ar("2026-10-10", "10:05")).map((r) => claveRecordatorio("claudio", "p1", r));
    expect(new Set(a).size).toBe(a.length);
    expect(b).toEqual(a);
  });

  it("al reprogramar, los viejos dejan de valer y los nuevos no chocan", () => {
    const viejo = planRecordatorios(viaje, ar("2026-10-10", "10:00"));
    const nuevaFecha = ar("2026-10-10", "15:00");
    expect(viejo.every((r) => !sigueValiendo(r, nuevaFecha))).toBe(true);
    const nuevo = planRecordatorios(nuevaFecha, ar("2026-10-10", "10:00"));
    const claves = new Set(viejo.map((r) => claveRecordatorio("claudio", "p1", r)));
    expect(nuevo.some((r) => claves.has(claveRecordatorio("claudio", "p1", r)))).toBe(false);
    expect(nuevo.every((r) => sigueValiendo(r, nuevaFecha))).toBe(true);
  });

  it("vigencia: un 'sin iniciar' de hace más de una hora ya no se manda", () => {
    expect(vigente({ tipo: "VIAJE_SIN_INICIAR", programadoPara: ar("2026-10-12", "08:30") }, ar("2026-10-12", "09:00"))).toBe(true);
    expect(vigente({ tipo: "VIAJE_SIN_INICIAR", programadoPara: ar("2026-10-12", "08:30") }, ar("2026-10-12", "09:45"))).toBe(false);
  });
});

describe("textos de los recordatorios", () => {
  const darwin = { origenTipo: "PROVEEDOR" as const, origen: "Corralón San Martín", destino: "Obra Darwin", paraCuando: ar("2026-10-12", "08:30"), franja: "HORA_EXACTA" as const };
  const chubut = { origenTipo: "DEPOSITO" as const, origen: "Depósito Florida", destino: "Obra Chubut", paraCuando: ar("2026-10-12", "14:00"), franja: "TARDE" as const };

  it("día anterior", () => {
    expect(TEXTO_RECORDATORIO.manana([darwin]).cuerpo).toBe("Mañana tenés un retiro en Corralón San Martín a las 8:30 para Obra Darwin.");
  });
  it("mismo día, uno", () => {
    expect(TEXTO_RECORDATORIO.hoy([darwin]).cuerpo).toBe("Hoy: retiro en Corralón San Martín a las 8:30 para Obra Darwin.");
  });
  it("mismo día, varios: un solo aviso con la lista en orden", () => {
    const t = TEXTO_RECORDATORIO.hoy([chubut, darwin]);
    expect(t.titulo).toBe("Hoy tenés 2 viajes");
    expect(t.cuerpo).toBe("Hoy, en orden: 1) 8:30: retiro en Corralón San Martín para Obra Darwin · 2) por la tarde: retiro en Depósito Florida para Obra Chubut.");
  });
  it("todavía no iniciaste", () => {
    expect(TEXTO_RECORDATORIO.sinIniciar(darwin).cuerpo).toMatch(/^Todavía no iniciaste el viaje a Corralón San Martín \(8:30\)/);
  });
  it("desde la base: es una entrega", () => {
    expect(TEXTO_RECORDATORIO.manana([{ ...darwin, origenTipo: "BASE", origen: "Base Martínez" }]).cuerpo).toBe("Mañana tenés una entrega en Obra Darwin a las 8:30.");
  });
});
