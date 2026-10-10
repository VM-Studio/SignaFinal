import { describe, expect, it } from "vitest";
import { distancia, type Punto } from "@/lib/geo";
import { armarParadas, type PedidoParaParadas } from "./paradas";
import { largo, optimizarOrden, ordenValido, type Precedencia } from "./optimizar";
import { sugerir, validarCombinacion, type PedidoCombinable } from "./sugerencias";
import { repartirCostos } from "./reparto";

// Lugares reales del seed.
const CORRALON_VC = { lat: -34.5875, lng: -58.4575 };
const HUMBOLDT = { lat: -34.5843, lng: -58.4437 };
const DARWIN = { lat: -34.5925, lng: -58.4376 };
const CHUBUT = { lat: -34.6280, lng: -58.4710 };
const PINARES = { lat: -34.4167, lng: -58.7500 };
const MARTINEZ = { lat: -34.4925, lng: -58.5080 };

const pedido = (id: string, origen: { id: string; nombre: string; p: Punto; tipo?: PedidoParaParadas["origenTipo"] }, obra: { id: string; nombre: string; p: Punto }, extra: Partial<PedidoParaParadas> = {}): PedidoParaParadas => ({
  id, origenTipo: origen.tipo ?? "PROVEEDOR", origenId: origen.id, origenNombre: origen.nombre, origenDireccion: "-", origenLat: origen.p.lat, origenLng: origen.p.lng,
  obraId: obra.id, destinoSedeId: null, destinoNombre: `Obra ${obra.nombre}`, destinoDireccion: "-", destinoLat: obra.p.lat, destinoLng: obra.p.lng, obraNombre: obra.nombre, descripcion: `Pedido ${id}`, ...extra,
});
const corralon = { id: "sc-vc", nombre: "Corralón San Martín · Sucursal Villa Crespo", p: CORRALON_VC };
const humboldt = { id: "u-humboldt", nombre: "Terreno Humboldt 2417", p: HUMBOLDT, tipo: "DEPOSITO" as const };
const darwin = { id: "o-darwin", nombre: "Darwin", p: DARWIN };
const chubut = { id: "o-chubut", nombre: "Chubut", p: CHUBUT };

describe("armado de paradas", () => {
  it("agrupa los retiros del mismo lugar y las entregas a la misma obra", () => {
    const a = armarParadas([
      pedido("p1", corralon, darwin, { renglones: [{ descripcion: "Cemento Portland x 50 kg", cantidad: 40, unidad: "bolsas", ordenCompraNumero: "OC-2026-0012" }] }),
      pedido("p2", corralon, chubut, { renglones: [{ descripcion: "Hierro del 12", cantidad: 20, unidad: "barras", ordenCompraNumero: "OC-2026-0010" }] }),
      pedido("p3", humboldt, darwin),
    ]);
    expect(a.paradas.map((p) => `${p.tipo} ${p.nombre} [${p.pedidos.join(",")}]`)).toEqual([
      "RETIRO Corralón San Martín · Sucursal Villa Crespo [p1,p2]",
      "RETIRO Terreno Humboldt 2417 [p3]",
      "ENTREGA Obra Darwin [p1,p3]",
      "ENTREGA Obra Chubut [p2]",
    ]);
    // Los ítems de la carga: uno por renglón, con su OC y su obra.
    expect(a.paradas[0].items.map((i) => `${i.cantidad} ${i.unidad} ${i.descripcion} · ${i.ordenCompraNumero} · ${i.obraNombre}`)).toEqual([
      "40 bolsas Cemento Portland x 50 kg · OC-2026-0012 · Darwin",
      "20 barras Hierro del 12 · OC-2026-0010 · Chubut",
    ]);
  });

  it("un pedido sin retiro (sale de la base con todo arriba) aporta solo la entrega", () => {
    const a = armarParadas([pedido("p1", { id: "base", nombre: "Base Martínez", p: MARTINEZ, tipo: "BASE" }, darwin, { sinRetiro: true })]);
    expect(a.paradas.map((p) => p.tipo)).toEqual(["ENTREGA"]);
    expect(a.asignaciones[0].retiro).toBeNull();
  });
});

