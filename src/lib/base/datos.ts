/**
 * DATOS BASE de SIGNA · Logística: lo único que queda fijo para empezar a usar la app de verdad.
 *   - Los usuarios con su rol (se conservan: mismo id, contraseña y avisos del celular; solo se
 *     crean los que falten, con la contraseña inicial).
 *   - La base de camiones (Martínez) y el depósito real (Av. Mitre 1254, Florida).
 *   - Los seis vehículos reales, tal como los muestra Cusat (el rastreo los enlaza solo por patente).
 *   - El inventario real de herramientas (src/lib/base/herramientas.ts), todo en el depósito.
 * Todo lo demás se borra: obras, proveedores, pedidos, viajes, materiales, avisos, alertas,
 * posiciones, combustible, mantenimiento y actividad. Eso se carga desde la app.
 *
 * La usan prisma/seed.ts, scripts/cargar-base.ts y el botón "Dejar solo los datos base" (MODO_DEMO).
 */
import { type PrismaClient, Prisma, type Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INVENTARIO_HERRAMIENTAS } from "./herramientas";

export const CONTRASENA_INICIAL = "signa2026";

const D = (n: number) => new Prisma.Decimal(n);

/** Usuarios y roles. Los datos de cada uno (teléfono, licencia) se corrigen en Usuarios. */
const USUARIOS: { nombre: string; email: string; rol: Rol; telefono?: string; licenciaCategoria?: string }[] = [
  { nombre: "Dirección", email: "direccion", rol: "DIRECCION" },
  { nombre: "Leandro", email: "leandro", rol: "RESPONSABLE_OBRA" },
  { nombre: "Daniela", email: "daniela", rol: "RESPONSABLE_OBRA" },
  { nombre: "César", email: "cesar", rol: "RESPONSABLE_OBRA" },
  { nombre: "Vicky", email: "vicky", rol: "RESPONSABLE_OBRA" },
  { nombre: "Lolo", email: "lolo", rol: "CAPATAZ" },
  { nombre: "Claudio", email: "claudio", rol: "CHOFER", licenciaCategoria: "C2" },
  { nombre: "Cristian", email: "cristian", rol: "CHOFER", licenciaCategoria: "C2" },
  { nombre: "David", email: "david", rol: "CHOFER", licenciaCategoria: "B1" },
  { nombre: "Encargado de depósito", email: "deposito", rol: "DEPOSITO" },
  { nombre: "Administración", email: "administracion", rol: "ADMINISTRACION" },
  { nombre: "Compras", email: "compras", rol: "COMPRAS" },
];

async function limpiar(db: PrismaClient) {
  // Orden inverso a las dependencias. Usuarios y sus suscripciones push NO se tocan.
  await db.$executeRawUnsafe(`ALTER TABLE "Auditoria" DISABLE TRIGGER USER`).catch(() => {});
  await db.auditoria.deleteMany();
  await db.$executeRawUnsafe(`ALTER TABLE "Auditoria" ENABLE TRIGGER USER`).catch(() => {});
  await db.alerta.deleteMany();
  await db.notificacion.deleteMany();
  await db.mantenimientoHerramienta.deleteMany();
  await db.materialSobrante.deleteMany();
  await db.movimientoHerramienta.deleteMany();
  await db.existenciaHerramienta.deleteMany();
  await db.herramienta.deleteMany();
  await db.categoriaHerramienta.deleteMany();
  await db.posicionVehiculo.deleteMany();
  await db.estadoSistema.deleteMany();
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
  // Los números de pedido vuelven a empezar en 1.
  await db.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "PedidoViaje_numero_seq" RESTART WITH 1`).catch(() => {});
  await db.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "PedidoMaterial_numero_seq" RESTART WITH 1`).catch(() => {});
}

/** Aviso que llevan el seguro y la VTV de mentira, para encontrarlos y reemplazarlos. */
export const NOTA_PROVISORIA = "PROVISORIO: reemplazar por el real";

/**
 * Seguro y VTV vigentes PROVISORIOS (un año) para cada vehículo que no tenga, así se pueden usar
 * mientras se carga la documentación real en Flota. No toca los documentos ya cargados.
 */
export async function documentosProvisorios(db: PrismaClient) {
  const vence = new Date(Date.now() + 365 * 86_400_000);
  const vehiculos = await db.vehiculo.findMany({ where: { activo: true }, select: { id: true, nombre: true, documentos: { select: { tipo: true } } } });
  const creados: string[] = [];
  for (const v of vehiculos) {
    for (const tipo of ["SEGURO", "VTV"] as const) {
      if (v.documentos.some((d) => d.tipo === tipo)) continue;
      await db.documentoVehiculo.create({ data: { vehiculoId: v.id, tipo, vencimiento: vence, notas: NOTA_PROVISORIA } });
      creados.push(`${v.nombre}: ${tipo}`);
    }
  }
  return creados;
}

