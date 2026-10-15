/**
 * DATOS DE PRUEBA (solo para el seed de desarrollo: `npx prisma db seed`). Nunca se cargan en
 * producción ni con el botón "Dejar solo los datos base". Sirven para probar de punta a punta:
 *   - proveedores con sucursales (Corralón San Martín con tres, Hierros Martínez con dos);
 *   - un pedido de material con una lista adjunta (PDF) y observaciones;
 *   - dos órdenes de compra: una APROBADA (con PDF) y una ESPERANDO_APROBACION;
 *   - tres materiales habilitados en la MISMA sucursal (Corralón San Martín · Villa Crespo) para tres
 *     obras, con su pedido de viaje pendiente (para el viaje combinado);
 *   - una hormigonera en el Terreno Humboldt (a ~1 km del corralón) con su traslado pendiente;
 *   - un viaje aceptado por Claudio para pasado mañana (bloqueo por fecha y recordatorios).
 */
import { Prisma, type PrismaClient, type TipoPedido, type OrigenTipo } from "@prisma/client";
import { aFecha, diaISO } from "@/lib/formato";
import { anioArgentina, siguienteNumero } from "@/lib/compras/numerar";
import { crearViaje } from "@/lib/viajes/paradas";

const D = (n: number) => new Prisma.Decimal(n);

