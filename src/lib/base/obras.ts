import type { PrismaClient } from "@prisma/client";
import { buscarDireccion } from "@/lib/geo/buscar";
import { distancia } from "@/lib/geo";

/**
 * OBRAS REALES de Signa (reunión con el dueño, 10/10/2026). Se geocodifican al cargarse (Nominatim,
 * con caché); si no se encuentra la dirección, quedan las coordenadas aproximadas marcadas "confirmar".
 * Responsables por email (src/lib/base/datos.ts, USUARIOS). Lolo (capataz) y César están en todas;
 * César es el principal en Chubut y Gaspar Campos.
 */
export type ObraReal = {
  codigo: string;
  nombre: string;
  direccion: string;
  localidad: string;
  /** Lo que se le pasa al geocodificador. Null: no se busca (dirección a confirmar). */
  busqueda: string | null;
  /** Aproximadas, por si el geocodificador no la encuentra. */
  aprox: { lat: number; lng: number };
  responsables: string[];
  principal: string | null;
  /** Nombres con los que ya puede estar cargada (para no duplicarla). */
  alias?: string[];
  confirmar?: string;
};

export const OBRAS_REALES: ObraReal[] = [
  {
    codigo: "OB-ATHOMAS", nombre: "Álvarez Thomas 1545", direccion: "Av. Álvarez Thomas 1545", localidad: "Villa Urquiza, CABA",
    busqueda: "Avenida Álvarez Thomas 1545, Villa Urquiza, Buenos Aires", aprox: { lat: -34.5781, lng: -58.4683 },
    responsables: ["vicky"], principal: "vicky", alias: ["A. Thomas", "Laura Thomas", "Alvarez Thomas"],
    confirmar: "Responsable Vicky (en la reunión se la nombró como \"Laura Thomas\")",
  },
  {
    codigo: "OB-BAYRES", nombre: "Bayres Connect", direccion: "Camino del Buen Ayre y Panamericana", localidad: "San Isidro",
    busqueda: null, aprox: { lat: -34.5034, lng: -58.5733 }, // confirmar: cruce Camino del Buen Ayre y Panamericana
    responsables: ["leandro"], principal: "leandro", confirmar: "Responsable Leandro y ubicación exacta",
  },
  {
    codigo: "OB-CHUBUT", nombre: "Chubut 550", direccion: "Chubut 550", localidad: "Benavídez, Tigre",
    busqueda: "Chubut 550, Benavídez, Tigre", aprox: { lat: -34.4124, lng: -58.6936 }, // confirmar
    responsables: [], principal: "cesar", alias: ["Chubut"],
  },
  {
    codigo: "OB-DARWIN", nombre: "Darwin 1299", direccion: "Darwin 1299", localidad: "Villa Crespo, CABA",
    busqueda: "Darwin 1299, Villa Crespo, Buenos Aires", aprox: { lat: -34.5926, lng: -58.4392 },
    responsables: ["daniela"], principal: "daniela", alias: ["Darwin"],
  },
  {
    codigo: "OB-GCAMPOS", nombre: "Gaspar Campos 275", direccion: "Gaspar Campos 275", localidad: "San Fernando",
    busqueda: "Gaspar Campos 275, San Fernando, Buenos Aires", aprox: { lat: -34.4448, lng: -58.5613 }, // confirmar
    responsables: [], principal: "cesar", alias: ["Gaspar Campos"],
  },
  {
    codigo: "OB-BLASPAREDA", nombre: "Blaspareda 100", direccion: "Blaspareda 100", localidad: "Ingeniero Maschwitz, Escobar",
    busqueda: "Blaspareda 100, Ingeniero Maschwitz", aprox: { lat: -34.3815, lng: -58.7404 }, // confirmar
    responsables: ["leandro"], principal: "leandro", alias: ["Blaspareda"],
    confirmar: "Nombre correcto de la calle (\"Blaspareda\") y responsable Leandro",
  },
  {
    codigo: "OB-PINARES2", nombre: "Pinares II Country Club", direccion: "Pinares II Country Club", localidad: "Exaltación de la Cruz",
    busqueda: "Pinares II, Exaltación de la Cruz", aprox: { lat: -34.2983, lng: -59.0972 }, // confirmar
    responsables: ["daniela"], principal: "daniela", alias: ["Pinares II", "Pinares"],
  },
  {
    codigo: "OB-MEDIT", nombre: "Hotel Medit", direccion: "Hotel Medit", localidad: "San Telmo, CABA",
    busqueda: null, aprox: { lat: -34.6212, lng: -58.3731 }, // confirmar: dirección exacta en San Telmo
    responsables: [], principal: null, alias: ["Medit"], confirmar: "Responsable y dirección exacta (obra corta)",
  },
  {
    codigo: "OB-EDEN", nombre: "Edén", direccion: "Dirección a confirmar", localidad: "Interior",
    busqueda: null, aprox: { lat: -34.6037, lng: -58.3816 }, // confirmar: obra del interior, coordenadas provisorias
    responsables: [], principal: null, confirmar: "Dirección y responsable (obra del interior, puede tener varias sedes)",
  },
];

/** Depósitos y base reales. */
export const UBICACIONES_REALES = [
  { nombre: "Base de camiones Martínez", tipo: "BASE_VEHICULOS" as const, etiqueta: "Base", direccion: "Triunfo Argentino y Granada, Martínez, San Isidro", localidad: "Martínez", busqueda: null, aprox: { lat: -34.49902, lng: -58.54408 } },
  { nombre: "Depósito Florida", tipo: "DEPOSITO" as const, etiqueta: "Galpón", direccion: "Av. Bartolomé Mitre 1254, Florida, Vicente López", localidad: "Florida", busqueda: null, aprox: { lat: -34.53837, lng: -58.50767 } },
  { nombre: "Terreno Humboldt 2417", tipo: "DEPOSITO" as const, etiqueta: "Terreno", direccion: "Humboldt 2417", localidad: "Villa Crespo, CABA", busqueda: "Humboldt 2417, Villa Crespo, Buenos Aires", aprox: { lat: -34.5867, lng: -58.4431 } },
];

/**
 * Coordenadas de una dirección real: la del geocodificador si la encuentra cerca de la aproximada
 * (menos de 25 km: nunca una calle homónima de otra provincia); si no, la aproximada.
 */
export async function ubicar(db: PrismaClient, busqueda: string | null, aprox: { lat: number; lng: number }) {
  if (!busqueda) return { ...aprox, geocodificada: false };
  const [c] = await buscarDireccion(busqueda, db).catch(() => []);
  // Encontró la calle: se usa. Si no trae el número de puerta, la ubicación queda para confirmar.
  if (c && distancia(c, aprox) < 25_000) return { lat: c.lat, lng: c.lng, geocodificada: !/\d/.test(busqueda) || !!c.exacta };
  return { ...aprox, geocodificada: false };
}
