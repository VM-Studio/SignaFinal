import { describe, expect, it } from "vitest";
import type { Rol } from "@prisma/client";
import { inicioDe, MATRIZ, rutaNueva } from "./permisos";
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
    expect(barra("DIRECCION")).toEqual(["Aprobaciones", "Pedidos", "Pedir un viaje"]);
    expect(barra("COMPRAS")).toEqual(["Tablero", "Pedidos", "Viajes"]);
    expect(barra("RESPONSABLE_OBRA")).toEqual(["Pedir", "Mis pedidos", "Viajes"]);
    expect(barra("CAPATAZ")).toEqual(["Pedir", "Mis pedidos", "Viajes"]);
    expect(barra("CHOFER")).toEqual(["Hoy", "Solicitudes", "Avisos"]);
    expect(barra("DEPOSITO")).toEqual(["Herramientas", "Entregas", "Sobrantes"]);
    expect(barra("ADMINISTRACION")).toEqual(["Facturación", "Costos", "Tablero"]);
  });
  it.each(ROLES)("%s: Inicio no está en Más (es el logo)", (rol) => {
    expect(menuMas(rol).flatMap((g) => g.items.map((s) => s.href))).not.toContain("/inicio");
  });
  it("el Más del dueño sin duplicados de viajes ni de pedir", () => {
    const mas = menuMas("DIRECCION").flatMap((g) => g.items.map((s) => s.titulo));
    expect(mas.length).toBeLessThanOrEqual(25);
    for (const t of ["Vista del chofer", "Viajes hacia obras", "Recorridos del día", "Pedir materiales", "Agenda", "Mantenimiento"]) expect(mas).not.toContain(t);
  });
  it("dónde cae cada uno: Compras en el Tablero, el chofer en Hoy, Depósito en Herramientas; /inicio los lleva ahí", () => {
    expect(inicioDe("COMPRAS")).toBe("/compras/tablero");
    expect(inicioDe("CHOFER")).toBe("/hoy");
    expect(inicioDe("DEPOSITO")).toBe("/herramientas");
    expect(inicioDe("DIRECCION")).toBe("/aprobaciones");
    expect(inicioDe("ADMINISTRACION")).toBe("/compras/facturacion");
    expect(rutaNueva("CHOFER", "/inicio")).toBe("/hoy");
    expect(rutaNueva("RESPONSABLE_OBRA", "/inicio")).toBe("/pedir");
    // Sin página de inicio: todos entran al primer módulo de su barra.
    for (const rol of Object.keys(MATRIZ) as (keyof typeof MATRIZ)[]) expect(inicioDe(rol)).toBe(barraInferior(rol)[0].href.split("?")[0]);
  });
});