/** PDF mínimo válido con unas líneas de texto (la "lista de materiales" de ejemplo). */
export function pdfSimple(lineas: string[]) {
  const texto = lineas.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${l.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

export async function cargarDatosPrueba(db: PrismaClient) {
  const u = async (email: string) => (await db.usuario.findUniqueOrThrow({ where: { email: `${email}@signa.demo` }, select: { id: true, nombre: true } }));
  const [daniela, cesar, leandro, compras, direccion, claudio] = await Promise.all(["daniela", "cesar", "leandro", "compras", "direccion", "claudio"].map(u));
  const obra = async (codigo: string) => db.obra.findUniqueOrThrow({ where: { codigo } });
  const [darwin, chubut, pinares, bayres] = await Promise.all(["OB-DARWIN", "OB-CHUBUT", "OB-PINARES2", "OB-BAYRES"].map(obra));
  const humboldt = await db.ubicacion.findFirstOrThrow({ where: { nombre: "Terreno Humboldt 2417" } });
  const florida = await db.ubicacion.findFirstOrThrow({ where: { nombre: "Depósito Florida" } });
  const hoy = diaISO();
  const pasadoManana = diaISO(new Date(Date.now() + 2 * 86_400_000));

  // ─────────────────── Proveedores con sucursales ───────────────────
  const proveedor = (nombre: string, extra: Partial<Prisma.ProveedorCreateInput>, sucursales: Prisma.SucursalProveedorCreateWithoutProveedorInput[]) =>
    db.proveedor.create({ data: { nombre, ...extra, sucursales: { create: sucursales } }, include: { sucursales: true } });
  const sanMartin = await proveedor("Corralón San Martín", { cuit: "30-71234567-8", telefono: "11 4791-2200", rubro: "Corralón" }, [
    { nombre: "Casa central", direccion: "Av. San Martín 2450", localidad: "Florida", latitud: -34.5296, longitud: -58.4907, horarioRetiro: "lun a vie 7 a 16, sáb 7 a 12", contacto: "Sergio (playa de carga)", principal: true },
    { nombre: "Sucursal Villa Crespo", direccion: "Av. Warnes 2050", localidad: "Villa Crespo, CABA", latitud: -34.5875, longitud: -58.4575, horarioRetiro: "lun a vie 7 a 17", contacto: "Marta, 11 4855-3000" },
    { nombre: "Sucursal Pilar", direccion: "Ruta 8 km 50,5", localidad: "Pilar", latitud: -34.4588, longitud: -58.9142, horarioRetiro: "lun a sáb 7 a 13", contacto: "Hernán" },
  ]);
  const hierros = await proveedor("Hierros Martínez", { cuit: "30-65432198-7", telefono: "11 4798-1100", rubro: "Hierros" }, [
    { nombre: "Casa central", direccion: "Av. Santa Fe 2900", localidad: "Martínez", latitud: -34.4925, longitud: -58.5115, horarioRetiro: "lun a vie 8 a 17", principal: true },
    { nombre: "Sucursal Tigre", direccion: "Av. Cazón 1200", localidad: "Tigre", latitud: -34.4255, longitud: -58.5796, horarioRetiro: "lun a vie 8 a 16" },
  ]);
  const ferreteria = await proveedor("Ferretería Industrial Norte", { telefono: "11 4799-1414", rubro: "Ferretería" }, [
    { nombre: "Casa central", direccion: "Av. Maipú 2100", localidad: "Olivos", latitud: -34.5085, longitud: -58.49, horarioRetiro: "lun a vie 8 a 18", principal: true },
  ]);
  const scVillaCrespo = sanMartin.sucursales.find((s) => s.nombre === "Sucursal Villa Crespo")!;

  // ─────────────────── Hormigonera en el Terreno Humboldt ───────────────────
  const maquinaria = await db.categoriaHerramienta.upsert({ where: { nombre: "Maquinaria" }, create: { nombre: "Maquinaria" }, update: {} });
  const ultimo = await db.herramienta.count();
  const hormigonera = await db.herramienta.create({
    data: { codigo: `SIG-${String(ultimo + 1).padStart(4, "0")}`, nombre: "Hormigonera 350 l", categoriaId: maquinaria.id, esMaquina: true, tipoControl: "UNITARIA", estado: "DISPONIBLE", ubicacionId: humboldt.id },
  });

  // ─────────────────── Documentos de compra (OC/PE) ───────────────────
  const empresa = (await db.razonSocial.findFirst({ orderBy: { orden: "asc" } }))?.id ?? null;
  const historia = async (ordenCompraId: string, estados: [string, string | null][]) => {
    let de: string | null = null;
    for (const [a, usuarioId] of estados) {
      await db.cambioEstadoOC.create({ data: { ordenCompraId, de: de as never, a: a as never, usuarioId } });
      de = a;
    }
  };
  const doc = (d: { obraId: string; solicitanteId: string; creadaPorId?: string; detalle: string; para: string; estado: "ENVIADA_A_COMPRAS" | "EN_COMPRAS" | "ESPERANDO_AUTORIZACION" | "AUTORIZADA" | "HABILITADA"; extra?: Prisma.OrdenCompraUncheckedCreateInput | object }) =>
    db.ordenCompra.create({
      data: {
        tipo: "OC", estado: d.estado, fuente: "ARQUITECTA", creadaPorId: d.creadaPorId ?? d.solicitanteId, obraId: d.obraId, solicitanteId: d.solicitanteId, empresaCompraId: empresa,
        detallePedido: d.detalle, fechaNecesaria: aFecha(d.para, "12:00"), enviadaAComprasEn: new Date(),
        ...(d.estado === "ENVIADA_A_COMPRAS" ? {} : { tomadoPorId: compras.id, tomadoEn: new Date() }),
        ...(d.extra ?? {}),
      },
    });

  // 1) Daniela pide con una lista adjunta (PDF) y observaciones: llega a Compras como "Solo indicaciones".
  const conLista = await doc({
    obraId: darwin.id, solicitanteId: daniela.id, detalle: "Ver lista adjunta (lista-materiales-darwin.pdf)", para: diaISO(new Date(Date.now() + 3 * 86_400_000)), estado: "ENVIADA_A_COMPRAS",
    extra: { observacionesSolicitante: "Descargar por Darwin, el portón de Thames está cerrado. Avisar a Lolo antes de mandar. El cemento que sea Loma Negra." },
  });
  await historia(conLista.id, [["ENVIADA_A_COMPRAS", daniela.id]]);
  const pdf = pdfSimple(["Lista de materiales - Obra Darwin 1299", "40 bolsas de cemento Loma Negra x 50 kg", "20 barras de hierro del 8", "10 m3 de arena gruesa", "Pedido por Daniela"]);
  const archivo = await db.archivo.create({ data: { tipo: "application/pdf", nombre: "lista-materiales-darwin.pdf", datos: new Uint8Array(pdf), tamano: pdf.length, subidoPorId: daniela.id } });
  await db.adjunto.create({ data: { entidadTipo: "ORDEN_COMPRA", entidadId: conLista.id, nombre: "lista-materiales-darwin.pdf", url: `db:${archivo.id}`, tipoMime: "application/pdf", tamanoBytes: pdf.length, subidoPorId: daniela.id } });

  // 2) Esperando la autorización del dueño (Bayres Connect, Hierros Martínez) y 3) autorizada y habilitada (Darwin, cemento).
  const conNumero = async (estado: "AUTORIZADA" | "ESPERANDO_AUTORIZACION" | "HABILITADA", d: { obraId: string; solicitanteId: string; detalle: string; para: string }, suc: { id: string; proveedorId: string }, importe: number) => {
    const n = await db.$transaction((tx) => siguienteNumero(tx, "OC"));
    const autorizada = estado !== "ESPERANDO_AUTORIZACION";
    return doc({
      ...d, estado,
      extra: {
        numero: n.numero, numeroTexto: String(n.secuencia), anio: anioArgentina(), secuencia: n.secuencia, proveedorId: suc.proveedorId, sucursalId: suc.id,
        presupuestoNumero: autorizada ? "P-2231" : null, formaPago: autorizada ? "ACOPIO" : "CUENTA_CORRIENTE", importe: D(importe), enviadaEn: new Date(),
        estadoTablero: autorizada ? (estado === "HABILITADA" ? "HABILITADA" : "AUTORIZADA") : "PEDIR_AUTORIZACION", estadoTableroAuto: autorizada ? (estado === "HABILITADA" ? "HABILITADA" : "AUTORIZADA") : "PEDIR_AUTORIZACION",
        proximosPasos: autorizada ? "Claudio retira el jueves a primera hora." : null,
        // Sin PDF guardado: /api/oc/[id]/pdf lo genera con la plantilla desde estos datos.
        ...(autorizada ? { aprobadaPorId: direccion.id, aprobadaEn: new Date(), encargadaEn: new Date() } : {}),
      },
    });
  };
  const ocPendiente = await conNumero("ESPERANDO_AUTORIZACION", { obraId: bayres.id, solicitanteId: leandro.id, detalle: "20 - paneles de Malla sima 15x15 del 6\n5 - kg de Alambre de atar", para: pasadoManana }, hierros.sucursales.find((s) => s.principal)!, 945_010);
  const cementoDarwin = await conNumero("HABILITADA", { obraId: darwin.id, solicitanteId: daniela.id, detalle: "40 - bolsas de Cemento Portland Loma Negra x 50 kg", para: hoy }, scVillaCrespo, 556_600);
  await historia(ocPendiente.id, [["ENVIADA_A_COMPRAS", leandro.id], ["EN_COMPRAS", compras.id], ["ESPERANDO_AUTORIZACION", compras.id]]);
  await historia(cementoDarwin.id, [["ENVIADA_A_COMPRAS", daniela.id], ["EN_COMPRAS", compras.id], ["ESPERANDO_AUTORIZACION", compras.id], ["AUTORIZADA", direccion.id], ["ENCARGADA", compras.id], ["HABILITADA", compras.id]]);

  // Los otros dos que se retiran en la misma sucursal: hierro para Chubut y cemento para Pinares II (4.000 kg: no entra en el Kia).
  const hierroChubut = await doc({ obraId: chubut.id, solicitanteId: cesar.id, detalle: "Hierro del 12, 20 barras", para: hoy, estado: "HABILITADA", extra: { aprobadaPorId: direccion.id, aprobadaEn: new Date(), estadoTablero: "HABILITADA", estadoTableroAuto: "HABILITADA" } });
  const cementoPinares = await doc({ obraId: pinares.id, solicitanteId: daniela.id, detalle: "Cemento y cal para platea, 160 bolsas", para: hoy, estado: "HABILITADA", extra: { aprobadaPorId: direccion.id, aprobadaEn: new Date(), estadoTablero: "HABILITADA", estadoTableroAuto: "HABILITADA" } });
  await historia(hierroChubut.id, [["ENVIADA_A_COMPRAS", cesar.id], ["EN_COMPRAS", compras.id], ["AUTORIZADA", direccion.id], ["HABILITADA", compras.id]]);
  await historia(cementoPinares.id, [["ENVIADA_A_COMPRAS", daniela.id], ["EN_COMPRAS", compras.id], ["AUTORIZADA", direccion.id], ["HABILITADA", compras.id]]);

  // ─────────────────── Pedidos de viaje ───────────────────
  const destino = (o: typeof darwin) => ({ obraId: o.id, destinoNombre: `Obra ${o.nombre}`, destinoDireccion: `${o.direccion}, ${o.localidad}`, destinoLat: o.latitud, destinoLng: o.longitud });
  const desdeSucursal = (s: typeof scVillaCrespo, nombre: string) => ({
    origenTipo: "PROVEEDOR" as OrigenTipo, origenId: s.id, sucursalId: s.id, proveedorId: s.proveedorId, origenNombre: nombre, origenDireccion: `${s.direccion}, ${s.localidad}`, origenLat: s.latitud, origenLng: s.longitud,
  });
  const pedido = (d: { solicitanteId: string; tipo: TipoPedido; descripcion: string; pesoKg?: number; dia: string; hora: string; origen: Omit<Prisma.PedidoViajeUncheckedCreateInput, "solicitanteId" | "tipo" | "descripcion" | "paraCuando" | "obraId" | "destinoNombre" | "destinoDireccion" | "destinoLat" | "destinoLng">; destino: ReturnType<typeof destino>; herramientaId?: string }) =>
    db.pedidoViaje.create({
      data: {
        solicitanteId: d.solicitanteId, tipo: d.tipo, descripcion: d.descripcion, pesoKg: d.pesoKg ?? null, necesitaCamion: (d.pesoKg ?? 0) > 1000 || d.tipo === "TRASLADO_MAQUINARIA",
        paraCuando: aFecha(d.dia, d.hora), fechaNecesaria: aFecha(d.dia, "12:00"), franja: "MANANA", esRetiroMaterial: d.tipo === "RETIRO_PROVEEDOR", herramientaId: d.herramientaId ?? null,
        ...d.origen, ...d.destino,
      },
    });
  const nombreVC = "Corralón San Martín · Sucursal Villa Crespo";
  const listo = async (pm: { id: string; obraId: string | null }, descripcion: string, renglones: { descripcion: string; cantidad: number; unidad: string }[], pesoKg: number, ocNumero: string | null, pedidoViajeId: string) =>
    db.materialListo.create({
      data: {
        ordenCompraId: pm.id, obraId: pm.obraId!, proveedorId: sanMartin.id, sucursalId: scVillaCrespo.id, proveedorDireccion: `${scVillaCrespo.direccion}, ${scVillaCrespo.localidad}`,
        proveedorLat: scVillaCrespo.latitud, proveedorLng: scVillaCrespo.longitud, horarioRetiro: scVillaCrespo.horarioRetiro, contactoRetiro: scVillaCrespo.contacto, ordenCompraNumero: ocNumero,
        descripcion, renglones, pesoKg, necesitaCamion: pesoKg > 1000, estado: "RETIRO_PEDIDO", habilitadoPorId: compras.id, pedidoViajeId,
      },
    });

  const pCemento = await pedido({ solicitanteId: daniela.id, tipo: "RETIRO_PROVEEDOR", descripcion: "Cemento Portland, 40 bolsas", pesoKg: 1200, dia: hoy, hora: "08:30", origen: desdeSucursal(scVillaCrespo, nombreVC), destino: destino(darwin) });
  await listo(cementoDarwin, "Cemento Portland, 40 bolsas", [{ descripcion: "Cemento Portland Loma Negra x 50 kg", cantidad: 40, unidad: "bolsas" }], 1200, cementoDarwin.numero, pCemento.id);
  const pHierro = await pedido({ solicitanteId: cesar.id, tipo: "RETIRO_PROVEEDOR", descripcion: "Hierro del 12, 20 barras", pesoKg: 800, dia: hoy, hora: "09:00", origen: desdeSucursal(scVillaCrespo, nombreVC), destino: destino(chubut) });
  await listo(hierroChubut, "Hierro del 12, 20 barras", [{ descripcion: "Barras de hierro del 12", cantidad: 20, unidad: "barras" }], 800, "OC en papel 4512", pHierro.id);
  const pPinares = await pedido({ solicitanteId: daniela.id, tipo: "RETIRO_PROVEEDOR", descripcion: "Cemento y cal para platea, 160 bolsas", pesoKg: 4000, dia: hoy, hora: "10:00", origen: desdeSucursal(scVillaCrespo, nombreVC), destino: destino(pinares) });
  await listo(cementoPinares, "Cemento y cal para platea, 160 bolsas", [{ descripcion: "Cemento Portland x 50 kg", cantidad: 120, unidad: "bolsas" }, { descripcion: "Cal hidratada x 25 kg", cantidad: 40, unidad: "bolsas" }], 4000, "OC en papel 4518", pPinares.id);
  // La hormigonera del Terreno Humboldt a Darwin (a ~1 km del corralón).
  const pHormigonera = await pedido({
    solicitanteId: daniela.id, tipo: "TRASLADO_MAQUINARIA", descripcion: "Hormigonera 350 l", pesoKg: 400, dia: hoy, hora: "09:00", herramientaId: hormigonera.id,
    origen: { origenTipo: "DEPOSITO", origenId: humboldt.id, origenNombre: humboldt.nombre, origenDireccion: `${humboldt.direccion}, ${humboldt.localidad}`, origenLat: humboldt.latitud, origenLng: humboldt.longitud },
    destino: destino(darwin),
  });

  // ─────────────────── Viaje aceptado para pasado mañana ───────────────────
  const mercedes = await db.vehiculo.findUniqueOrThrow({ where: { patente: "HFD336" } });
  const pBayres = await pedido({
    solicitanteId: leandro.id, tipo: "LLEVAR_A_OBRA", descripcion: "Andamios y tablones (12 cuerpos)", pesoKg: 900, dia: pasadoManana, hora: "08:30",
    origen: { origenTipo: "DEPOSITO", origenId: florida.id, origenNombre: florida.nombre, origenDireccion: florida.direccion, origenLat: florida.latitud, origenLng: florida.longitud },
    destino: destino(bayres),
  });
  await db.$transaction(async (tx) => {
    await tx.pedidoViaje.update({ where: { id: pBayres.id }, data: { estado: "TOMADO", tomadoPorId: claudio.id, tomadoEn: new Date() } });
    await crearViaje(tx, { pedidoIds: [pBayres.id], vehiculoId: mercedes.id, choferId: claudio.id, salidaEstimada: aFecha(pasadoManana, "08:00"), ordenRuta: 1 });
  });

  return {
    proveedores: 3, sucursales: sanMartin.sucursales.length + hierros.sucursales.length + ferreteria.sucursales.length,
    documentosCompra: 5, ordenesCompra: [cementoDarwin.numero, ocPendiente.numero], pedidosPendientes: [pCemento.numero, pHierro.numero, pPinares.numero, pHormigonera.numero], viajePasadoManana: pBayres.numero,
  };
}
