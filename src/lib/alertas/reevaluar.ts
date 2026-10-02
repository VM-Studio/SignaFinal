import "server-only";
import { after } from "next/server";
import { evaluarAlertas } from "./index";
import type { Modulo } from "./tipos";

/** Después de una acción: reevaluar solo el módulo afectado, sin demorar la respuesta. */
export function reevaluar(...modulos: Modulo[]) {
  after(async () => {
    try {
      await evaluarAlertas(modulos);
    } catch (e) {
      console.error("No se pudieron reevaluar las alertas", modulos, e);
    }
  });
}