describe("orden estratégico", () => {
  // Paradas: R1 corralón, R2 Humboldt, E1 Darwin, E2 Chubut. Partida: Martínez.
  const puntos = [MARTINEZ, CORRALON_VC, HUMBOLDT, DARWIN, CHUBUT];
  const m = puntos.map((a) => puntos.map((b) => distancia(a, b) * 1.3));
  const claves = ["R1", "R2", "E1", "E2"];
  const prec: Precedencia[] = [["R1", "E1"], ["R1", "E2"], ["R2", "E1"]];

  it("respeta que cada entrega vaya después de su retiro", () => {
    const o = optimizarOrden(claves, prec, m);
    expect(ordenValido(o.orden, prec)).toBe(true);
    expect(o.orden.indexOf("R2")).toBeLessThan(o.orden.indexOf("E1"));
  });

  it("no empeora la distancia respecto del orden simple (retiros y después entregas)", () => {
    const o = optimizarOrden(claves, prec, m);
    const simple = largo([1, 2, 3, 4], m);
    expect(o.totalM).toBeLessThanOrEqual(Math.round(simple));
    expect(o.tramos.reduce((s, t) => s + t, 0)).toBeCloseTo(o.totalM, -1);
  });

  it("con un orden del chofer más corto y válido, se queda con ese", () => {
    // Matriz armada para que el vecino más cercano se equivoque.
    const mm = [
      [0, 1, 2, 100],
      [1, 0, 100, 2],
      [2, 100, 0, 100],
      [100, 2, 100, 0],
    ];
    const o = optimizarOrden(["A", "B", "C"], [], mm, { actual: ["B", "A", "C"] });
    expect(largo(o.orden.map((c) => ["A", "B", "C"].indexOf(c) + 1), mm)).toBeLessThanOrEqual(largo([2, 1, 3], mm));
  });

  it("lo ya hecho queda fijo y el resto se ordena desde ahí", () => {
    const o = optimizarOrden(claves, prec, m, { fijas: ["R1"] });
    expect(o.orden[0]).toBe("R1");
    expect(ordenValido(o.orden, prec)).toBe(true);
  });
});

describe("aprovechá el viaje: sugerencias", () => {
  const hoy = "2026-10-10";
  const comb = (id: string, origen: { id: string; nombre: string; p: Punto; tipo?: string }, obra: { nombre: string; p: Punto }, extra: Partial<PedidoCombinable> = {}): PedidoCombinable => ({
    id, numero: 1, tipo: "RETIRO_PROVEEDOR", descripcion: "Material", pesoKg: 500, paraCuando: new Date(`${hoy}T09:00:00-03:00`), solicitante: "Daniela", oc: null,
    origen: { tipo: origen.tipo === "DEPOSITO" ? "DEPOSITO" : "PROVEEDOR_SUCURSAL", id: origen.id, nombre: origen.nombre, punto: origen.p },
    destino: { nombre: `Obra ${obra.nombre}`, obra: obra.nombre, punto: obra.p }, ...extra,
  });
  const base = [comb("cemento", corralon, darwin, { descripcion: "Cemento Portland, 40 bolsas", pesoKg: 1200, oc: "OC-2026-0012" })];

  it("mismo lugar: el hierro para Chubut sale del mismo corralón", () => {
    const s = sugerir(base, [comb("hierro", corralon, chubut, { descripcion: "Hierro del 12, 20 barras", pesoKg: 800, oc: "OC-2026-0010" })], { dia: hoy });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ grupo: "mismoLugar", lugar: "Corralón San Martín", gris: null, texto: "hierro del 12 para Chubut (OC-2026-0010, 800 kg)" });
  });

  it("cerca de tu camino: la hormigonera de Humboldt a ~1,2 km del corralón", () => {
    const s = sugerir(base, [comb("hormigonera", humboldt, darwin, { tipo: "TRASLADO_MAQUINARIA", descripcion: "Hormigonera 350 l", pesoKg: 400 })], { dia: hoy });
    expect(s[0].grupo).toBe("cerca");
    expect(s[0].texto).toMatch(/^A 1,\d km del corralón: retirar hormigonera 350 l en Terreno Humboldt 2417 para Darwin \(va a la misma obra\)$/);
  });

  it("lejos (Pinares, desde otro lugar) no se sugiere", () => {
    const lejos = { id: "otro", nombre: "Corralón Pilar", p: { lat: -34.45, lng: -58.91 } };
    expect(sugerir(base, [comb("pinares", lejos, { nombre: "Pinares", p: PINARES })], { dia: hoy })).toEqual([]);
  });

  it("los de otro día aparecen en gris", () => {
    const jueves = new Date("2026-10-15T09:00:00-03:00");
    const s = sugerir(base, [comb("hierro", corralon, chubut, { paraCuando: jueves })], { dia: hoy });
    expect(s[0].gris).toBe("es para el jueves");
  });

  it("personas y escombros no se combinan", () => {
    const personas = [comb("gente", corralon, darwin, { tipo: "TRASLADO_PERSONAS", pesoKg: null })];
    const s = sugerir(personas, [comb("escombros", corralon, chubut, { tipo: "RETIRO_ESCOMBROS" })], { dia: hoy });
    expect(s[0].gris).toBe("no se combinan personas con escombros");
  });
});

