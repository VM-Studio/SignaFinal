import { describe, expect, it } from "vitest";
import type { Rol } from "@prisma/client";
import { MATRIZ } from "./permisos";
import { barraInferior, menuMas, rutasSinEnlace } from "./navegacion";

const ROLES = Object.keys(MATRIZ) as Rol[];

describe("navegación por rol", () => {
  it.each(ROLES)("%s: ninguna ruta permitida queda sin enlace", (rol) => {
    expect(rutasSinEnlace(rol, MATRIZ[rol].rutas)).toEqual([]);
  });
  it.each(ROLES)("%s: la barra tiene 3 ítems + Más", (rol) => {
    expect(barraInferior(rol)).toHaveLength(3);
    expect(menuMas(rol).length).toBeGreaterThan(0);
  });
  it("lo más usado adelante (tabla de CLAUDE.md)", () => {
    const barra = (r: Rol) => barraInferior(r).map((s) => s.titulo);
    expect(barra("DIRECCION")).toEqual(["Aprobaciones", "Pedidos", "Avisos"]);
    expect(barra("COMPRAS")).toEqual(["Tablero", "Pedidos", "Viajes"]);
    expect(barra("RESPONSABLE_OBRA")).toEqual(["Pedir", "Mis pedidos", "Viajes"]);
    expect(barra("CAPATAZ")).toEqual(["Pedir", "Mis pedidos", "Viajes"]);
    expect(barra("CHOFER")).toEqual(["Hoy", "Solicitudes", "Avisos"]);
    expect(barra("DEPOSITO")).toEqual(["Buscar", "Herramientas", "Entregas"]);
    expect(barra("ADMINISTRACION")).toEqual(["Flota", "Costos", "Alertas"]);
  });
});
