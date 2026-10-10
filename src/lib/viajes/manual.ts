import type { LugarParada } from "@prisma/client";

/**
 * El texto del botón manual según el lugar de la parada actual (pura: la prueban los tests).
 *   proveedor → "Llegué al proveedor" / "Salgo del proveedor"
 *   depósito con etiqueta Galpón o Terreno → "Llegué al galpón" / "Llegué al terreno"
 *   obra o sede → "Llegué a la obra" · base → "Llegué a la base"
 */
export type LugarManual = { lugarTipo: LugarParada; etiqueta?: string | null };

function lugar(l: LugarManual): { al: string; del: string } {
  switch (l.lugarTipo) {
    case "PROVEEDOR_SUCURSAL":
      return { al: "al proveedor", del: "del proveedor" };
    case "DEPOSITO": {
      const e = l.etiqueta?.trim().toLowerCase();
      if (e === "galpón" || e === "galpon") return { al: "al galpón", del: "del galpón" };
      if (e === "terreno") return { al: "al terreno", del: "del terreno" };
      return { al: "al depósito", del: "del depósito" };
    }
    case "OBRA":
    case "OBRA_SEDE":
      return { al: "a la obra", del: "de la obra" };
    case "BASE":
      return { al: "a la base", del: "de la base" };
    default:
      return { al: "al lugar", del: "del lugar" };
  }
}

export const textoLlegue = (l: LugarManual) => `Llegué ${lugar(l).al}`;
export const textoSalgo = (l: LugarManual) => `Salgo ${lugar(l).del}`;