export async function cargarDatosBase(db: PrismaClient) {
  await limpiar(db);

  // ─────────────────────────── Usuarios ───────────────────────────
  const passwordHash = await bcrypt.hash(CONTRASENA_INICIAL, 10);
  const usuarios = new Map<string, string>();
  for (const u of USUARIOS) {
    const email = `${u.email}@signa.demo`;
    const ya = await db.usuario.findUnique({ where: { email }, select: { id: true } });
    // Choferes nuevos: licencia con vencimiento PROVISORIO (un año) para que puedan aceptar viajes; se corrige en Usuarios.
    const licencia = u.rol === "CHOFER" ? { licenciaCategoria: u.licenciaCategoria ?? null, licenciaVencimiento: new Date(Date.now() + 365 * 86_400_000) } : {};
    const x = ya ?? (await db.usuario.create({ data: { nombre: u.nombre, email, rol: u.rol, telefono: u.telefono ?? null, ...licencia, passwordHash }, select: { id: true } }));
    usuarios.set(u.email, x.id);
  }

  // ────────────────────── Base y depósito ──────────────────────
  const base = await db.ubicacion.create({
    // Donde Cusat muestra los camiones parados (Triunfo Argentino / Granada y Maestro).
    data: { nombre: "Base de camiones Martínez", tipo: "BASE_VEHICULOS", direccion: "Triunfo Argentino y Granada, Martínez, San Isidro", latitud: -34.49902, longitud: -58.54408 },
  });
  const deposito = await db.ubicacion.create({
    // La dirección del depósito que figura en el inventario.
    data: { nombre: "Depósito Florida", tipo: "DEPOSITO", direccion: "Av. Bartolomé Mitre 1254, Florida, Vicente López", latitud: -34.53837, longitud: -58.50767 },
  });

  // ─────────────────────────── Flota real ───────────────────────────
  // Tal cual aparece en Cusat. idCusat se completa solo al sincronizar (empareja por patente).
  // Km en 0: la primera salida con el km del tablero los deja al día. Seguro y VTV se cargan en Flota.
  type V = Prisma.VehiculoUncheckedCreateInput;
  const flota: V[] = [
    { nombre: "Camión Mercedes 710", patente: "HFD336", tipo: "CAMION", marca: "Mercedes-Benz", modelo: "710", anio: 2008, capacidadCargaKg: 5000, kmActual: 0, costoKm: D(980), baseId: base.id, cusatNombre: "MERCEDES 710", entraEnCola: true },
    { nombre: "Camión Kia", patente: "AH282PU", tipo: "CAMION", marca: "Kia", modelo: "K2500", anio: 2025, capacidadCargaKg: 3000, kmActual: 0, costoKm: D(760), baseId: base.id, cusatNombre: "KIA", entraEnCola: true },
    { nombre: "Zanella", patente: "AG149BJ", tipo: "AUTO", marca: "Zanella", modelo: "A confirmar", anio: 2023, capacidadCargaKg: 0, kmActual: 0, costoKm: D(120), baseId: base.id, cusatNombre: "ZANELLA", entraEnCola: false },
    { nombre: "Oroch", patente: "AC689NR", tipo: "CAMIONETA", marca: "Renault", modelo: "Oroch", anio: 2018, capacidadCargaKg: 650, kmActual: 0, costoKm: D(430), baseId: base.id, cusatNombre: "OROCH", entraEnCola: false },
    { nombre: "Kangoo", patente: "AF399OO", tipo: "CAMIONETA", marca: "Renault", modelo: "Kangoo", anio: 2023, capacidadCargaKg: 650, kmActual: 0, costoKm: D(380), cusatNombre: "KANGOO", entraEnCola: false },
    { nombre: "Kangoo LL", patente: "AF399OP", tipo: "CAMIONETA", marca: "Renault", modelo: "Kangoo (larga)", anio: 2023, capacidadCargaKg: 800, kmActual: 0, costoKm: D(390), baseId: base.id, cusatNombre: "KANGOO LL", entraEnCola: false },
  ];
  for (const v of flota) await db.vehiculo.create({ data: v });
  await documentosProvisorios(db);

  // ─────────────────── Herramientas: todo en el depósito ───────────────────
  const categorias = new Map<string, string>();
  for (const nombre of new Set(INVENTARIO_HERRAMIENTAS.map((h) => h.categoria))) {
    categorias.set(nombre, (await db.categoriaHerramienta.create({ data: { nombre } })).id);
  }
  let n = 0;
  for (const h of INVENTARIO_HERRAMIENTAS) {
    const codigo = `SIG-${String(++n).padStart(4, "0")}`;
    const comun = { codigo, nombre: h.nombre, categoriaId: categorias.get(h.categoria)!, esMaquina: !!h.esMaquina, estado: "DISPONIBLE" as const };
    if (h.cantidad === 1) {
      // Una sola: se sigue de a una (QR propio, quién la tiene).
      await db.herramienta.create({ data: { ...comun, tipoControl: "UNITARIA", ubicacionId: deposito.id } });
    } else {
      // Varias iguales: stock por ubicación.
      const x = await db.herramienta.create({ data: { ...comun, tipoControl: "CANTIDAD" } });
      await db.existenciaHerramienta.create({ data: { herramientaId: x.id, ubicacionId: deposito.id, cantidad: h.cantidad } });
    }
  }

  await db.auditoria.create({
    data: {
      usuarioId: usuarios.get("direccion") ?? null, rol: "DIRECCION", accion: "datos.base", entidad: "Sistema", entidadId: "base",
      resumen: `Se dejaron solo los datos base: ${USUARIOS.length} usuarios, ${flota.length} vehículos y ${INVENTARIO_HERRAMIENTAS.length} herramientas en el depósito`,
    },
  });

  const conteo = {
    Usuario: await db.usuario.count(),
    Ubicacion: await db.ubicacion.count(),
    Vehiculo: await db.vehiculo.count(),
    "Seguro y VTV provisorios": await db.documentoVehiculo.count({ where: { notas: NOTA_PROVISORIA } }),
    CategoriaHerramienta: await db.categoriaHerramienta.count(),
    Herramienta: await db.herramienta.count(),
    "Unidades en depósito": INVENTARIO_HERRAMIENTAS.reduce((s, h) => s + h.cantidad, 0),
    Obra: await db.obra.count(),
    Proveedor: await db.proveedor.count(),
    PedidoViaje: await db.pedidoViaje.count(),
    PedidoMaterial: await db.pedidoMaterial.count(),
    Notificacion: await db.notificacion.count(),
    Alerta: await db.alerta.count(),
  };
  return conteo;
}
