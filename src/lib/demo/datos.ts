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
} from "@prisma/client";
import bcrypt from "bcryptjs";

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
  await db.mantenimientoHerramienta.deleteMany();
  await db.materialSobrante.deleteMany();
  await db.movimientoHerramienta.deleteMany();
  await db.existenciaHerramienta.deleteMany();
  await db.herramienta.deleteMany();
  await db.categoriaHerramienta.deleteMany();
  await db.posicionVehiculo.deleteMany();
  await db.viaje.deleteMany();
  await db.pedidoViaje.deleteMany();
  await db.incidenteVehiculo.deleteMany();
  await db.mantenimientoVehiculo.deleteMany();
  await db.cargaCombustible.deleteMany();
  await db.documentoVehiculo.deleteMany();
  await db.usuario.updateMany({ data: { vehiculoAsignadoId: null } });
  await db.vehiculo.deleteMany();
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

  // ────────────────────────── Ubicaciones ──────────────────────────
  const base = await db.ubicacion.create({
    data: { nombre: "Base de camiones Martínez", tipo: "BASE_VEHICULOS", direccion: "Av. Fondo de la Legua 300, Martínez", latitud: -34.4931, longitud: -58.5251 }, // confirmar dirección
  });
  const depo = await db.ubicacion.create({
    data: { nombre: "Depósito", tipo: "DEPOSITO", direccion: "Av. Bernardo Ader 1600, Munro", latitud: -34.5286, longitud: -58.5266 }, // confirmar dirección
  });

  // ──────────────────────────── Obras ────────────────────────────
  const obra = (codigo: string, nombre: string, direccion: string, localidad: string, latitud: number, longitud: number, responsableId: string) =>
    db.obra.create({ data: { codigo, nombre, direccion, localidad, latitud, longitud, responsableId, idLebane: `LB-${codigo}` } });

  // Direcciones y coordenadas verosímiles: confirmar todas con Lebane.
  const darwin = await obra("OB-01", "Darwin", "Darwin 1154", "Villa Crespo, CABA", -34.5925, -58.4376, daniela.id); // confirmar
  const pinares = await obra("OB-02", "Pinares II", "Av. de los Lagos 7008", "Nordelta, Tigre", -34.4092, -58.6461, daniela.id); // confirmar
  const chubut = await obra("OB-03", "Chubut", "Chubut 1621", "Olivos", -34.5081, -58.4952, cesar.id); // confirmar
  const gaspar = await obra("OB-04", "Gaspar Campos", "Gaspar Campos 1950", "Vicente López", -34.5226, -58.4876, cesar.id); // confirmar
  const laura = await obra("OB-05", "Laura Thomas", "Laura Thomas 2450", "San Isidro", -34.4733, -58.5307, vicky.id); // confirmar
  const cabildo = await obra("OB-06", "Cabildo", "Av. Cabildo 3900", "Núñez, CABA", -34.5462, -58.4693, leandro.id); // confirmar
  const alvear = await obra("OB-07", "Alvear", "Alvear 2210", "Martínez", -34.4951, -58.5154, leandro.id); // confirmar
  const parana = await obra("OB-08", "Paraná", "Paraná 3700", "Olivos", -34.5115, -58.5122, leandro.id); // confirmar
  const obras = [darwin, pinares, chubut, gaspar, laura, cabildo, alvear, parana];

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
  const proveedores = [ceibo, hierros, munro, boulogne, ferreNorte, tigre];

  // ──────────────────────────── Flota ────────────────────────────
  type V = Prisma.VehiculoUncheckedCreateInput;
  const vehiculo = (v: V) => db.vehiculo.create({ data: v });

  const camion5 = await vehiculo({ nombre: "Camión 5 tn", patente: "AB 123 CD", tipo: "CAMION", marca: "Mercedes-Benz", modelo: "Atego 1419", anio: 2017, capacidadCargaKg: 5000, kmActual: 189_400, costoKm: D(980), baseId: base.id, idCusat: "CUS-1001", entraEnCola: true }); // confirmar datos
  const camion4 = await vehiculo({ nombre: "Camión 4 tn", patente: "AC 456 EF", tipo: "CAMION", marca: "Ford", modelo: "Cargo 1723", anio: 2015, capacidadCargaKg: 4000, kmActual: 241_050, costoKm: D(910), baseId: base.id, idCusat: "CUS-1002", entraEnCola: true, estado: "EN_VIAJE" }); // confirmar datos
  const camion3 = await vehiculo({ nombre: "Camión 3 tn", patente: "AH 012 KL", tipo: "CAMION", marca: "Iveco", modelo: "Tector 170E22", anio: 2025, capacidadCargaKg: 3000, kmActual: 4_300, costoKm: D(840), baseId: base.id, idCusat: "CUS-1003", entraEnCola: true }); // nuevo; confirmar datos

  const camioneta = (nombre: string, patente: string, marca: string, modelo: string, anio: number, km: number, asignadoAId: string | null, idCusat: string | null) =>
    vehiculo({ nombre, patente, tipo: "CAMIONETA", marca, modelo, anio, capacidadCargaKg: 1000, kmActual: km, costoKm: D(430), asignadoAId, idCusat, entraEnCola: false }); // confirmar datos

  const ctaLeandro = await camioneta("Camioneta Leandro", "AE 333 CC", "Volkswagen", "Amarok", 2022, 54_100, leandro.id, "CUS-2003");
  const ctaLolo = await camioneta("Camioneta Lolo", "AE 444 DD", "Toyota", "Hilux", 2018, 151_800, lolo.id, "CUS-2004");
  const ctaClaudio = await camioneta("Camioneta Claudio", "AE 111 AA", "Toyota", "Hilux", 2020, 98_200, claudio.id, "CUS-2001");
  const ctaCristian = await camioneta("Camioneta Cristian", "AE 222 BB", "Ford", "Ranger", 2021, 76_540, cristian.id, "CUS-2002");
  const interior1 = await camioneta("Interior 1", "AD 555 EE", "Chevrolet", "S10", 2016, 203_400, null, null);
  const interior2 = await camioneta("Interior 2", "AD 666 FF", "Nissan", "Frontier", 2019, 133_900, null, null);
  const autoDavid = await vehiculo({ nombre: "Auto David", patente: "AF 777 GG", tipo: "AUTO", marca: "Fiat", modelo: "Cronos", anio: 2021, capacidadCargaKg: 300, kmActual: 64_250, costoKm: D(210), asignadoAId: david.id, baseId: base.id, idCusat: "CUS-3001", entraEnCola: true }); // confirmar datos

  // La camioneta propia de cada uno.
  for (const [u, v] of [[leandro, ctaLeandro], [lolo, ctaLolo], [claudio, ctaClaudio], [cristian, ctaCristian], [david, autoDavid]] as const) {
    await db.usuario.update({ where: { id: u.id }, data: { vehiculoAsignadoId: v.id } });
  }

  const flota = [camion5, camion4, camion3, ctaLeandro, ctaLolo, ctaClaudio, ctaCristian, interior1, interior2, autoDavid];

  // Documentación: seguro y VTV de todos. Una VTV vence en 5 días y un seguro venció ayer.
  for (const v of flota) {
    const seguro = v.id === interior1.id ? enDias(-1) : enDias(entre(40, 300));
    const vtv = v.id === camion4.id ? enDias(5) : enDias(entre(30, 340));
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
  type P = Omit<Prisma.PedidoViajeUncheckedCreateInput, "numero">;
  const pedido = (p: P) => db.pedidoViaje.create({ data: { ...p, numero: ++numero } });
  const costo = (km: number, costoKm: Prisma.Decimal, peajes: number) => costoKm.mul(km).add(peajes);

  const desdeProveedor = (p: { id: string }) => ({ origenTipo: "PROVEEDOR" as OrigenTipo, origenId: p.id, proveedorId: p.id, tipo: "RETIRO_PROVEEDOR" as TipoPedido });

  // 20 viajes finalizados en los últimos 30 días (los 3 últimos fueron ayer).
  const historia: { dias: number; obra: typeof darwin; prov: typeof ceibo; v: typeof camion5; chofer: typeof claudio; km: number; peajes: number; desc: string; peso: number; sol: typeof daniela }[] = [];
  const choferVehiculo = [
    [claudio, camion5], [cristian, camion4], [claudio, camion3], [david, autoDavid], [cristian, camion5], [claudio, camion4],
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
      sol: (await db.usuario.findUniqueOrThrow({ where: { id: o.responsableId } })),
    });
  }
  for (const h of historia) {
    const salida = haceDias(h.dias, 8 + (h.km % 5));
    const llegada = new Date(salida.getTime() + (1 + h.km / 30) * HORA);
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
      },
    });
  }

  // La historia del problema: el mismo hierro para Darwin pedido dos veces el mismo día.
  const hoy9 = new Date(ahora);
  hoy9.setHours(9, 0, 0, 0);
  await pedido({
    ...desdeProveedor(hierros), solicitanteId: lolo.id, obraId: darwin.id, descripcion: "Hierro del 10, 40 barras", pesoKg: 1800,
    necesitaCamion: true, paraCuando: enDias(1), creadoEn: new Date(hoy9.getTime()), ordenCompraLebane: "OC 3120",
  });
  await pedido({
    ...desdeProveedor(hierros), solicitanteId: daniela.id, obraId: darwin.id, descripcion: "Hierro del 10 para losa (40 barras)", pesoKg: 1800,
    necesitaCamion: true, paraCuando: enDias(1), creadoEn: new Date(hoy9.getTime() + 2.5 * HORA), ordenCompraLebane: "OC 3120",
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
    { prov: boulogne, obra: pinares, sol: daniela, desc: "Fenólicos y tirantes para encofrado", peso: 2600, v: camion3 },
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

  // En viaje: Cristian con el Camión 4 tn, de Hierros Martínez a Chubut.
  const enViaje = await pedido({
    ...desdeProveedor(hierros), solicitanteId: cesar.id, obraId: chubut.id, descripcion: "Hierro del 8 y del 12, 60 barras", pesoKg: 2400,
    necesitaCamion: true, paraCuando: ahora, estado: "EN_VIAJE", tomadoPorId: cristian.id, tomadoEn: haceHoras(2), creadoEn: haceHoras(5),
    ordenCompraLebane: "OC 3118",
  });
  const viajeEnCurso = await db.viaje.create({
    data: { pedidoId: enViaje.id, vehiculoId: camion4.id, choferId: cristian.id, salidaReal: haceHoras(1), kmSalida: camion4.kmActual, estado: "EN_CURSO" },
  });

  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"PedidoViaje"', 'numero'), (SELECT MAX("numero") FROM "PedidoViaje"))`;

  // ─────────────────────── Combustible y services ───────────────────────
  const cargadores = new Map([[camion5.id, claudio.id], [camion4.id, cristian.id], [camion3.id, claudio.id], [autoDavid.id, david.id], [ctaClaudio.id, claudio.id], [ctaCristian.id, cristian.id], [ctaLeandro.id, leandro.id], [ctaLolo.id, lolo.id]]);
  // 4 cargas por vehículo cada ~400 km con consumo parejo; la última de la Camioneta Leandro, 40% más alta.
  const consumoBase = { CAMION: 28, CAMIONETA: 12, AUTO: 7.5, MAQUINA: 20 } as const; // l/100 km // confirmar
  for (const [vehiculoId, usuarioId] of cargadores) {
    const v = flota.find((x) => x.id === vehiculoId)!;
    for (let k = 0; k < 4; k++) {
      const extra = v.id === ctaLeandro.id && k === 0 ? 1.4 : 1 + ((k * 7) % 5 - 2) / 100;
      const litros = Math.round(consumoBase[v.tipo] * 4 * extra * 10) / 10;
      await db.cargaCombustible.create({
        data: {
          vehiculoId, usuarioId, fecha: haceDias(3 + k * 9, 7), litros: D(litros), monto: D(Math.round(litros * (v.tipo === "AUTO" ? 1150 : 1290))), // confirmar precio
          km: v.kmActual - 50 - k * 400, obraId: v.asignadoAId ? obras.find((o) => o.responsableId === v.asignadoAId)?.id ?? null : null,
        },
      });
    }
  }
  await db.mantenimientoVehiculo.createMany({
    data: [
      { vehiculoId: camion5.id, tipo: "SERVICE", fecha: haceDias(75), km: 180_100, descripcion: "Service completo: aceite, filtros y correas", taller: "Taller Ruta 202", costo: D(385_000), proximoKm: 190_000 }, // confirmar
      { vehiculoId: camion4.id, tipo: "SERVICE", fecha: haceDias(20), km: 240_200, descripcion: "Service 240.000 y cambio de pastillas", taller: "Ford Camiones Norte", costo: D(420_000), proximoKm: 250_000, proximaFecha: enDias(160) }, // confirmar
    ],
  });

  // Incidentes
  await db.incidenteVehiculo.createMany({
    data: [
      { vehiculoId: camion5.id, usuarioId: claudio.id, tipo: "MULTA", fecha: haceDias(12), descripcion: "Exceso de velocidad en Panamericana", monto: D(185_000), resuelto: true }, // confirmar
      { vehiculoId: ctaCristian.id, usuarioId: cristian.id, tipo: "ROTURA", fecha: haceDias(4), descripcion: "Espejo lateral roto al estacionar en obra", monto: D(95_000) }, // confirmar
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
  const obraDe = (o: typeof darwin) => ({ obraId: o.id, responsableId: o.responsableId });

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
        data: { herramientaId: herramienta.id, tipo: "ENTREGA", desdeUbicacionId: depo.id, haciaObraId: h.en!.id, condicion: herramienta.condicion, registradoPorId: deposito.id, recibidoPorId: h.en!.responsableId, fecha: desde },
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
          data: { herramientaId: h.id, tipo: "ENTREGA", cantidad, desdeUbicacionId: depo.id, haciaObraId: o.id, registradoPorId: deposito.id, recibidoPorId: o.responsableId, fecha: haceDias(entre(5, 40)) },
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
    let lat: number, lng: number, velocidad = 0, encendido = false;
    if (v.id === camion4.id) {
      const f = 0.55; // un poco más de la mitad del camino
      lat = hierros.latitud + (chubut.latitud - hierros.latitud) * f;
      lng = hierros.longitud + (chubut.longitud - hierros.longitud) * f;
      velocidad = 38;
      encendido = true;
    } else if (v.baseId) {
      lat = base.latitud + (azar() - 0.5) * 0.0008;
      lng = base.longitud + (azar() - 0.5) * 0.0008;
    } else if (v.asignadoAId) {
      // Camionetas propias: donde está su dueño, en una de sus obras.
      const o = obras.find((x) => x.responsableId === v.asignadoAId) ?? (v.asignadoAId === lolo.id ? darwin : null);
      lat = (o?.latitud ?? base.latitud) + 0.0004;
      lng = (o?.longitud ?? base.longitud) + 0.0004;
    } else {
      // Interior: obras del interior de la provincia. // confirmar
      lat = v.id === interior1.id ? -34.5703 : -33.3302;
      lng = v.id === interior1.id ? -59.105 : -60.2138;
    }
    await db.posicionVehiculo.create({
      data: { vehiculoId: v.id, latitud: lat, longitud: lng, velocidad, rumbo: velocidad ? 135 : 0, motorEncendido: encendido, fecha: v.id === camion4.id ? new Date() : haceHoras(entre(1, 12)) },
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

  await db.auditoria.create({ data: { usuarioId: dueno.id, accion: "seed", entidad: "Sistema", entidadId: "seed", despues: { viajeEnCurso: viajeEnCurso.id } } });

  // ─────────────────────────── Resumen ───────────────────────────
  const conteo = {
    Usuario: await db.usuario.count(),
    Ubicacion: await db.ubicacion.count(),
    Obra: await db.obra.count(),
    Proveedor: await db.proveedor.count(),
    Vehiculo: await db.vehiculo.count(),
    DocumentoVehiculo: await db.documentoVehiculo.count(),
    CargaCombustible: await db.cargaCombustible.count(),
    MantenimientoVehiculo: await db.mantenimientoVehiculo.count(),
    IncidenteVehiculo: await db.incidenteVehiculo.count(),
    PedidoViaje: await db.pedidoViaje.count(),
    Viaje: await db.viaje.count(),
    PosicionVehiculo: await db.posicionVehiculo.count(),
    CategoriaHerramienta: await db.categoriaHerramienta.count(),
    Herramienta: await db.herramienta.count(),
    ExistenciaHerramienta: await db.existenciaHerramienta.count(),
    MovimientoHerramienta: await db.movimientoHerramienta.count(),
    MaterialSobrante: await db.materialSobrante.count(),
    MantenimientoHerramienta: await db.mantenimientoHerramienta.count(),
    Alerta: await db.alerta.count(),
    Auditoria: await db.auditoria.count(),
  };
  return conteo;

}

