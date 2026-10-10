/**
 * Reglas del motor de viajes, puras (sin base de datos): con el estado guardado del viaje, una
 * lectura de posición y las paradas que faltan, decide si hay una transición. Las prueba motor.test.ts.
 *
 * Se evalúa la PARADA ACTUAL (la primera que falta): si todavía no llegó, la geocerca de esa parada
 * (radio según el lugar); si ya llegó, la salida (más de radioSalidaM). Si el vehículo se queda quieto
 * en OTRA parada que ya se puede hacer (sus retiros están hechos), es una llegada adelantada: el chofer
 * cambió el orden sobre la marcha y la app pregunta "¿seguimos así?".
 */
import { distancia, type Punto } from "../geo";
import { PARAMETROS_MOTOR as P } from "./parametros";

export type Lectura = Punto & { velocidadKmh: number; fecha: Date };

/** Lo que el motor recuerda entre lecturas (Viaje.motor). Las claves son ids de parada. */
export type EstadoMotor = {
  /** Última lectura válida (para descartar saltos imposibles y repetidas). */
  ultima?: { lat: number; lng: number; fecha: string };
  /** Lecturas seguidas adentro y quieto, contando hacia una llegada. */
  candidato?: { clave: string; primera: string; n: number; distanciaM: number; velocidadKmh: number };
  /** El chofer dijo "No, todavía no": no se vuelve a disparar hasta que salga del radio y vuelva a entrar. */
  rechazo?: { clave: string; fuera: boolean };
  /** Llegada detectada por GPS que el chofer puede negar hasta "hasta". adelantadaDe: la que tocaba antes. */
  pendiente?: { clave: string; hasta: string; adelantadaDe?: string | null; ordenAnterior?: string[] };
  /** Viaje en modo demo: solo cuentan las posiciones simuladas (las reales se ignoran). */
  demo?: boolean;
  /** Ya se le avisó al que pidió que no hay señal (no se repite). */
  sinSenalAvisado?: string;
  /** Última vez que se recalculó la hora con tránsito (tramos.ts). */
  etaEn?: string;
};

export type ParadaMotor = {
  clave: string;
  punto: Punto;
  /** Radio de llegada: el de la geocerca si es una obra; si no, radioLlegadaM. */
  radioM: number;
  estado: "PENDIENTE" | "EN_CAMINO" | "LLEGO";
  /** Se puede hacer ya (para una entrega: su retiro está hecho). */
  habilitada: boolean;
};

export type Contexto = {
  /** Las paradas que faltan, en orden: la primera es la actual. */
  paradas: ParadaMotor[];
  ahora: Date;
};

export type Transicion = { tipo: "llegada" | "salida"; clave: string; fecha: Date; distanciaM: number; velocidadKmh: number; adelantada: boolean };
export type Decision = { estado: EstadoMotor; transicion?: Transicion; descartada?: "vieja" | "repetida" | "salto" | "sin paradas" };

export function decidir(estado: EstadoMotor, l: Lectura, c: Contexto): Decision {
  if (c.ahora.getTime() - l.fecha.getTime() > P.lecturaViejaMs) return { estado, descartada: "vieja" };
  if (estado.ultima) {
    const antes = new Date(estado.ultima.fecha);
    if (l.fecha <= antes) return { estado, descartada: "repetida" };
    const s = (l.fecha.getTime() - antes.getTime()) / 1000;
    if ((distancia(estado.ultima, l) / s) * 3.6 > P.velocidadImposibleKmh) return { estado, descartada: "salto" };
  }
  const nuevo: EstadoMotor = { ...estado, ultima: { lat: l.lat, lng: l.lng, fecha: l.fecha.toISOString() } };
  const [actual, ...resto] = c.paradas;
  if (!actual) return { estado: nuevo, descartada: "sin paradas" };

  // Ya está en la parada: sale cuando se aleja. La última no se cierra sola (falta "Viaje terminado").
  if (actual.estado === "LLEGO") {
    if (!resto.length) return { estado: nuevo };
    const d = distancia(l, actual.punto);
    if (d > P.radioSalidaM) return { estado: limpiar(nuevo), transicion: { tipo: "salida", clave: actual.clave, fecha: l.fecha, distanciaM: Math.round(d), velocidadKmh: l.velocidadKmh, adelantada: false } };
    return { estado: nuevo };
  }

  // Camino a la parada actual (o a otra que ya se puede hacer, si el chofer cambió el orden).
  const objetivos = [actual, ...resto.filter((p) => p.habilitada)];
  return llegada(nuevo, l, objetivos, actual.clave);
}

function limpiar(e: EstadoMotor): EstadoMotor {
  const { candidato: _c, rechazo: _r, ...resto } = e;
  void _c;
  void _r;
  return resto;
}

function llegada(e: EstadoMotor, l: Lectura, objetivos: ParadaMotor[], actual: string): Decision {
  const estado: EstadoMotor = { ...e };
  const dentro = (p: ParadaMotor) => distancia(l, p.punto) <= p.radioM;
  // "No, todavía no": vuelve a valer recién cuando salió del radio y volvió a entrar.
  if (estado.rechazo) {
    const r = objetivos.find((p) => p.clave === estado.rechazo!.clave);
    if (!r) delete estado.rechazo;
    else if (!dentro(r)) estado.rechazo = { ...estado.rechazo, fuera: true };
    else if (estado.rechazo.fuera) delete estado.rechazo;
  }
  const quieto = l.velocidadKmh < P.velocidadParadoKmh;
  const adentro = quieto ? objetivos.find((p) => dentro(p) && estado.rechazo?.clave !== p.clave) : undefined;
  if (!adentro) {
    delete estado.candidato;
    return { estado };
  }
  const d = distancia(l, adentro.punto);
  const sigue = estado.candidato?.clave === adentro.clave;
  const n = sigue ? estado.candidato!.n + 1 : 1;
  const primera = sigue ? estado.candidato! : { primera: l.fecha.toISOString(), distanciaM: Math.round(d), velocidadKmh: l.velocidadKmh };
  if (n >= P.lecturasParaLlegar) {
    delete estado.candidato;
    return { estado, transicion: { tipo: "llegada", clave: adentro.clave, fecha: new Date(primera.primera), distanciaM: primera.distanciaM, velocidadKmh: primera.velocidadKmh, adelantada: adentro.clave !== actual } };
  }
  estado.candidato = { clave: adentro.clave, primera: primera.primera, n, distanciaM: primera.distanciaM, velocidadKmh: primera.velocidadKmh };
  return { estado };
}
