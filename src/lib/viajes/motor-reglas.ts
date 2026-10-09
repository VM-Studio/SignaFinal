/**
 * Reglas del motor de viajes, puras (sin base de datos): con el estado guardado del viaje, una
 * lectura de posición y el contexto, decide si hay una transición. Las prueba motor.test.ts.
 */
import { distancia, type Punto } from "../geo";
import { PARAMETROS_MOTOR as P } from "./parametros";

export type EtapaMotor = "PROGRAMADO" | "HACIA_RETIRO" | "EN_RETIRO" | "HACIA_DESTINO" | "EN_DESTINO" | "FINALIZADO";
export type Llegada = "EN_RETIRO" | "EN_DESTINO";

export type Lectura = Punto & { velocidadKmh: number; fecha: Date };

/** Lo que el motor recuerda entre lecturas (Viaje.motor). */
export type EstadoMotor = {
  /** Última lectura válida (para descartar saltos imposibles y repetidas). */
  ultima?: { lat: number; lng: number; fecha: string };
  /** Lecturas seguidas adentro y quieto, contando hacia una llegada. */
  candidato?: { etapa: Llegada; primera: string; n: number; distanciaM: number; velocidadKmh: number };
  /** El chofer dijo "No, todavía no": no se vuelve a disparar hasta que salga del radio y vuelva a entrar. */
  rechazo?: { etapa: Llegada; fuera: boolean };
  /** Llegada detectada por GPS que el chofer puede negar hasta "hasta". */
  pendiente?: { etapa: Llegada; hasta: string };
  /** Viaje en modo demo: solo cuentan las posiciones simuladas (las reales se ignoran). */
  demo?: boolean;
  /** Ya se le avisó al que pidió que no hay señal (no se repite). */
  sinSenalAvisado?: string;
};

export type Contexto = {
  etapa: EtapaMotor;
  /** Null si el viaje no tiene punto de retiro distinto del origen. */
  retiro: Punto | null;
  destino: Punto;
  radioRetiroM: number;
  radioDestinoM: number;
  ahora: Date;
};

export type Transicion = { a: "EN_RETIRO" | "HACIA_DESTINO" | "EN_DESTINO"; fecha: Date; distanciaM: number; velocidadKmh: number };
export type Decision = { estado: EstadoMotor; transicion?: Transicion; descartada?: "vieja" | "repetida" | "salto" };

export function decidir(estado: EstadoMotor, l: Lectura, c: Contexto): Decision {
  if (c.ahora.getTime() - l.fecha.getTime() > P.lecturaViejaMs) return { estado, descartada: "vieja" };
  if (estado.ultima) {
    const antes = new Date(estado.ultima.fecha);
    if (l.fecha <= antes) return { estado, descartada: "repetida" };
    const s = (l.fecha.getTime() - antes.getTime()) / 1000;
    if ((distancia(estado.ultima, l) / s) * 3.6 > P.velocidadImposibleKmh) return { estado, descartada: "salto" };
  }
  const nuevo: EstadoMotor = { ...estado, ultima: { lat: l.lat, lng: l.lng, fecha: l.fecha.toISOString() } };

  switch (c.etapa) {
    case "HACIA_RETIRO":
      // Sin punto de retiro: el tramo es directo a la obra.
      if (!c.retiro) return { estado: limpiar(nuevo), transicion: { a: "HACIA_DESTINO", fecha: l.fecha, distanciaM: 0, velocidadKmh: l.velocidadKmh } };
      return llegada(nuevo, l, c.retiro, c.radioRetiroM, "EN_RETIRO");
    case "EN_RETIRO": {
      const d = c.retiro ? distancia(l, c.retiro) : Infinity;
      if (d > P.radioSalidaM) return { estado: limpiar(nuevo), transicion: { a: "HACIA_DESTINO", fecha: l.fecha, distanciaM: Math.round(d), velocidadKmh: l.velocidadKmh } };
      return { estado: nuevo };
    }
    case "HACIA_DESTINO":
      return llegada(nuevo, l, c.destino, c.radioDestinoM, "EN_DESTINO");
    default:
      // Una vez pasada una etapa no se vuelve atrás por GPS.
      return { estado: nuevo };
  }
}

function limpiar(e: EstadoMotor): EstadoMotor {
  const { candidato: _c, rechazo: _r, ...resto } = e;
  void _c;
  void _r;
  return resto;
}

function llegada(e: EstadoMotor, l: Lectura, punto: Punto, radio: number, a: Llegada): Decision {
  const d = distancia(l, punto);
  const adentro = d <= radio;
  const estado: EstadoMotor = { ...e };
  if (estado.rechazo && estado.rechazo.etapa === a) {
    if (!adentro) estado.rechazo = { ...estado.rechazo, fuera: true };
    else if (estado.rechazo.fuera) delete estado.rechazo; // salió y volvió a entrar: vale de nuevo
    if (estado.rechazo) {
      delete estado.candidato;
      return { estado };
    }
  }
  if (!adentro || l.velocidadKmh >= P.velocidadParadoKmh) {
    delete estado.candidato;
    return { estado };
  }
  const n = estado.candidato?.etapa === a ? estado.candidato.n + 1 : 1;
  const primera = estado.candidato?.etapa === a ? estado.candidato : { primera: l.fecha.toISOString(), distanciaM: Math.round(d), velocidadKmh: l.velocidadKmh };
  if (n >= P.lecturasParaLlegar) {
    delete estado.candidato;
    return { estado, transicion: { a, fecha: new Date(primera.primera), distanciaM: primera.distanciaM, velocidadKmh: primera.velocidadKmh } };
  }
  estado.candidato = { etapa: a, primera: primera.primera, n, distanciaM: primera.distanciaM, velocidadKmh: primera.velocidadKmh };
  return { estado };
}
