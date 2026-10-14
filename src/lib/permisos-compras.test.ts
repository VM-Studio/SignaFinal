import { describe, expect, it } from "vitest";
import type { Rol } from "@prisma/client";
import { MATRIZ, puede, rutaPermitida } from "./permisos";

/**
 * Pasada de permisos de Compras (Prompt 5): la obra no ve el tablero ni importes de OC; el chofer no ve
 * importes; Compras no ve costos de flota; solo el dueño edita los numeradores.
 */
const ROLES = Object.keys(MATRIZ) as Rol[];

describe("permisos de Compras", () => {
  it("RESPONSABLE_OBRA y CAPATAZ no ven el tablero, las órdenes, la importación ni la configuración de Compras", () => {
    for (const rol of ["RESPONSABLE_OBRA", "CAPATAZ"] as Rol[]) {
      for (const r of ["/compras/tablero", "/compras/ordenes", "/compras/ordenes/nueva", "/compras/importar", "/compras/viajes", "/configuracion/compras", "/aprobaciones"]) expect(rutaPermitida(rol, r), `${rol} ${r}`).toBe(false);
      expect(puede(rol, "materiales.gestionar")).toBe(false);
      expect(puede(rol, "materiales.aprobar")).toBe(false);
      expect(puede(rol, "dolar.ver")).toBe(false);
    }
  });
  it("CHOFER no ve importes ni costos", () => {
    for (const r of ["/compras/tablero", "/compras/ordenes", "/costos", "/aprobaciones"]) expect(rutaPermitida("CHOFER", r)).toBe(false);
    for (const p of ["materiales.gestionar", "materiales.aprobar", "costos.ver", "dolar.ver"] as const) expect(puede("CHOFER", p)).toBe(false);
  });
  it("COMPRAS no ve costos de flota ni la flota", () => {
    for (const r of ["/costos", "/flota", "/flota/agenda", "/flota/mantenimiento"]) expect(rutaPermitida("COMPRAS", r)).toBe(false);
    expect(puede("COMPRAS", "costos.ver")).toBe(false);
    expect(puede("COMPRAS", "flota.ver")).toBe(false);
  });
  it("COMPRAS coordina viajes pero no acepta ni inicia", () => {
    expect(puede("COMPRAS", "pedidos.coordinar")).toBe(true);
    expect(puede("COMPRAS", "pedidos.tomar")).toBe(false);
    expect(puede("COMPRAS", "viajes.ejecutar")).toBe(false);
  });
  it("solo DIRECCION edita los numeradores de OC y PE", () => {
    expect(ROLES.filter((r) => puede(r, "compras.numeradores"))).toEqual(["DIRECCION"]);
  });
  it("razones sociales: DIRECCION y ADMINISTRACION", () => {
    expect(ROLES.filter((r) => puede(r, "razonesSociales.editar")).sort()).toEqual(["ADMINISTRACION", "DIRECCION"]);
  });
  it("el tablero lo ven Compras, el dueño y Administración (esta solo mira)", () => {
    expect(ROLES.filter((r) => rutaPermitida(r, "/compras/tablero")).sort()).toEqual(["ADMINISTRACION", "COMPRAS", "DIRECCION"]);
    expect(puede("ADMINISTRACION", "materiales.gestionar")).toBe(false);
  });
});
