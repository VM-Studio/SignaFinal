import type { ClienteCusat, PosicionCusat } from "./tipos";

/**
 * Simula vehículos moviéndose por zona norte. Cada vehículo recorre en bucle
 * un circuito propio (derivado de su idCusat); algunos quedan estacionados.
 * Es determinístico en el tiempo: dos pedidos al mismo segundo dan lo mismo.
 */

const PUNTOS: [number, number][] = [
  [-34.4935, -58.5062], // Martínez (cochera)
  [-34.5019, -58.5463], // San Isidro
  [-34.5081, -58.4952], // Olivos
  [-34.5226, -58.4876], // Vicente López
  [-34.4733, -58.5307], // San Isidro norte
  [-34.4961, -58.5545], // Boulogne
  [-34.5268, -58.5229], // Munro
  [-34.4092, -58.6461], // Nordelta
  [-34.4246, -58.5806], // Tigre
  [-34.5925, -58.4376], // CABA
];

function hash(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function circuito(idCusat: string): [number, number][] {
  const h = hash(idCusat);
  const largo = 3 + (h % 3);
  const ruta: [number, number][] = [PUNTOS[0]];
  for (let i = 1; i <= largo; i++) ruta.push(PUNTOS[1 + ((h >> (i * 3)) % (PUNTOS.length - 1))]);
  return ruta;
}

function rumboEntre(a: [number, number], b: [number, number]) {
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return (ang + 360) % 360;
}

function posicionEn(idCusat: string, instante: Date): PosicionCusat {
  const h = hash(idCusat);
  const estacionado = h % 4 === 0;
  const ruta = circuito(idCusat);
  if (estacionado) {
    return {
      idCusat,
      lat: ruta[0][0] + ((h % 7) - 3) * 0.0003,
      lng: ruta[0][1] + ((h % 5) - 2) * 0.0003,
      velocidadKmh: 0,
      rumbo: 0,
      motorEncendido: false,
      registradaEn: instante.toISOString(),
    };
  }
  // Una vuelta completa cada 40 minutos.
  const periodo = 40 * 60 * 1000;
  const fase = ((instante.getTime() + (h % periodo)) % periodo) / periodo;
  const tramos = ruta.length;
  const t = fase * tramos;
  const i = Math.floor(t);
  const a = ruta[i % tramos];
  const b = ruta[(i + 1) % tramos];
  const f = t - i;
  return {
    idCusat,
    lat: a[0] + (b[0] - a[0]) * f,
    lng: a[1] + (b[1] - a[1]) * f,
    velocidadKmh: 25 + (h % 30),
    rumbo: rumboEntre(a, b),
    motorEncendido: true,
    registradaEn: instante.toISOString(),
  };
}

export class CusatMock implements ClienteCusat {
  readonly origen = "mock" as const;

  async posicionesActuales(idsCusat: string[]) {
    const ahora = new Date();
    return idsCusat.map((id) => posicionEn(id, ahora));
  }

  async historial(idCusat: string, desde: Date, hasta: Date) {
    const puntos: PosicionCusat[] = [];
    const paso = 60 * 1000;
    for (let t = desde.getTime(); t <= hasta.getTime() && puntos.length < 1440; t += paso) {
      puntos.push(posicionEn(idCusat, new Date(t)));
    }
    return puntos;
  }
}