describe("capacidad y límites", () => {
  const kia = { nombre: "Camión Kia", capacidadCargaKg: 3000 };
  const mercedes = { nombre: "Camión Mercedes 710", capacidadCargaKg: 5000 };
  it("no deja combinar 4.000 kg con el Kia de 3.000", () => {
    expect(validarCombinacion([{ tipo: "RETIRO_PROVEEDOR", pesoKg: 4000 }], kia, 2)).toBe("Son 4.000 kg y Camión Kia carga 3.000 kg. Sacá alguno o elegí otro vehículo.");
  });
  it("cemento + hierro + hormigonera (2.400 kg) entran en el Mercedes", () => {
    expect(validarCombinacion([{ tipo: "RETIRO_PROVEEDOR", pesoKg: 1200 }, { tipo: "RETIRO_PROVEEDOR", pesoKg: 800 }, { tipo: "TRASLADO_MAQUINARIA", pesoKg: 400 }], mercedes, 4)).toBeNull();
  });
  it("más de 8 paradas, no", () => {
    expect(validarCombinacion([], mercedes, 9)).toMatch(/máximo por viaje es 8/);
  });
});

describe("reparto de costos", () => {
  it("cada tramo a los pedidos de su parada de llegada; el retiro compartido en partes iguales; peajes iguales", () => {
    // Base → corralón (10 km, retiro de A y B) → Chubut (5 km, entrega B) → Darwin (5 km, entrega A). 20 km reales, $1.000/km, $3.000 de peajes.
    const r = repartirCostos(
      [{ distanciaM: 10_000, pedidos: ["A", "B"] }, { distanciaM: 5_000, pedidos: ["B"] }, { distanciaM: 5_000, pedidos: ["A"] }],
      { kmReales: 20, costoKm: 1000, peajes: 3000, pedidos: ["A", "B"] },
    );
    // A: 5 km del retiro + 5 de su entrega = 10 km → $10.000 + $1.500 de peajes.
    expect(r.get("A")).toEqual({ km: 10, peajes: 1500, costo: 11_500 });
    expect(r.get("B")).toEqual({ km: 10, peajes: 1500, costo: 11_500 });
  });

  it("los km planeados se escalan a los km reales y la suma da exacta al centavo", () => {
    const r = repartirCostos(
      [{ distanciaM: 7_000, pedidos: ["A", "B", "C"] }, { distanciaM: 3_000, pedidos: ["A"] }, { distanciaM: 2_000, pedidos: ["B", "C"] }],
      { kmReales: 13, costoKm: 980, peajes: 1000, pedidos: ["A", "B", "C"] },
    );
    const total = [...r.values()].reduce((s, p) => s + p.costo, 0);
    expect(Math.round(total * 100) / 100).toBe(13 * 980 + 1000);
  });
});
