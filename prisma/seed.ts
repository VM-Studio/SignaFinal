/**
 * Carga inicial de SIGNA · Logística.
 * - Personas, flota, lugares y depósito reales de la empresa.
 * - Obras, proveedores y órdenes de compra desde Lebane (mock por ahora).
 * - Una cola de pedidos, viajes y movimientos de ejemplo para arrancar a usar.
 *
 * Solo corre si la base está vacía. Para recargar: npm run db:reset
 */
import { PrismaClient, Prisma, type Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sincronizarLebane } from "../lib/lebane/sincronizar";
import { evaluarAlertas } from "../lib/alertas";

const db = new PrismaClient();

const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
const enDias = (n: number) => new Date(Date.now() + n * DIA);
const haceHoras = (n: number) => new Date(Date.now() - n * HORA);

async function main() {
  if ((await db.usuario.count()) > 0) {
    console.log("La base ya tiene datos. No se cargó nada. (npm run db:reset para empezar de cero)");
    return;
  }

  const clave = process.env.SEED_PASSWORD;
  if (!clave || clave.length < 8) throw new Error("Configurá SEED_PASSWORD (mínimo 8 caracteres).");
  const passwordHash = await bcrypt.hash(clave, 10);

  // ── Obras, proveedores, órdenes de compra (Lebane)
  const resumen = await sincronizarLebane();
  console.log(`Lebane (${resumen.origen}): ${resumen.obras} obras, ${resumen.proveedores} proveedores, ${resumen.ordenes} OC`);
  const obras = Object.fromEntries((await db.obra.findMany()).map((o) => [o.nombre, o]));
  const prov = Object.fromEntries((await db.proveedor.findMany()).map((p) => [p.nombre, p]));
  const oc = Object.fromEntries((await db.ordenCompra.findMany()).map((o) => [o.numero, o]));

  // ── Personas
  const persona = (nombre: string, usuario: string, rol: Rol, extra: Partial<Prisma.UsuarioCreateInput> = {}) =>
    db.usuario.create({ data: { nombre, usuario, rol, passwordHash, ...extra } });

  await persona("Dirección", "direccion", "DIRECCION");
  const leandro = await persona("Leandro", "leandro", "RESPONSABLE_OBRA", {
    obras: { connect: ["Libertador 14500", "Alvear", "Fondo de la Legua"].map((n) => ({ id: obras[n].id })) },
  });
  const daniela = await persona("Daniela", "daniela", "RESPONSABLE_OBRA", {
    obras: { connect: ["Darwin", "Pinares II"].map((n) => ({ id: obras[n].id })) },
  });
  const cesar = await persona("César", "cesar", "RESPONSABLE_OBRA", {
    obras: { connect: Object.values(obras).map((o) => ({ id: o.id })) },
  });
  const vicky = await persona("Vicky", "vicky", "RESPONSABLE_OBRA", {
    obras: { connect: [{ id: obras["Laura Thomas"].id }] },
  });
  const lolo = await persona("Lolo", "lolo", "CAPATAZ");
  const claudio = await persona("Claudio", "claudio", "CHOFER", { licenciaVence: enDias(420), telefono: "11 5555-0101" });
  const cristian = await persona("Cristian", "cristian", "CHOFER", { licenciaVence: enDias(190), telefono: "11 5555-0102" });
  const david = await persona("David", "david", "CHOFER", { licenciaVence: enDias(18), telefono: "11 5555-0103" });
  const deposito = await persona("Encargado de depósito", "deposito", "DEPOSITO");
  await persona("Administración", "administracion", "ADMINISTRACION");

  // ── Lugares
  const cochera = await db.lugar.create({
    data: { nombre: "Cochera Martínez", tipo: "COCHERA", direccion: "Martínez (junto a la casa de Claudio)", lat: -34.4935, lng: -58.5062 },
  });
  await db.lugar.create({
    data: { nombre: "Depósito Signa", tipo: "DEPOSITO", direccion: "Munro", lat: -34.5288, lng: -58.5251 },
  });

  // ── Flota
  type V = Prisma.VehiculoUncheckedCreateInput;
  const vehiculo = (v: V) => db.vehiculo.create({ data: v });
  const camion5 = await vehiculo({
    nombre: "Camión 5 tn", tipo: "CAMION", patente: "AB 123 CD", marca: "Mercedes-Benz", modelo: "Atego 1419", anio: 2017,
    capacidadKg: 5000, costoKm: new Prisma.Decimal(980), kmActual: 189_400, lugarId: cochera.id, idCusat: "CUS-1001",
    seguroCompania: "Federación Patronal", seguroPoliza: "FP-778812", seguroVence: enDias(140), vtvVence: enDias(95),
  });
  const camion4 = await vehiculo({
    nombre: "Camión 4 tn", tipo: "CAMION", patente: "AC 456 EF", marca: "Ford", modelo: "Cargo 1723", anio: 2015,
    capacidadKg: 4000, costoKm: new Prisma.Decimal(910), kmActual: 241_050, lugarId: cochera.id, idCusat: "CUS-1002",
    seguroCompania: "Federación Patronal", seguroPoliza: "FP-778813", seguroVence: enDias(60), vtvVence: enDias(200),
  });
  const camion3 = await vehiculo({
    nombre: "Camión 3 tn", tipo: "CAMION", patente: "AD 789 GH", marca: "Iveco", modelo: "Tector 170E22", anio: 2019,
    capacidadKg: 3000, costoKm: new Prisma.Decimal(840), kmActual: 112_300, lugarId: cochera.id, idCusat: "CUS-1003",
    seguroCompania: "La Segunda", seguroPoliza: "LS-55120", seguroVence: enDias(220), vtvVence: enDias(12),
  });
  const camionetaClaudio = await vehiculo({
    nombre: "Camioneta Claudio", tipo: "CAMIONETA", patente: "AE 111 AA", marca: "Toyota", modelo: "Hilux", anio: 2020,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(420), kmActual: 98_200, asignadoAId: claudio.id, idCusat: "CUS-2001",
    seguroCompania: "La Segunda", seguroPoliza: "LS-55121", seguroVence: enDias(180), vtvVence: enDias(150),
  });
  const camionetaCristian = await vehiculo({
    nombre: "Camioneta Cristian", tipo: "CAMIONETA", patente: "AE 222 BB", marca: "Ford", modelo: "Ranger", anio: 2021,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(430), kmActual: 76_540, asignadoAId: cristian.id, idCusat: "CUS-2002",
    seguroCompania: "La Segunda", seguroPoliza: "LS-55122", seguroVence: enDias(175), vtvVence: enDias(260),
  });
  await vehiculo({
    nombre: "Camioneta Leandro", tipo: "CAMIONETA", patente: "AE 333 CC", marca: "Volkswagen", modelo: "Amarok", anio: 2022,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(450), kmActual: 54_100, asignadoAId: leandro.id, disponibleParaPedidos: false,
    idCusat: "CUS-2003", seguroCompania: "Sancor", seguroPoliza: "SC-9001", seguroVence: enDias(300), vtvVence: enDias(310),
  });
  await vehiculo({
    nombre: "Camioneta Lolo", tipo: "CAMIONETA", patente: "AE 444 DD", marca: "Toyota", modelo: "Hilux", anio: 2018,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(410), kmActual: 151_800, asignadoAId: lolo.id, disponibleParaPedidos: false,
    idCusat: "CUS-2004", seguroCompania: "Sancor", seguroPoliza: "SC-9002", seguroVence: enDias(25), vtvVence: enDias(80),
  });
  await vehiculo({
    nombre: "Camioneta Interior 1", tipo: "CAMIONETA", patente: "AE 555 EE", marca: "Chevrolet", modelo: "S10", anio: 2016,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(400), kmActual: 203_400, disponibleParaPedidos: false,
    notas: "Asignada a obras del interior.", seguroCompania: "Sancor", seguroPoliza: "SC-9003", seguroVence: enDias(-4), vtvVence: enDias(40),
  });
  await vehiculo({
    nombre: "Camioneta Interior 2", tipo: "CAMIONETA", patente: "AE 666 FF", marca: "Nissan", modelo: "Frontier", anio: 2019,
    capacidadKg: 1000, costoKm: new Prisma.Decimal(415), kmActual: 133_900, disponibleParaPedidos: false,
    notas: "Asignada a obras del interior.", seguroCompania: "Sancor", seguroPoliza: "SC-9004", seguroVence: enDias(90), vtvVence: enDias(170),
  });
  const autoDavid = await vehiculo({
    nombre: "Auto David", tipo: "AUTO", patente: "AF 777 GG", marca: "Fiat", modelo: "Cronos", anio: 2021,
    capacidadKg: 300, costoKm: new Prisma.Decimal(210), kmActual: 64_250, asignadoAId: david.id, idCusat: "CUS-3001",
    seguroCompania: "Rivadavia", seguroPoliza: "RV-3321", seguroVence: enDias(120), vtvVence: enDias(130),
  });
  await vehiculo({
    nombre: "Auto Oficina", tipo: "AUTO", patente: "AF 888 HH", marca: "Volkswagen", modelo: "Gol Trend", anio: 2017,
    capacidadKg: 300, costoKm: new Prisma.Decimal(190), kmActual: 118_700,
    seguroCompania: "Rivadavia", seguroPoliza: "RV-3322", seguroVence: enDias(210), vtvVence: null,
  });

  // ── Mantenimiento
  await db.mantenimiento.createMany({
    data: [
      { vehiculoId: camion5.id, tipo: "SERVICE", descripcion: "Service completo: aceite, filtros, correas", fecha: enDias(-75), km: 180_100, costo: new Prisma.Decimal(385_000), taller: "Taller Mecánico Ruta 202", proximoKm: 190_000, registradoPorId: deposito.id },
      { vehiculoId: camion4.id, tipo: "CUBIERTAS", descripcion: "Cambio de 2 cubiertas traseras", fecha: enDias(-30), km: 240_200, costo: new Prisma.Decimal(620_000), taller: "Gomería Panamericana", registradoPorId: deposito.id },
      { vehiculoId: camion3.id, tipo: "SERVICE", descripcion: "Service 110.000", fecha: enDias(-20), km: 110_000, costo: new Prisma.Decimal(290_000), taller: "Iveco Oficial Norte", proximoKm: 120_000, proximaFecha: enDias(160), registradoPorId: deposito.id },
      { vehiculoId: camionetaClaudio.id, tipo: "FRENOS", descripcion: "Pastillas y discos delanteros", fecha: enDias(-12), km: 97_800, costo: new Prisma.Decimal(210_000), taller: "Frenos Martínez", registradoPorId: deposito.id },
    ],
  });

  // ── Pedidos y viajes
  let n = 0;
  const pedido = (d: Omit<Prisma.PedidoViajeUncheckedCreateInput, "numero">) => db.pedidoViaje.create({ data: { ...d, numero: ++n } });

  // Entregados (historial con costos imputados)
  const historial: { obra: string; prov: string; oc?: string; desc: string; peso: number; chofer: string; veh: { id: string; kmActual: number; costoKm: Prisma.Decimal }; km: number; peajes: number; dias: number; solicitante: string }[] = [
    { obra: "Darwin", prov: "Corralón El Ceibo", oc: "OC 3001", desc: "Cemento y cal (1ª entrega)", peso: 3400, chofer: claudio.id, veh: camion5, km: 38, peajes: 2400, dias: 9, solicitante: daniela.id },
    { obra: "Chubut", prov: "Hierros Martínez", desc: "Hierro del 12", peso: 1800, chofer: cristian.id, veh: camion4, km: 14, peajes: 0, dias: 8, solicitante: cesar.id },
    { obra: "Laura Thomas", prov: "Eléctrica Libertador", desc: "Tableros y térmicas", peso: 90, chofer: david.id, veh: autoDavid, km: 11, peajes: 0, dias: 7, solicitante: vicky.id },
    { obra: "Pinares II", prov: "Maderera Boulogne", desc: "Fenólicos", peso: 1600, chofer: claudio.id, veh: camion3, km: 52, peajes: 3800, dias: 6, solicitante: daniela.id },
    { obra: "Gaspar Campos", prov: "Sanitarios Norte", desc: "Inodoros y vanitorys", peso: 420, chofer: cristian.id, veh: camionetaCristian, km: 9, peajes: 0, dias: 5, solicitante: cesar.id },
    { obra: "Libertador 14500", prov: "Corralón El Ceibo", desc: "Arena y piedra", peso: 4800, chofer: claudio.id, veh: camion5, km: 21, peajes: 0, dias: 4, solicitante: leandro.id },
    { obra: "Alvear", prov: "Hierros Martínez", desc: "Malla sima", peso: 900, chofer: cristian.id, veh: camionetaCristian, km: 6, peajes: 0, dias: 3, solicitante: leandro.id },
    { obra: "Fondo de la Legua", prov: "Andamios del Norte", desc: "Retiro de andamios alquilados", peso: 2100, chofer: claudio.id, veh: camion4, km: 17, peajes: 0, dias: 2, solicitante: lolo.id },
    { obra: "Darwin", prov: "Pinturerías Rex Tigre", desc: "Látex y enduido", peso: 250, chofer: david.id, veh: autoDavid, km: 44, peajes: 2400, dias: 1, solicitante: daniela.id },
  ];
  for (const h of historial) {
    const salida = new Date(Date.now() - h.dias * DIA - 5 * HORA);
    const llegada = new Date(salida.getTime() + 2 * HORA);
    const p = await pedido({
      estado: "ENTREGADO", tipoCarga: "MATERIALES", descripcion: h.desc, pesoKg: h.peso, solicitanteId: h.solicitante,
      obraId: obras[h.obra].id, proveedorId: prov[h.prov].id, ordenCompraId: h.oc ? oc[h.oc].id : null,
      choferId: h.chofer, vehiculoId: h.veh.id, tomadoEn: new Date(salida.getTime() - HORA), creadoEn: new Date(salida.getTime() - 4 * HORA),
    });
    const kmSalida = h.veh.kmActual - h.km * (h.dias + 1);
    await db.viaje.create({
      data: {
        pedidoId: p.id, choferId: h.chofer, vehiculoId: h.veh.id, obraId: obras[h.obra].id, estado: "FINALIZADO",
        kmSalida, kmLlegada: kmSalida + h.km, kmRecorridos: h.km, peajes: new Prisma.Decimal(h.peajes),
        costoKmAplicado: h.veh.costoKm, costo: h.veh.costoKm.mul(h.km).add(h.peajes), salidaEn: salida, llegadaEn: llegada,
      },
    });
  }

  // En viaje: Cristian con el Camión 4 tn
  const enViaje = await pedido({
    estado: "EN_VIAJE", tipoCarga: "MATERIALES", descripcion: "Hierro del 8 y del 10, 60 barras", pesoKg: 2400,
    solicitanteId: cesar.id, obraId: obras["Chubut"].id, proveedorId: prov["Hierros Martínez"].id, ordenCompraId: oc["OC 3002"].id,
    choferId: cristian.id, vehiculoId: camion4.id, tomadoEn: haceHoras(2), creadoEn: haceHoras(5),
  });
  await db.viaje.create({
    data: {
      pedidoId: enViaje.id, choferId: cristian.id, vehiculoId: camion4.id, obraId: obras["Chubut"].id,
      kmSalida: camion4.kmActual, costoKmAplicado: camion4.costoKm, salidaEn: haceHoras(1),
    },
  });

  // Tomado: Claudio
  await pedido({
    estado: "TOMADO", tipoCarga: "MATERIALES", descripcion: "Ladrillos huecos 18 x 3000 u.", pesoKg: 4500, prioridad: "NORMAL",
    vehiculoRequerido: "CAMION", solicitanteId: leandro.id, obraId: obras["Libertador 14500"].id, proveedorId: prov["Corralón El Ceibo"].id,
    ordenCompraId: oc["OC 3006"].id, choferId: claudio.id, tomadoEn: haceHoras(1), creadoEn: haceHoras(3),
  });

  // Pendientes: la cola
  await pedido({
    tipoCarga: "MATERIALES", descripcion: "Caños PPF 20 y 25 + accesorios", pesoKg: 180, prioridad: "URGENTE",
    solicitanteId: cesar.id, obraId: obras["Gaspar Campos"].id, proveedorId: prov["Sanitarios Norte"].id, ordenCompraId: oc["OC 3003"].id,
    observaciones: "Los plomeros están parados esperando.", creadoEn: haceHoras(3),
  });
  await pedido({
    tipoCarga: "MATERIALES", descripcion: "Tirantes y fenólicos para encofrado", pesoKg: 3200, vehiculoRequerido: "CAMION",
    solicitanteId: daniela.id, obraId: obras["Pinares II"].id, proveedorId: prov["Maderera Boulogne"].id, ordenCompraId: oc["OC 3005"].id,
    necesarioPara: enDias(1), creadoEn: haceHoras(2),
  });
  await pedido({
    tipoCarga: "MAQUINARIA", descripcion: "Llevar hormigonera 350 l del depósito", pesoKg: 450, vehiculoRequerido: "CAMIONETA",
    solicitanteId: vicky.id, obraId: obras["Laura Thomas"].id, origenTexto: "Depósito Signa", creadoEn: haceHoras(1),
  });
  await pedido({
    tipoCarga: "MATERIALES", descripcion: "Cable 2,5 mm x 10 rollos + cajas", pesoKg: 120, vehiculoRequerido: "AUTO",
    solicitanteId: vicky.id, obraId: obras["Laura Thomas"].id, proveedorId: prov["Eléctrica Libertador"].id, ordenCompraId: oc["OC 3004"].id,
    creadoEn: haceHoras(0.5),
  });

  // Cancelado
  await pedido({
    estado: "CANCELADO", tipoCarga: "MATERIALES", descripcion: "Látex exterior (lo trae el proveedor)", pesoKg: 300,
    solicitanteId: daniela.id, obraId: obras["Pinares II"].id, proveedorId: prov["Pinturerías Rex Tigre"].id,
    canceladoEn: haceHoras(20), canceladoPorId: daniela.id, motivoCancelacion: "El proveedor hace el envío.", creadoEn: haceHoras(26),
  });

  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"PedidoViaje"', 'numero'), (SELECT MAX("numero") FROM "PedidoViaje"))`;

  // ── Combustible
  const cargas: [string, string, number, number, number, number][] = [
    [camion5.id, claudio.id, 120, 162_000, camion5.kmActual - 300, 6],
    [camion4.id, cristian.id, 110, 148_500, camion4.kmActual - 180, 4],
    [camionetaClaudio.id, claudio.id, 60, 72_000, camionetaClaudio.kmActual - 90, 3],
    [camionetaCristian.id, cristian.id, 55, 66_000, camionetaCristian.kmActual - 40, 2],
    [autoDavid.id, david.id, 38, 41_800, autoDavid.kmActual - 60, 1],
  ];
  for (const [vehiculoId, choferId, litros, monto, km, dias] of cargas) {
    await db.cargaCombustible.create({
      data: { vehiculoId, choferId, litros: new Prisma.Decimal(litros), monto: new Prisma.Decimal(monto), km, fecha: enDias(-dias) },
    });
  }

  // ── Depósito: maquinaria y herramientas
  const unitaria = (codigo: string, nombre: string, categoria: "MAQUINARIA" | "HERRAMIENTA", extra: Partial<Prisma.ItemUncheckedCreateInput> = {}) =>
    db.item.create({ data: { codigo, nombre, categoria, control: "UNITARIA", ...extra } });

  const hormigonera1 = await unitaria("MQ-0001", "Hormigonera 350 l (1)", "MAQUINARIA", { marca: "Czerweny", modelo: "350", numeroSerie: "CZ-350-88121", obraId: obras["Darwin"].id, tenedorId: daniela.id, ubicadoDesde: enDias(-70) });
  await unitaria("MQ-0002", "Hormigonera 350 l (2)", "MAQUINARIA", { marca: "Czerweny", modelo: "350", numeroSerie: "CZ-350-90433" });
  const vibrador = await unitaria("MQ-0003", "Vibrador de hormigón", "MAQUINARIA", { marca: "Wacker", modelo: "M2500", obraId: obras["Chubut"].id, tenedorId: cesar.id, ubicadoDesde: enDias(-12) });
  await unitaria("MQ-0004", "Generador 5 kVA", "MAQUINARIA", { marca: "Gamma", modelo: "GE-5500" });
  await unitaria("MQ-0005", "Martillo demoledor", "MAQUINARIA", { marca: "Bosch", modelo: "GSH 11 VC", obraId: obras["Libertador 14500"].id, tenedorId: leandro.id, ubicadoDesde: enDias(-5) });
  await unitaria("MQ-0006", "Placa compactadora", "MAQUINARIA", { marca: "Honda", modelo: "GX160" });
  await unitaria("MQ-0007", "Cortadora de pavimento", "MAQUINARIA", { marca: "Husqvarna", modelo: "FS 400", estado: "EN_REPARACION", notas: "Cambio de disco y correa" });
  await unitaria("HE-0001", "Amoladora 9\"", "HERRAMIENTA", { marca: "DeWalt", modelo: "DWE4579" });
  await unitaria("HE-0002", "Amoladora 9\" (2)", "HERRAMIENTA", { marca: "DeWalt", modelo: "DWE4579", obraId: obras["Gaspar Campos"].id, tenedorId: cesar.id, ubicadoDesde: enDias(-3) });
  await unitaria("HE-0003", "Taladro percutor", "HERRAMIENTA", { marca: "Makita", modelo: "HP2070" });
  await unitaria("HE-0004", "Nivel láser", "HERRAMIENTA", { marca: "Bosch", modelo: "GLL 3-80" });

  const porCantidad = async (codigo: string, nombre: string, categoria: "HERRAMIENTA" | "SOBRANTE", unidad: string, stock: [string | null, number][]) => {
    const item = await db.item.create({ data: { codigo, nombre, categoria, control: "CANTIDAD", unidad } });
    for (const [obra, cantidad] of stock) {
      await db.stockItem.create({ data: { itemId: item.id, obraId: obra ? obras[obra].id : null, cantidad } });
    }
    return item;
  };
  const palas = await porCantidad("CA-0001", "Palas", "HERRAMIENTA", "unidades", [[null, 18], ["Darwin", 6], ["Chubut", 4]]);
  await porCantidad("CA-0002", "Baldes", "HERRAMIENTA", "unidades", [[null, 35], ["Darwin", 10], ["Pinares II", 8]]);
  await porCantidad("CA-0003", "Puntales metálicos", "HERRAMIENTA", "unidades", [[null, 140], ["Chubut", 80], ["Libertador 14500", 60]]);
  await porCantidad("CA-0004", "Carretillas", "HERRAMIENTA", "unidades", [[null, 6], ["Gaspar Campos", 2], ["Alvear", 2]]);
  await porCantidad("CA-0005", "Cuerpos de andamio", "HERRAMIENTA", "unidades", [[null, 40], ["Fondo de la Legua", 24]]);
  await porCantidad("SO-0001", "Cable 2,5 mm (sobrante)", "SOBRANTE", "m", [[null, 320]]);
  await porCantidad("SO-0002", "Caño PPF 20 (sobrante)", "SOBRANTE", "unidades", [[null, 25]]);

  // Movimientos que explican dónde está cada cosa
  await db.movimientoItem.createMany({
    data: [
      { itemId: hormigonera1.id, tipo: "ENTREGA", haciaObraId: obras["Darwin"].id, recibidoPorId: daniela.id, registradoPorId: deposito.id, fecha: enDias(-70) },
      { itemId: vibrador.id, tipo: "ENTREGA", haciaObraId: obras["Chubut"].id, recibidoPorId: cesar.id, registradoPorId: deposito.id, fecha: enDias(-12) },
      { itemId: palas.id, tipo: "ENTREGA", cantidad: 6, haciaObraId: obras["Darwin"].id, recibidoPorId: daniela.id, registradoPorId: deposito.id, fecha: enDias(-20) },
    ],
  });

  // Solicitudes de obra
  const hormigonera2 = await db.item.findUniqueOrThrow({ where: { codigo: "MQ-0002" } });
  await db.solicitudHerramienta.create({
    data: { tipo: "PEDIDO", itemId: hormigonera2.id, obraId: obras["Laura Thomas"].id, solicitanteId: vicky.id, observaciones: "Para el hormigonado del viernes", creadaEn: haceHoras(5) },
  });
  await db.solicitudHerramienta.create({
    data: { tipo: "DEVOLUCION", itemId: palas.id, cantidad: 4, obraId: obras["Chubut"].id, solicitanteId: cesar.id, creadaEn: haceHoras(30) },
  });

  const { activas } = await evaluarAlertas();
  console.log(`Listo. ${await db.usuario.count()} personas, ${await db.vehiculo.count()} vehículos, ${await db.pedidoViaje.count()} pedidos, ${await db.item.count()} ítems, ${activas} alertas activas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
