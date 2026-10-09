/**
 * Datos de demostración de SIGNA · Logística con los datos reales de la empresa.
 * Lo que no sabemos se inventó verosímil y está marcado con "// confirmar".
 * La usan prisma/seed.ts y el botón "Reiniciar datos de demo" (solo con MODO_DEMO=true).
 *
 * Borra y recarga todo: usar solo en desarrollo / demo.
 */
import {
  type PrismaClient,
  Prisma,
  type Rol,
  type TipoPedido,
  type OrigenTipo,
  type EstadoMaterial,
  type EstadoMaterialListo,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolverPuntos, type Puntos } from "@/lib/pedidos/puntos";
import { largo, puntoEn, type Punto } from "@/lib/geo";

let db: PrismaClient;

const D = (n: number | string) => new Prisma.Decimal(n);

const DIA = 86_400_000;
const HORA = 3_600_000;
const ahora = new Date();
const haceDias = (n: number, hora = 10) => {
  const d = new Date(ahora.getTime() - n * DIA);
  d.setHours(hora, 0, 0, 0);
  return d;
};
// Mediodía argentino de dentro de n días: así las fechas sin hora (@db.Date) caen en el día
// argentino correcto aunque se cargue de noche (después de las 21 ya es mañana en UTC).
const hoyAR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);
const enDias = (n: number) => new Date(new Date(`${hoyAR}T12:00:00-03:00`).getTime() + n * DIA);
const haceHoras = (n: number) => new Date(ahora.getTime() - n * HORA);
const hhmm = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

// Generador pseudoaleatorio con semilla: el seed da siempre lo mismo.
let semilla = 20261001;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a: number, b: number) => Math.floor(a + azar() * (b - a + 1));

async function limpiar() {
  // Orden inverso a las dependencias.
  await db.$executeRawUnsafe(`ALTER TABLE "Auditoria" DISABLE TRIGGER USER`).catch(() => {});
  await db.auditoria.deleteMany();
  await db.$executeRawUnsafe(`ALTER TABLE "Auditoria" ENABLE TRIGGER USER`).catch(() => {});
  await db.alerta.deleteMany();
  await db.notificacion.deleteMany();
  await db.suscripcionPush.deleteMany();
  await db.mantenimientoHerramienta.deleteMany();
  await db.materialSobrante.deleteMany();
  await db.movimientoHerramienta.deleteMany();
  await db.existenciaHerramienta.deleteMany();
  await db.herramienta.deleteMany();
  await db.categoriaHerramienta.deleteMany();
  await db.posicionVehiculo.deleteMany();
  await db.viaje.deleteMany();
  await db.materialListo.deleteMany();
  await db.cambioEstadoMaterial.deleteMany();
  await db.pedidoMaterial.deleteMany();
  await db.pedidoViaje.deleteMany();
  await db.incidenteVehiculo.deleteMany();
  await db.mantenimientoVehiculo.deleteMany();
  await db.cargaCombustible.deleteMany();
  await db.documentoVehiculo.deleteMany();
  await db.usuario.updateMany({ data: { vehiculoAsignadoId: null } });
  await db.vehiculo.deleteMany();
  await db.responsableObra.deleteMany();
  await db.obra.deleteMany();
  await db.proveedor.deleteMany();
  await db.ubicacion.deleteMany();
  await db.usuario.deleteMany();
}

