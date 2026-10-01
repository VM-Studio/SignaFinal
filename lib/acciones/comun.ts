import "server-only";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { evaluarAlertas } from "@/lib/alertas";

/** Después de cada cambio: refrescar pantallas y recalcular alertas sin demorar la respuesta. */
export function despuesDeCambiar() {
  revalidatePath("/", "layout");
  after(async () => {
    try {
      await evaluarAlertas();
    } catch (e) {
      console.error("No se pudieron recalcular las alertas", e);
    }
  });
}

/** Problemas de documentación que impiden usar un vehículo. */
export function problemasVehiculo(v: { nombre: string; seguroVence: Date | null; vtvVence: Date | null; activo: boolean }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const problemas: string[] = [];
  if (!v.activo) problemas.push("está dado de baja");
  if (!v.seguroVence) problemas.push("no tiene seguro cargado");
  else if (v.seguroVence < hoy) problemas.push("tiene el seguro vencido");
  if (!v.vtvVence) problemas.push("no tiene VTV cargada");
  else if (v.vtvVence < hoy) problemas.push("tiene la VTV vencida");
  return problemas;
}

export function licenciaVencida(licenciaVence: Date | null) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return !licenciaVence || licenciaVence < hoy;
}