export async function cargarDatosDemo(cliente: PrismaClient) {
  db = cliente;
  semilla = 20261001;
  await limpiar();
  const passwordHash = await bcrypt.hash("signa2026", 10);

  // ─────────────────────────── Usuarios ───────────────────────────
  const usuario = (nombre: string, email: string, rol: Rol, extra: Partial<Prisma.UsuarioCreateInput> = {}) =>
    db.usuario.create({ data: { nombre, email: `${email}@signa.demo`, rol, passwordHash, ...extra } });

  const dueno = await usuario("Dirección", "direccion", "DIRECCION"); // confirmar nombre del dueño
  const leandro = await usuario("Leandro", "leandro", "RESPONSABLE_OBRA", { telefono: "11 5000-1001" }); // confirmar teléfonos
  const daniela = await usuario("Daniela", "daniela", "RESPONSABLE_OBRA", { telefono: "11 5000-1002" });
  const cesar = await usuario("César", "cesar", "RESPONSABLE_OBRA", { telefono: "11 5000-1003" });
  const vicky = await usuario("Vicky", "vicky", "RESPONSABLE_OBRA", { telefono: "11 5000-1004" });
  const lolo = await usuario("Lolo", "lolo", "CAPATAZ", { telefono: "11 5000-1005" });
  const claudio = await usuario("Claudio", "claudio", "CHOFER", { telefono: "11 5000-1006", licenciaCategoria: "C2", licenciaVencimiento: enDias(410) }); // confirmar licencia
  const cristian = await usuario("Cristian", "cristian", "CHOFER", { telefono: "11 5000-1007", licenciaCategoria: "C2", licenciaVencimiento: enDias(220) }); // confirmar licencia
  const david = await usuario("David", "david", "CHOFER", { telefono: "11 5000-1008", licenciaCategoria: "B1", licenciaVencimiento: enDias(95) }); // confirmar licencia
  const deposito = await usuario("Encargado de depósito", "deposito", "DEPOSITO"); // confirmar nombre
  await usuario("Administración", "administracion", "ADMINISTRACION"); // confirmar nombre
  const compras = await usuario("Compras", "compras", "COMPRAS", { telefono: "11 5000-1010" }); // confirmar nombre y teléfono

  // ────────────────────────── Ubicaciones ──────────────────────────
  const base = await db.ubicacion.create({
    // Donde Cusat muestra los camiones parados (Triunfo Argentino / Granada y Maestro).
    data: { nombre: "Base de camiones Martínez", tipo: "BASE_VEHICULOS", direccion: "Triunfo Argentino y Granada, Martínez, San Isidro", latitud: -34.4986, longitud: -58.5236 }, // confirmar coordenadas
  });
  // El depósito de herramientas y maquinaria son dos terrenos; las herramientas viven en el Terreno 1.
  const depo = await db.ubicacion.create({
    data: { nombre: "Terreno 1", tipo: "DEPOSITO", direccion: "Av. Bernardo Ader 1600, Munro", latitud: -34.5286, longitud: -58.5266 }, // confirmar dirección
  });
  await db.ubicacion.create({
    data: { nombre: "Terreno 2", tipo: "DEPOSITO", direccion: "Granada y Maestro, Martínez", latitud: -34.4979, longitud: -58.5249 }, // confirmar dirección
  });

  // ──────────────────────────── Obras ────────────────────────────
  const obra = (codigo: string, nombre: string, direccion: string, localidad: string, latitud: number, longitud: number) =>
    db.obra.create({ data: { codigo, nombre, direccion, localidad, latitud, longitud, idLebane: `LB-${codigo}` } });

  // Direcciones y coordenadas verosímiles: confirmar todas con Lebane.
  const darwin = await obra("OB-01", "Darwin", "Darwin 1154", "Villa Crespo, CABA", -34.5925, -58.4376); // confirmar
  const pinares = await obra("OB-02", "Pinares II", "Av. de los Lagos 7008", "Nordelta, Tigre", -34.4092, -58.6461); // confirmar
  const chubut = await obra("OB-03", "Chubut", "Chubut 1621", "Olivos", -34.5081, -58.4952); // confirmar
  const gaspar = await obra("OB-04", "Gaspar Campos", "Gaspar Campos 1950", "Vicente López", -34.5226, -58.4876); // confirmar
  const laura = await obra("OB-05", "Laura Thomas", "Laura Thomas 2450", "San Isidro", -34.4733, -58.5307); // confirmar
  const cabildo = await obra("OB-06", "Cabildo", "Av. Cabildo 3900", "Núñez, CABA", -34.5462, -58.4693); // confirmar
  const alvear = await obra("OB-07", "Alvear", "Alvear 2210", "Martínez", -34.4951, -58.5154); // confirmar
  const parana = await obra("OB-08", "Paraná", "Paraná 3700", "Olivos", -34.5115, -58.5122); // confirmar
  const obras = [darwin, pinares, chubut, gaspar, laura, cabildo, alvear, parana];

  // Responsables reales: Daniela en Darwin y Pinares II; César en todas (principal en Chubut y
  // Gaspar Campos); Vicky en Laura Thomas; Leandro en Cabildo, Alvear y Paraná.
  const principalDe = new Map<string, typeof daniela>([
    [darwin.id, daniela], [pinares.id, daniela], [chubut.id, cesar], [gaspar.id, cesar],
    [laura.id, vicky], [cabildo.id, leandro], [alvear.id, leandro], [parana.id, leandro],
  ]);
  const resp = (o: { id: string }) => principalDe.get(o.id)!;
  for (const o of obras) {
    await db.responsableObra.create({ data: { obraId: o.id, usuarioId: resp(o).id, principal: true } });
    if (resp(o).id !== cesar.id) await db.responsableObra.create({ data: { obraId: o.id, usuarioId: cesar.id, principal: false } });
  }

  // ────────────────────────── Proveedores ──────────────────────────
  const proveedor = (nombre: string, direccion: string, localidad: string, latitud: number, longitud: number, telefono: string) =>
    db.proveedor.create({ data: { nombre, direccion, localidad, latitud, longitud, telefono } });

  // Corralones y ferreterías de zona norte: confirmar nombres y direcciones con Lebane.
  const ceibo = await proveedor("Corralón El Ceibo", "Av. Fondo de la Legua 1850", "San Isidro", -34.5019, -58.5463, "11 4743-2200"); // confirmar
  const hierros = await proveedor("Hierros Martínez", "Av. Santa Fe 2900", "Martínez", -34.4921, -58.5101, "11 4792-8811"); // confirmar
  const munro = await proveedor("Corralón Munro", "Av. Mitre 2600", "Munro", -34.5302, -58.5199, "11 4756-3030"); // confirmar
  const boulogne = await proveedor("Materiales Boulogne", "Av. Avelino Rolón 1500", "Boulogne", -34.4985, -58.5712, "11 4737-5050"); // confirmar
  const ferreNorte = await proveedor("Ferretería Industrial Norte", "Av. Maipú 2100", "Olivos", -34.5138, -58.4915, "11 4799-1414"); // confirmar
  const tigre = await proveedor("Corralón Panamericana", "Colectora Panamericana 2400", "Don Torcuato", -34.4859, -58.6218, "11 4748-9000"); // confirmar
  const sanMartin = await proveedor("Corralón San Martín", "Av. San Martín 2450", "Florida", -34.5301, -58.4952, "11 4797-6600"); // confirmar
  const proveedores = [ceibo, hierros, munro, boulogne, ferreNorte, tigre, sanMartin];

  // ──────────────────────────── Flota ────────────────────────────
  type V = Prisma.VehiculoUncheckedCreateInput;
  const vehiculo = (v: V) => db.vehiculo.create({ data: v });

  // Flota real, tal cual aparece en Cusat (ver CLAUDE.md, "Flota real"). idCusat se completa al
  // emparejar con Cusat; mientras tanto se empareja por patente o por cusatNombre.
  const camion5 = await vehiculo({ nombre: "Camión Mercedes 710", patente: "HFD336", tipo: "CAMION", marca: "Mercedes-Benz", modelo: "710", anio: 2008, capacidadCargaKg: 5000, kmActual: 412_300, costoKm: D(980), baseId: base.id, cusatNombre: "MERCEDES 710", entraEnCola: true }); // confirmar año, km, capacidad y costo
  const camion3 = await vehiculo({ nombre: "Camión Kia", patente: "AH282PU", tipo: "CAMION", marca: "Kia", modelo: "K2500", anio: 2025, capacidadCargaKg: 3000, kmActual: 8_400, costoKm: D(760), baseId: base.id, cusatNombre: "KIA", entraEnCola: true, estado: "EN_VIAJE" }); // nuevo; confirmar modelo, capacidad y costo
  const zanella = await vehiculo({ nombre: "Zanella", patente: "AG149BJ", tipo: "AUTO", marca: "Zanella", modelo: "A confirmar", anio: 2023, capacidadCargaKg: 0, kmActual: 11_200, costoKm: D(120), baseId: base.id, cusatNombre: "ZANELLA", entraEnCola: false }); // confirmar tipo (¿moto?), modelo y año
  const oroch = await vehiculo({ nombre: "Oroch", patente: "AC689NR", tipo: "CAMIONETA", marca: "Renault", modelo: "Oroch", anio: 2018, capacidadCargaKg: 650, kmActual: 148_900, costoKm: D(430), baseId: base.id, asignadoAId: null, cusatNombre: "OROCH", entraEnCola: false }); // confirmar a quién está asignada
  const kangoo = await vehiculo({ nombre: "Kangoo", patente: "AF399OO", tipo: "CAMIONETA", marca: "Renault", modelo: "Kangoo", anio: 2023, capacidadCargaKg: 650, kmActual: 61_700, costoKm: D(380), cusatNombre: "KANGOO", entraEnCola: false }); // en el interior (Cusat la muestra en Lincoln); confirmar
  const kangooLL = await vehiculo({ nombre: "Kangoo LL", patente: "AF399OP", tipo: "CAMIONETA", marca: "Renault", modelo: "Kangoo (larga)", anio: 2023, capacidadCargaKg: 800, kmActual: 57_300, costoKm: D(390), baseId: base.id, cusatNombre: "KANGOO LL", entraEnCola: false }); // confirmar

  const flota = [camion5, camion3, zanella, oroch, kangoo, kangooLL];

  // Documentación: seguro y VTV de todos. Una VTV vence en 5 días y un seguro venció ayer.
  for (const v of flota) {
    const seguro = v.id === kangoo.id ? enDias(-1) : enDias(entre(40, 300));
    const vtv = v.id === camion5.id ? enDias(5) : enDias(entre(30, 340));
    await db.documentoVehiculo.createMany({
      data: [
        { vehiculoId: v.id, tipo: "SEGURO", vencimiento: seguro, notas: "Póliza a confirmar" }, // confirmar
        { vehiculoId: v.id, tipo: "VTV", vencimiento: v.anio >= 2024 ? enDias(700) : vtv },
        { vehiculoId: v.id, tipo: "CEDULA", vencimiento: null },
        ...(v.tipo === "CAMION" ? [{ vehiculoId: v.id, tipo: "RUTA" as const, vencimiento: enDias(entre(60, 200)) }] : []),
      ],
    });
  }

  // ───────────────────────── Pedidos y viajes ─────────────────────────
  let numero = 0;
  type P = Omit<Prisma.PedidoViajeUncheckedCreateInput, "numero" | keyof Puntos>;
  // Origen y destino resueltos igual que al pedir desde la app.
  const pedido = async (p: P) => db.pedidoViaje.create({ data: { ...p, ...(await resolverPuntos(db, p)), numero: ++numero } });
  const costo = (km: number, costoKm: Prisma.Decimal, peajes: number) => costoKm.mul(km).add(peajes);

  const desdeProveedor = (p: { id: string }) => ({ origenTipo: "PROVEEDOR" as OrigenTipo, origenId: p.id, proveedorId: p.id, tipo: "RETIRO_PROVEEDOR" as TipoPedido });

  // 20 viajes finalizados en los últimos 30 días (los 3 últimos fueron ayer).
  const historia: { dias: number; obra: typeof darwin; prov: typeof ceibo; v: typeof camion5; chofer: typeof claudio; km: number; peajes: number; desc: string; peso: number; sol: typeof daniela }[] = [];
  const choferVehiculo = [
    [claudio, camion5], [cristian, camion3], [claudio, camion3], [david, camion3], [cristian, camion5], [claudio, camion5],
  ] as const;
  const descripciones = [
    ["Cemento y cal", 3200], ["Hierro del 8 y del 10", 2400], ["Ladrillos huecos 18", 4500], ["Arena y piedra", 4800],
    ["Caños y accesorios sanitarios", 180], ["Cable y cajas eléctricas", 120], ["Fenólicos y tirantes", 2600], ["Malla sima", 1500],
    ["Durlock y perfiles", 900], ["Membrana y pintura", 350],
  ] as const;
  for (let i = 0; i < 20; i++) {
    const [chofer, v] = choferVehiculo[i % choferVehiculo.length];
    const [desc, peso] = descripciones[i % descripciones.length];
    const o = obras[i % obras.length];
    const kmViaje = entre(8, 55);
    historia.push({
      dias: i < 3 ? 1 : 30 - i,
      obra: o,
      prov: proveedores[i % proveedores.length],
      v,
      chofer,
      km: kmViaje,
      peajes: kmViaje > 35 ? 2400 : 0,
      desc,
      peso: Math.min(peso, v.capacidadCargaKg),
      sol: resp(o),
    });
  }
  let viajeDeAyer: { pedidoId: string; numero: number; salida: Date; llegada: Date; prov: string; obra: string; chofer: string; km: number } | null = null;
  for (const h of historia) {
    const salida = haceDias(h.dias, 8 + (h.km % 5));
    const llegada = new Date(salida.getTime() + (1 + h.km / 30) * HORA);
    const enRetiro = new Date(salida.getTime() + (llegada.getTime() - salida.getTime()) * 0.35);
    const sale = new Date(enRetiro.getTime() + 20 * 60_000);
    const p = await pedido({
      ...desdeProveedor(h.prov), solicitanteId: h.sol.id, obraId: h.obra.id, descripcion: h.desc, pesoKg: h.peso,
      necesitaCamion: h.v.tipo === "CAMION", paraCuando: salida, estado: "ENTREGADO", tomadoPorId: h.chofer.id,
      tomadoEn: new Date(salida.getTime() - HORA), creadoEn: new Date(salida.getTime() - 5 * HORA),
      ordenCompraLebane: `OC ${2900 + numero}`, // confirmar
    });
    const kmSalida = h.v.kmActual - h.km * (h.dias + 2) - 30;
    await db.viaje.create({
      data: {
        pedidoId: p.id, vehiculoId: h.v.id, choferId: h.chofer.id, salidaReal: salida, llegadaReal: llegada,
        kmSalida, kmLlegada: kmSalida + h.km, peajes: D(h.peajes), costoCalculado: costo(h.km, h.v.costoKm, h.peajes), estado: "FINALIZADO",
        etapa: "FINALIZADO", inicioEn: salida, llegadaRetiroEn: enRetiro, salidaRetiroEn: sale, llegadaDestinoEn: llegada,
      },
    });
    if (!viajeDeAyer && h.dias === 1 && h.sol.id === daniela.id) {
      viajeDeAyer = { pedidoId: p.id, numero: p.numero, salida, llegada, prov: h.prov.nombre, obra: h.obra.nombre, chofer: h.chofer.nombre, km: h.km };
    }
  }

  // La historia del problema: el mismo hierro para Darwin pedido dos veces el mismo día.
  const hoy9 = new Date(ahora);
  hoy9.setHours(9, 0, 0, 0);
  await pedido({
    ...desdeProveedor(hierros), solicitanteId: lolo.id, obraId: darwin.id, descripcion: "Hierro del 10, 40 barras", pesoKg: 1800,
    necesitaCamion: true, paraCuando: enDias(1), creadoEn: new Date(Math.min(hoy9.getTime(), ahora.getTime() - 2 * HORA)), ordenCompraLebane: "OC 3120",
  });
  await pedido({
    ...desdeProveedor(hierros), solicitanteId: daniela.id, obraId: darwin.id, descripcion: "Hierro del 10 para losa (40 barras)", pesoKg: 1800,
    necesitaCamion: true, paraCuando: enDias(1), creadoEn: new Date(Math.min(hoy9.getTime() + 2.5 * HORA, ahora.getTime() - HORA)), ordenCompraLebane: "OC 3120",
    // Mismo pedido que el de Lolo: es exactamente lo que la cola única evita.
  });

  // Urgente sin tomar.
  await pedido({
    ...desdeProveedor(ferreNorte), solicitanteId: cesar.id, obraId: gaspar.id, descripcion: "Caños PPF 20 y 25 + accesorios. Plomeros parados.",
    pesoKg: 180, paraCuando: ahora, prioridad: "URGENTE", creadoEn: haceHoras(3),
  });

  // Tres tomados por Claudio (viaje programado).
  const tomados = [
    { prov: ceibo, obra: alvear, sol: leandro, desc: "Ladrillos huecos 18 x 3000 u.", peso: 4500, v: camion5 },
    { prov: boulogne, obra: pinares, sol: daniela, desc: "Fenólicos y tirantes para encofrado", peso: 2600, v: camion5 },
    { prov: munro, obra: cabildo, sol: leandro, desc: "Cal y plasticor", peso: 1200, v: camion5 },
  ];
  for (const [i, t] of tomados.entries()) {
    const p = await pedido({
      ...desdeProveedor(t.prov), solicitanteId: t.sol.id, obraId: t.obra.id, descripcion: t.desc, pesoKg: t.peso, necesitaCamion: t.peso > 1000,
      paraCuando: enDias(i === 0 ? 0 : 1), estado: "TOMADO", tomadoPorId: claudio.id, tomadoEn: haceHoras(2 - i * 0.5), creadoEn: haceHoras(6 - i),
    });
    const sale = new Date(ahora);
    sale.setHours(8 + i * 2, 30, 0, 0);
    await db.viaje.create({ data: { pedidoId: p.id, vehiculoId: t.v.id, choferId: claudio.id, estado: "PROGRAMADO", salidaEstimada: sale, ordenRuta: i + 1 } });
  }

  // En viaje: Cristian con el Camión Kia, ya cargó en Corralón Munro y va hacia Obra Darwin.
  const enViaje = await pedido({
    ...desdeProveedor(munro), solicitanteId: daniela.id, obraId: darwin.id, descripcion: "Cemento, cal y arena para losa", pesoKg: 2800,
    necesitaCamion: true, paraCuando: ahora, estado: "EN_VIAJE", tomadoPorId: cristian.id, tomadoEn: haceHoras(2), creadoEn: haceHoras(5),
    ordenCompraLebane: "OC 3118", // confirmar
  });
  // Recorrido verosímil Munro → Villa Crespo (Av. Mitre, General Paz, Balbín, Triunvirato, Corrientes).
  const rutaDarwin: Punto[] = [
    { lat: munro.latitud, lng: munro.longitud }, { lat: -34.5371, lng: -58.5121 }, { lat: -34.5462, lng: -58.5019 },
    { lat: -34.5531, lng: -58.4934 }, { lat: -34.5642, lng: -58.4813 }, { lat: -34.5717, lng: -58.4706 },
    { lat: -34.5771, lng: -58.4621 }, { lat: -34.5852, lng: -58.4489 }, { lat: darwin.latitud, lng: darwin.longitud },
  ];
  const metrosRuta = Math.round(largo(rutaDarwin));
  const VEL_MS = 6.4; // ~23 km/h promedio en ciudad
  const salioDelCorralon = new Date(ahora.getTime() - 20 * 60_000);
  const recorrido = VEL_MS * 20 * 60; // lo andado en 20 minutos
  const viajeEnCurso = await db.viaje.create({
    data: {
      pedidoId: enViaje.id, vehiculoId: camion3.id, choferId: cristian.id, salidaReal: haceHoras(1), kmSalida: camion3.kmActual - 31, estado: "EN_CURSO",
      etapa: "HACIA_DESTINO", inicioEn: haceHoras(1), llegadaRetiroEn: new Date(ahora.getTime() - 45 * 60_000), salidaRetiroEn: salioDelCorralon,
      distanciaRetiroM: 6_800, duracionRetiroS: 15 * 60, distanciaDestinoM: metrosRuta, duracionDestinoS: Math.round(metrosRuta / VEL_MS),
      etaDestino: new Date(ahora.getTime() + ((metrosRuta - recorrido) / VEL_MS) * 1000),
    },
  });
  // Posiciones del teléfono de Cristian cada 30 segundos desde que salió del corralón.
  for (let t = 0; t <= 20 * 60; t += 30) {
    const { punto, rumbo } = puntoEn(rutaDarwin, VEL_MS * t * (0.85 + azar() * 0.3));
    await db.posicionVehiculo.create({
      data: {
        vehiculoId: camion3.id, viajeId: viajeEnCurso.id, usuarioId: cristian.id, fuente: "TELEFONO",
        latitud: punto.lat + (azar() - 0.5) * 0.00008, longitud: punto.lng + (azar() - 0.5) * 0.00008,
        velocidad: Math.round(VEL_MS * 3.6 * (0.6 + azar() * 0.8)), rumbo: Math.round(rumbo), motorEncendido: true,
        precisionM: Math.round(6 + azar() * 12), fecha: new Date(salioDelCorralon.getTime() + t * 1000),
      },
    });
  }


  // ─────────────────────── Combustible y services ───────────────────────
  const cargadores = new Map([[camion5.id, claudio.id], [camion3.id, cristian.id], [oroch.id, lolo.id], [kangooLL.id, cristian.id], [zanella.id, david.id]]);
  // 4 cargas por vehículo cada ~400 km con consumo parejo; la última de la Oroch, 40% más alta.
  const consumoBase = { CAMION: 28, CAMIONETA: 12, AUTO: 7.5, MAQUINA: 20 } as const; // l/100 km // confirmar
  for (const [vehiculoId, usuarioId] of cargadores) {
    const v = flota.find((x) => x.id === vehiculoId)!;
    for (let k = 0; k < 4; k++) {
      const extra = v.id === oroch.id && k === 0 ? 1.4 : 1 + ((k * 7) % 5 - 2) / 100;
      const litros = Math.round(consumoBase[v.tipo] * 4 * extra * 10) / 10;
      await db.cargaCombustible.create({
        data: {
          vehiculoId, usuarioId, fecha: haceDias(3 + k * 9, 7), litros: D(litros), monto: D(Math.round(litros * (v.tipo === "AUTO" ? 1150 : 1290))), // confirmar precio
          km: v.kmActual - 50 - k * 400, obraId: v.asignadoAId ? obras.find((o) => resp(o).id === v.asignadoAId)?.id ?? null : null,
        },
      });
    }
  }
  await db.mantenimientoVehiculo.createMany({
    data: [
      { vehiculoId: camion5.id, tipo: "SERVICE", fecha: haceDias(75), km: 402_800, descripcion: "Service completo: aceite, filtros y correas", taller: "Taller Ruta 202", costo: D(385_000), proximoKm: 412_800 }, // confirmar
      { vehiculoId: camion3.id, tipo: "SERVICE", fecha: haceDias(20), km: 5_000, descripcion: "Primer service de garantía", taller: "Kia Camiones Norte", costo: D(220_000), proximoKm: 15_000, proximaFecha: enDias(160) }, // confirmar
    ],
  });

  // Incidentes
  await db.incidenteVehiculo.createMany({
    data: [
      { vehiculoId: camion5.id, usuarioId: claudio.id, tipo: "MULTA", fecha: haceDias(12), descripcion: "Exceso de velocidad en Panamericana", monto: D(185_000), resuelto: true }, // confirmar
      { vehiculoId: kangooLL.id, usuarioId: cristian.id, tipo: "ROTURA", fecha: haceDias(4), descripcion: "Espejo lateral roto al estacionar en obra", monto: D(95_000) }, // confirmar
    ],
  });

  // ───────────────────── Depósito: herramientas y máquinas ─────────────────────
  const cat = async (nombre: string) => db.categoriaHerramienta.create({ data: { nombre } });
  const catMaq = await cat("Maquinaria");
  const catElec = await cat("Herramientas eléctricas");
  const catMano = await cat("Herramientas de mano");
  const catMed = await cat("Medición");
  const catAndamio = await cat("Andamios y apuntalamiento");
  const catSeg = await cat("Seguridad");

  let codigo = 0;
  const sig = () => `SIG-${String(++codigo).padStart(4, "0")}`;
  const obraDe = (o: typeof darwin) => ({ obraId: o.id, responsableId: resp(o).id });

  type H = { nombre: string; categoriaId: string; esMaquina?: boolean; marca?: string; modelo?: string; valor: number; en?: typeof darwin; dias?: number; estado?: "EN_REPARACION"; condicion?: "BUENA" | "REGULAR" | "MALA"; cadaDias?: number; devolucion?: Date };
  const unitarias: H[] = [
    // 10 máquinas grandes
    { nombre: "Hormigonera 350 l", categoriaId: catMaq.id, esMaquina: true, marca: "Czerweny", modelo: "350", valor: 1_450_000, en: darwin, dias: 40, cadaDias: 90 },
    { nombre: "Martillo demoledor 11 kg", categoriaId: catMaq.id, esMaquina: true, marca: "Bosch", modelo: "GSH 11 VC", valor: 1_800_000, en: cabildo, dias: 12, devolucion: enDias(-9) },
    { nombre: "Generador 5,5 kVA", categoriaId: catMaq.id, esMaquina: true, marca: "Gamma", modelo: "GE-5500", valor: 1_200_000, cadaDias: 60 },
    { nombre: "Vibrador de hormigón", categoriaId: catMaq.id, esMaquina: true, marca: "Wacker", modelo: "M2500", valor: 900_000, en: chubut, dias: 6 },
    { nombre: "Cortadora de ladrillos", categoriaId: catMaq.id, esMaquina: true, marca: "Norton", modelo: "Clipper CM42", valor: 1_100_000, en: gaspar, dias: 15 },
    { nombre: "Placa compactadora", categoriaId: catMaq.id, esMaquina: true, marca: "Honda", modelo: "GX160", valor: 1_350_000, estado: "EN_REPARACION", condicion: "MALA" },
    { nombre: "Andamio tubular motorizado", categoriaId: catMaq.id, esMaquina: true, marca: "Andamios Norte", modelo: "AT-6", valor: 2_100_000, en: pinares, dias: 25 },
    { nombre: "Elevador de materiales", categoriaId: catMaq.id, esMaquina: true, marca: "Montacargas SR", modelo: "ME-300", valor: 3_200_000, en: laura, dias: 30, cadaDias: 30 },
    { nombre: "Soldadora inverter", categoriaId: catMaq.id, esMaquina: true, marca: "Lusqtoff", modelo: "LQ-250", valor: 480_000 },
    { nombre: "Hidrolavadora industrial", categoriaId: catMaq.id, esMaquina: true, marca: "Kärcher", modelo: "HD 6/15", valor: 1_050_000, en: alvear, dias: 4 },
    { nombre: "Hormigonera 130 l", categoriaId: catMaq.id, esMaquina: true, marca: "Czerweny", modelo: "130", valor: 980_000, cadaDias: 90 }, // en el depósito
  ];
  // 40 herramientas chicas
  const chicas: [string, string, string, number][] = [
    ["Amoladora 9\"", "DeWalt", catElec.id, 210_000], ["Amoladora 9\"", "DeWalt", catElec.id, 210_000], ["Amoladora 4½\"", "Bosch", catElec.id, 120_000],
    ["Amoladora 4½\"", "Bosch", catElec.id, 120_000], ["Amoladora 4½\"", "Makita", catElec.id, 125_000], ["Taladro percutor", "Makita", catElec.id, 160_000],
    ["Taladro percutor", "Bosch", catElec.id, 150_000], ["Rotomartillo SDS Plus", "Bosch", catElec.id, 280_000], ["Rotomartillo SDS Plus", "DeWalt", catElec.id, 290_000],
    ["Atornillador inalámbrico", "Makita", catElec.id, 190_000], ["Atornillador inalámbrico", "Makita", catElec.id, 190_000], ["Sierra circular 7¼\"", "Skil", catElec.id, 170_000],
    ["Sierra caladora", "Bosch", catElec.id, 140_000], ["Ingletadora", "DeWalt", catElec.id, 520_000], ["Pistola de calor", "Black+Decker", catElec.id, 60_000],
    ["Mezcladora de pintura", "Lusqtoff", catElec.id, 110_000], ["Aspiradora de obra", "Kärcher", catElec.id, 230_000], ["Extensión 25 m", "Kalop", catElec.id, 35_000],
    ["Extensión 25 m", "Kalop", catElec.id, 35_000], ["Reflector LED 200 W", "Interelec", catElec.id, 45_000], ["Nivel láser", "Bosch", catMed.id, 380_000],
    ["Nivel láser", "Stanley", catMed.id, 260_000], ["Nivel óptico con trípode", "Topcon", catMed.id, 650_000], ["Medidor láser 50 m", "Bosch", catMed.id, 95_000],
    ["Cinta métrica 50 m", "Stanley", catMed.id, 28_000], ["Detector de metales y cables", "Bosch", catMed.id, 140_000], ["Escalera tijera 8 escalones", "Escalumex", catAndamio.id, 120_000],
    ["Escalera extensible 2x12", "Escalumex", catAndamio.id, 210_000], ["Tenaza armador", "Bahco", catMano.id, 18_000], ["Cortahierro 36\"", "Bahco", catMano.id, 75_000],
    ["Dobladora de hierro", "Bremen", catMano.id, 95_000], ["Maza 5 kg", "Truper", catMano.id, 22_000], ["Llave Stillson 24\"", "Ridgid", catMano.id, 70_000],
    ["Terraja para caños", "Ridgid", catMano.id, 260_000], ["Cortadora de cerámicos 90 cm", "Rubi", catMano.id, 180_000], ["Termofusora", "IPS", catElec.id, 85_000],
    ["Arnés de seguridad", "Steelpro", catSeg.id, 65_000], ["Arnés de seguridad", "Steelpro", catSeg.id, 65_000], ["Línea de vida 15 m", "Steelpro", catSeg.id, 90_000],
    ["Matafuego 5 kg", "Georgia", catSeg.id, 55_000],
  ];
  const destinosChicas = [darwin, chubut, gaspar, laura, alvear, cabildo, parana, pinares];
  for (const [i, [nombre, marca, categoriaId, valor]] of chicas.entries()) {
    const enObra = i % 3 !== 0; // dos de cada tres están en obra
    unitarias.push({ nombre, marca, categoriaId, valor, en: enObra ? destinosChicas[i % destinosChicas.length] : undefined, dias: entre(1, 35), estado: i === 13 ? "EN_REPARACION" : undefined, condicion: i % 7 === 0 ? "REGULAR" : "BUENA" });
  }

  for (const h of unitarias) {
    const enObra = h.en && h.estado !== "EN_REPARACION";
    const desde = haceDias(h.dias ?? 1, 8);
    const herramienta = await db.herramienta.create({
      data: {
        codigo: sig(), nombre: h.nombre, categoriaId: h.categoriaId, esMaquina: !!h.esMaquina, tipoControl: "UNITARIA",
        marca: h.marca, modelo: h.modelo, nroSerie: h.esMaquina ? `SN-${entre(100000, 999999)}` : null, // confirmar números de serie
        estado: h.estado ?? (enObra ? "EN_OBRA" : "DISPONIBLE"), condicion: h.condicion ?? "BUENA",
        ...(enObra ? obraDe(h.en!) : { ubicacionId: depo.id }),
        devolucionPrevista: enObra ? h.devolucion ?? enDias(entre(3, 40)) : null,
        valorCompra: D(h.valor), // confirmar valores
        mantenimientoCadaDias: h.cadaDias ?? null, proximoMantenimiento: h.cadaDias ? enDias(entre(5, h.cadaDias)) : null,
      },
    });
    // Movimientos coherentes con dónde está hoy.
    if (enObra) {
      await db.movimientoHerramienta.create({
        data: { herramientaId: herramienta.id, tipo: "ENTREGA", desdeUbicacionId: depo.id, haciaObraId: h.en!.id, condicion: herramienta.condicion, registradoPorId: deposito.id, recibidoPorId: resp(h.en!).id, fecha: desde },
      });
    }
    if (h.estado === "EN_REPARACION") {
      await db.movimientoHerramienta.create({
        data: { herramientaId: herramienta.id, tipo: "A_REPARACION", desdeUbicacionId: depo.id, condicion: "MALA", registradoPorId: deposito.id, fecha: haceDias(5), observaciones: "Enviada al servicio técnico" },
      });
    }
  }

  // Mantenimiento de maquinaria
  for (const [nombre, dias, desc, costo] of [["Hormigonera 350 l", 50, "Cambio de rodamientos del tambor", 85_000], ["Generador 5,5 kVA", 20, "Service: aceite, bujía y filtro de aire", 42_000], ["Hormigonera 130 l", 35, "Engrase y correa nueva", 28_000]] as const) {
    const h = await db.herramienta.findFirstOrThrow({ where: { nombre } });
    await db.mantenimientoHerramienta.create({ data: { herramientaId: h.id, fecha: haceDias(dias, 12), descripcion: desc, taller: "Servicio técnico Munro", costo: D(costo), registradoPorId: deposito.id } }); // confirmar
    if (h.mantenimientoCadaDias) await db.herramienta.update({ where: { id: h.id }, data: { proximoMantenimiento: enDias(h.mantenimientoCadaDias - dias) } });
  }

  // 5 por cantidad: stock en el depósito y en obras.
  const porCantidad: [string, number, [typeof darwin | null, number][]][] = [
    ["Palas", 25_000, [[null, 18], [darwin, 6], [chubut, 4], [gaspar, 3]]],
    ["Baldes de obra", 6_000, [[null, 35], [darwin, 10], [pinares, 8], [laura, 6]]],
    ["Puntales metálicos", 32_000, [[null, 140], [chubut, 80], [cabildo, 60]]],
    ["Caballetes", 40_000, [[null, 12], [alvear, 4], [parana, 4]]],
    ["Carretillas", 95_000, [[null, 6], [gaspar, 2], [alvear, 2], [darwin, 2]]],
  ];
  for (const [nombre, valor, stock] of porCantidad) {
    const h = await db.herramienta.create({
      data: { codigo: sig(), nombre, categoriaId: nombre === "Puntales metálicos" || nombre === "Caballetes" ? catAndamio.id : catMano.id, tipoControl: "CANTIDAD", estado: "DISPONIBLE", valorCompra: D(valor) }, // valor unitario; confirmar
    });
    for (const [o, cantidad] of stock) {
      await db.existenciaHerramienta.create({ data: { herramientaId: h.id, ubicacionId: o ? null : depo.id, obraId: o?.id ?? null, cantidad } });
      if (o) {
        await db.movimientoHerramienta.create({
          data: { herramientaId: h.id, tipo: "ENTREGA", cantidad, desdeUbicacionId: depo.id, haciaObraId: o.id, registradoPorId: deposito.id, recibidoPorId: resp(o).id, fecha: haceDias(entre(5, 40)) },
        });
      }
    }
  }

  // Sobrantes que quedan en el depósito.
  await db.materialSobrante.createMany({
    data: [
      { descripcion: "Cable unipolar 2,5 mm", categoria: "ELECTRICO", cantidad: D(320), unidad: "m", obraOrigenId: laura.id, fecha: haceDias(20) },
      { descripcion: "Cable unipolar 4 mm", categoria: "ELECTRICO", cantidad: D(140), unidad: "m", obraOrigenId: chubut.id, fecha: haceDias(35) },
      { descripcion: "Caja rectangular 5x10", categoria: "ELECTRICO", cantidad: D(48), unidad: "u", obraOrigenId: darwin.id, fecha: haceDias(12) },
      { descripcion: "Térmicas 2x20 A", categoria: "ELECTRICO", cantidad: D(9), unidad: "u", obraOrigenId: gaspar.id, fecha: haceDias(8) },
      { descripcion: "Caño PPF 20 mm", categoria: "SANITARIO", cantidad: D(25), unidad: "barras", obraOrigenId: gaspar.id, fecha: haceDias(15) },
      { descripcion: "Codos PPF 25 mm", categoria: "SANITARIO", cantidad: D(60), unidad: "u", obraOrigenId: pinares.id, fecha: haceDias(22) },
      { descripcion: "Caño PVC 110 mm", categoria: "SANITARIO", cantidad: D(7), unidad: "barras", obraOrigenId: alvear.id, fecha: haceDias(30) },
      { descripcion: "Llaves de paso ½\"", categoria: "SANITARIO", cantidad: D(14), unidad: "u", obraOrigenId: cabildo.id, fecha: haceDias(5) },
    ],
  });

  // ──────────────────── Posiciones (mock de Cusat) ────────────────────
  // En viaje: en ruta entre el proveedor y la obra. Disponible: en su base.
  for (const v of flota) {
    if (v.id === camion3.id) continue; // en viaje: ya tiene las posiciones del teléfono de Cristian
    let lat: number, lng: number;
    const velocidad = 0, encendido = false;
    if (v.baseId) {
      lat = base.latitud + (azar() - 0.5) * 0.0008;
      lng = base.longitud + (azar() - 0.5) * 0.0008;
    } else {
      // La Kangoo del interior: Cusat la mostró en Lincoln. // confirmar
      lat = -34.8667;
      lng = -61.5302;
    }
    await db.posicionVehiculo.create({
      data: { vehiculoId: v.id, latitud: lat, longitud: lng, velocidad, rumbo: velocidad ? 135 : 0, motorEncendido: encendido, fecha: haceHoras(entre(1, 12)) },
    });
  }

  // ─────────────────────────── Alertas ───────────────────────────
  // Casos para que cada regla de alertas tenga algo que mostrar:
  // una máquina en una obra pausada hace 10 días y una máquina con el mantenimiento vencido.
  const soldadora = await db.herramienta.findFirstOrThrow({ where: { nombre: "Soldadora inverter" } });
  const dep = await db.ubicacion.findFirstOrThrow({ where: { tipo: "DEPOSITO" } });
  await db.herramienta.update({ where: { id: soldadora.id }, data: { estado: "EN_OBRA", ubicacionId: null, obraId: parana.id, responsableId: leandro.id, devolucionPrevista: enDias(20) } });
  await db.movimientoHerramienta.create({ data: { herramientaId: soldadora.id, tipo: "ENTREGA", desdeUbicacionId: dep.id, haciaObraId: parana.id, registradoPorId: deposito.id, recibidoPorId: leandro.id, fecha: haceDias(20, 9) } });
  await db.$executeRaw`UPDATE "Obra" SET "estado" = 'PAUSADA', "actualizadoEn" = now() - interval '10 days' WHERE "id" = ${parana.id}`; // confirmar
  const andamio = await db.herramienta.findFirstOrThrow({ where: { nombre: "Andamio tubular motorizado" } });
  await db.herramienta.update({ where: { id: andamio.id }, data: { mantenimientoCadaDias: 60, proximoMantenimiento: enDias(-3) } });

  // ──────────────────── Pedidos de herramienta ────────────────────
  // Daniela pidió la Hormigonera 130 l para Darwin hoy y Claudio ya lo aceptó: pedirla otra vez
  // para Darwin hoy tiene que avisar el duplicado exacto (misma herramienta + obra + día).
  const hormigonera = await db.herramienta.findFirstOrThrow({ where: { nombre: "Hormigonera 130 l" } });
  const pedidoHormigonera = await pedido({
    solicitanteId: daniela.id, obraId: darwin.id, tipo: "TRASLADO_MAQUINARIA", origenTipo: "DEPOSITO", origenId: depo.id,
    herramientaId: hormigonera.id, fechaNecesaria: enDias(0), descripcion: `${hormigonera.nombre} (${hormigonera.codigo})`,
    necesitaCamion: true, paraCuando: enDias(0), franja: "TARDE", estado: "TOMADO", tomadoPorId: claudio.id,
    tomadoEn: haceHoras(1), creadoEn: haceHoras(3),
  });
  const salidaHormigonera = new Date(ahora);
  salidaHormigonera.setHours(15, 0, 0, 0);
  await db.viaje.create({ data: { pedidoId: pedidoHormigonera.id, vehiculoId: camion5.id, choferId: claudio.id, estado: "PROGRAMADO", salidaEstimada: salidaHormigonera, ordenRuta: tomados.length + 1 } });
  // Leandro pide el nivel láser para Cabildo mañana: pendiente.
  const nivel = await db.herramienta.findFirstOrThrow({ where: { nombre: "Nivel láser", estado: "DISPONIBLE" } });
  await pedido({
    solicitanteId: leandro.id, obraId: cabildo.id, tipo: "TRASLADO_HERRAMIENTAS", origenTipo: "DEPOSITO", origenId: depo.id,
    herramientaId: nivel.id, fechaNecesaria: enDias(1), descripcion: `${nivel.nombre} (${nivel.codigo})`,
    paraCuando: enDias(1), franja: "MANANA", creadoEn: haceHoras(2),
  });
  // ───────────────────── Materiales y Compras ─────────────────────
  // Ocho pedidos de material en todos los estados del circuito, con su historia de cambios.
  type Paso = { a: EstadoMaterial; por: { id: string }; cuando: Date; nota?: string };
  const pedidoMaterial = async (
    datos: Omit<Prisma.PedidoMaterialUncheckedCreateInput, "estado" | "creadoEn">,
    pasos: Paso[],
  ) => {
    const final = pasos[pasos.length - 1];
    const pm = await db.pedidoMaterial.create({ data: { ...datos, estado: final.a, creadoEn: pasos[0].cuando } });
    let de: EstadoMaterial | null = null;
    for (const paso of pasos) {
      await db.cambioEstadoMaterial.create({ data: { pedidoMaterialId: pm.id, de, a: paso.a, usuarioId: paso.por.id, fecha: paso.cuando, nota: paso.nota } });
      de = paso.a;
    }
    return pm;
  };
  const habilitar = (pm: { id: string; obraId: string; ordenCompraNumero: string | null }, prov: typeof ceibo, d: { descripcion: string; pesoKg: number; cuando: Date; horario: string; contacto: string; estado?: EstadoMaterialListo; pedidoViajeId?: string; entregadoEn?: Date }) =>
    db.materialListo.create({
      data: {
        pedidoMaterialId: pm.id, obraId: pm.obraId, proveedorId: prov.id, proveedorDireccion: `${prov.direccion}, ${prov.localidad}`,
        proveedorLat: prov.latitud, proveedorLng: prov.longitud, horarioRetiro: d.horario, contactoRetiro: d.contacto,
        ordenCompraNumero: pm.ordenCompraNumero, descripcion: d.descripcion, pesoKg: d.pesoKg, necesitaCamion: d.pesoKg > 1000,
        estado: d.estado ?? "LISTO", habilitadoPorId: compras.id, habilitadoEn: d.cuando, pedidoViajeId: d.pedidoViajeId, entregadoEn: d.entregadoEn,
      },
    });

  // 1 y 2. Recién pedidos hoy: uno urgente (la obra se para sin esto).
  await pedidoMaterial(
    { obraId: darwin.id, solicitanteId: daniela.id, descripcion: "Cemento Portland, 50 bolsas", cantidad: D(50), unidad: "bolsas", paraCuando: enDias(0), prioridad: "URGENTE", observaciones: "Hormigonamos la losa mañana temprano" },
    [{ a: "SOLICITADO", por: daniela, cuando: haceHoras(1.5) }],
  );
  await pedidoMaterial(
    { obraId: cabildo.id, solicitanteId: leandro.id, descripcion: "Membrana asfáltica con aluminio, 12 rollos", cantidad: D(12), unidad: "rollos", paraCuando: enDias(2) },
    [{ a: "SOLICITADO", por: leandro, cuando: haceHoras(3) }],
  );
  // 3. Compras lo está cotizando.
  await pedidoMaterial(
    { obraId: chubut.id, solicitanteId: cesar.id, descripcion: "Caño PPF 20 mm, 30 barras + codos y tees", cantidad: D(30), unidad: "barras", paraCuando: enDias(3), tomadoPorId: compras.id, tomadoEn: haceDias(1, 11) },
    [{ a: "SOLICITADO", por: cesar, cuando: haceDias(1, 9) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(1, 11) }],
  );
  // 4. OC armada, esperando que el dueño apruebe.
  await pedidoMaterial(
    { obraId: laura.id, solicitanteId: vicky.id, descripcion: "Porcelanato 60x60 gris, 120 m²", cantidad: D(120), unidad: "m²", paraCuando: enDias(6), tomadoPorId: compras.id, tomadoEn: haceDias(2, 10), ordenCompraNumero: "OC 3141", montoAprobado: D(2_850_000) }, // confirmar
    [
      { a: "SOLICITADO", por: vicky, cuando: haceDias(3, 16) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(2, 10) },
      { a: "ESPERANDO_APROBACION", por: compras, cuando: haceHoras(5), nota: "OC 3141 · $ 2.850.000" },
    ],
  );
  // 5. Aprobado por el dueño, falta que el proveedor lo tenga listo.
  await pedidoMaterial(
    { obraId: gaspar.id, solicitanteId: lolo.id, descripcion: "Hierro del 12, 60 barras", cantidad: D(60), unidad: "barras", paraCuando: enDias(2), tomadoPorId: compras.id, tomadoEn: haceDias(3, 10), ordenCompraNumero: "OC 3138", montoAprobado: D(1_920_000), aprobadoPorId: dueno.id, aprobadoEn: haceDias(1, 18) }, // confirmar
    [
      { a: "SOLICITADO", por: lolo, cuando: haceDias(4, 8) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(3, 10) },
      { a: "ESPERANDO_APROBACION", por: compras, cuando: haceDias(2, 15), nota: "OC 3138 · $ 1.920.000" }, { a: "APROBADO", por: dueno, cuando: haceDias(1, 18) },
    ],
  );
  // 6. Darwin, Corralón San Martín: una parte habilitada hace 4 días y nunca se retiró (alerta) y otra hoy.
  const pmArena = await pedidoMaterial(
    { obraId: darwin.id, solicitanteId: daniela.id, descripcion: "Arena gruesa y piedra partida, 6 m³ de cada una", paraCuando: enDias(-3), tomadoPorId: compras.id, tomadoEn: haceDias(7, 10), ordenCompraNumero: "OC 3127", montoAprobado: D(1_140_000), aprobadoPorId: dueno.id, aprobadoEn: haceDias(6, 17) }, // confirmar
    [
      { a: "SOLICITADO", por: daniela, cuando: haceDias(8, 9) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(7, 10) },
      { a: "ESPERANDO_APROBACION", por: compras, cuando: haceDias(7, 15), nota: "OC 3127 · $ 1.140.000" }, { a: "APROBADO", por: dueno, cuando: haceDias(6, 17) },
      { a: "LISTO_PARA_RETIRAR", por: compras, cuando: haceDias(4, 11), nota: "Arena gruesa, 6 m³" },
    ],
  );
  await habilitar(pmArena, sanMartin, { descripcion: "Arena gruesa, 6 m³ (en bolsones)", pesoKg: 4200, cuando: haceDias(4, 11), horario: "Lun a vie 7 a 16, sáb 7 a 12", contacto: "Sergio, playa de carga · 11 4797-6601" }); // confirmar
  await habilitar(pmArena, sanMartin, { descripcion: "Piedra partida 6-20, 6 m³ (en bolsones)", pesoKg: 4500, cuando: haceHoras(2), horario: "Lun a vie 7 a 16, sáb 7 a 12", contacto: "Sergio, playa de carga · 11 4797-6601" }); // confirmar
  // 7. Darwin, otro proveedor: listo hoy. Juntos con el 6 muestran que se pide un viaje por proveedor.
  const pmMalla = await pedidoMaterial(
    { obraId: darwin.id, solicitanteId: daniela.id, descripcion: "Malla sima 15x15 del 6, 20 paneles", cantidad: D(20), unidad: "paneles", paraCuando: enDias(1), tomadoPorId: compras.id, tomadoEn: haceDias(2, 9), ordenCompraNumero: "OC 3136", montoAprobado: D(980_000), aprobadoPorId: dueno.id, aprobadoEn: haceDias(1, 12), completo: true }, // confirmar
    [
      { a: "SOLICITADO", por: daniela, cuando: haceDias(3, 8) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(2, 9) },
      { a: "ESPERANDO_APROBACION", por: compras, cuando: haceDias(2, 14), nota: "OC 3136 · $ 980.000" }, { a: "APROBADO", por: dueno, cuando: haceDias(1, 12) },
      { a: "LISTO_PARA_RETIRAR", por: compras, cuando: haceHoras(4), nota: "Malla sima, 20 paneles. No falta nada." },
    ],
  );
  await habilitar(pmMalla, hierros, { descripcion: "Malla sima 15x15 del 6, 20 paneles", pesoKg: 900, cuando: haceHoras(4), horario: "Lun a vie 8 a 17", contacto: "Mostrador, pedir por Raúl · 11 4792-8811" }); // confirmar
  // 8. Entregado ayer: Claudio lo retiró en Materiales Boulogne y lo llevó a Pinares II.
  const pmDurlock = await pedidoMaterial(
    { obraId: pinares.id, solicitanteId: daniela.id, descripcion: "Placas de durlock 12,5 mm, 40 u. + perfiles", cantidad: D(40), unidad: "placas", paraCuando: enDias(-1), tomadoPorId: compras.id, tomadoEn: haceDias(5, 10), ordenCompraNumero: "OC 3122", montoAprobado: D(760_000), aprobadoPorId: dueno.id, aprobadoEn: haceDias(4, 18), completo: true }, // confirmar
    [
      { a: "SOLICITADO", por: daniela, cuando: haceDias(6, 9) }, { a: "EN_COMPRA", por: compras, cuando: haceDias(5, 10) },
      { a: "ESPERANDO_APROBACION", por: compras, cuando: haceDias(5, 15), nota: "OC 3122 · $ 760.000" }, { a: "APROBADO", por: dueno, cuando: haceDias(4, 18) },
      { a: "LISTO_PARA_RETIRAR", por: compras, cuando: haceDias(2, 11) }, { a: "RETIRO_PEDIDO", por: daniela, cuando: haceDias(2, 12) },
      { a: "EN_CAMINO", por: claudio, cuando: haceDias(1, 9) }, { a: "ENTREGADO", por: claudio, cuando: haceDias(1, 11) },
    ],
  );
  const retiroDurlock = await pedido({
    ...desdeProveedor(boulogne), esRetiroMaterial: true, solicitanteId: daniela.id, obraId: pinares.id,
    descripcion: "Placas de durlock 12,5 mm, 40 u. + perfiles · Retiro: lun a vie 8 a 17 · Contacto: Marcelo · OC 3122", pesoKg: 950,
    paraCuando: haceDias(1, 9), estado: "ENTREGADO", tomadoPorId: claudio.id, tomadoEn: haceDias(2, 15), creadoEn: haceDias(2, 12), ordenCompraLebane: "OC 3122",
  });
  const kmDurlock = 24;
  await db.viaje.create({
    data: {
      pedidoId: retiroDurlock.id, vehiculoId: camion5.id, choferId: claudio.id, salidaReal: haceDias(1, 9), llegadaReal: haceDias(1, 11),
      kmSalida: camion5.kmActual - 60, kmLlegada: camion5.kmActual - 60 + kmDurlock, peajes: D(0), costoCalculado: costo(kmDurlock, camion5.costoKm, 0), estado: "FINALIZADO",
      etapa: "FINALIZADO", inicioEn: haceDias(1, 9), llegadaRetiroEn: new Date(haceDias(1, 9).getTime() + 35 * 60_000), salidaRetiroEn: new Date(haceDias(1, 9).getTime() + 60 * 60_000), llegadaDestinoEn: haceDias(1, 11),
    },
  });
  await habilitar(pmDurlock, boulogne, { descripcion: "Placas de durlock 12,5 mm, 40 u. + perfiles", pesoKg: 950, cuando: haceDias(2, 11), horario: "Lun a vie 8 a 17", contacto: "Marcelo · 11 4737-5050", estado: "ENTREGADO", pedidoViajeId: retiroDurlock.id, entregadoEn: haceDias(1, 11) }); // confirmar

  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"PedidoViaje"', 'numero'), (SELECT MAX("numero") FROM "PedidoViaje"))`;
  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"PedidoMaterial"', 'numero'), (SELECT MAX("numero") FROM "PedidoMaterial"))`;

  // ────────────────── Avisos de Daniela (viaje de ayer) ──────────────────
  if (viajeDeAyer) {
    const y = viajeDeAyer;
    const min = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
    const enRetiro = min(y.salida, ((y.llegada.getTime() - y.salida.getTime()) / 60_000) * 0.35);
    const distancia = y.km * 1000;
    await db.notificacion.createMany({
      data: [
        {
          usuarioId: daniela.id, tipo: "VIAJE_INICIADO", titulo: `${y.chofer} salió a buscar tu pedido #${y.numero}`,
          cuerpo: `Va a ${y.prov}. Llega a Obra ${y.obra} a las ${hhmm(y.llegada)} aprox.`, enlace: `/pedidos/${y.pedidoId}`,
          datos: { distanciaM: distancia, eta: y.llegada.toISOString() }, creadaEn: y.salida, leidaEn: min(y.salida, 4),
        },
        {
          usuarioId: daniela.id, tipo: "LLEGO_RETIRO", titulo: `${y.chofer} está cargando en ${y.prov}`,
          cuerpo: `Faltan ${Math.round(distancia * 0.65 / 100) / 10} km hasta Obra ${y.obra}. Llega a las ${hhmm(y.llegada)} aprox.`, enlace: `/pedidos/${y.pedidoId}`,
          datos: { distanciaM: Math.round(distancia * 0.65), eta: y.llegada.toISOString() }, creadaEn: enRetiro, leidaEn: min(enRetiro, 9),
        },
        {
          usuarioId: daniela.id, tipo: "LLEGO_DESTINO", titulo: `Llegó tu pedido #${y.numero} a Obra ${y.obra}`,
          cuerpo: `${y.chofer} lo entregó a las ${hhmm(y.llegada)}.`, enlace: `/pedidos/${y.pedidoId}`,
          datos: { distanciaM: 0, eta: y.llegada.toISOString() }, creadaEn: y.llegada,
        },
      ],
    });
  }

  await db.auditoria.create({
    data: {
      usuarioId: dueno.id, rol: "DIRECCION", accion: "seed", entidad: "Sistema", entidadId: "seed",
      resumen: "Se cargaron los datos de demostración", despues: { viajeEnCurso: viajeEnCurso.id },
    },
  });

  // ─────────────────────────── Resumen ───────────────────────────
  const conteo = {
    Usuario: await db.usuario.count(),
    Ubicacion: await db.ubicacion.count(),
    Obra: await db.obra.count(),
    ResponsableObra: await db.responsableObra.count(),
    Proveedor: await db.proveedor.count(),
    Vehiculo: await db.vehiculo.count(),
    DocumentoVehiculo: await db.documentoVehiculo.count(),
    CargaCombustible: await db.cargaCombustible.count(),
    MantenimientoVehiculo: await db.mantenimientoVehiculo.count(),
    IncidenteVehiculo: await db.incidenteVehiculo.count(),
    PedidoViaje: await db.pedidoViaje.count(),
    Viaje: await db.viaje.count(),
    PosicionVehiculo: await db.posicionVehiculo.count(),
    PedidoMaterial: await db.pedidoMaterial.count(),
    CambioEstadoMaterial: await db.cambioEstadoMaterial.count(),
    MaterialListo: await db.materialListo.count(),
    CategoriaHerramienta: await db.categoriaHerramienta.count(),
    Herramienta: await db.herramienta.count(),
    ExistenciaHerramienta: await db.existenciaHerramienta.count(),
    MovimientoHerramienta: await db.movimientoHerramienta.count(),
    MaterialSobrante: await db.materialSobrante.count(),
    MantenimientoHerramienta: await db.mantenimientoHerramienta.count(),
    Alerta: await db.alerta.count(),
    Notificacion: await db.notificacion.count(),
    SuscripcionPush: await db.suscripcionPush.count(),
    Auditoria: await db.auditoria.count(),
  };
  return conteo;

}

