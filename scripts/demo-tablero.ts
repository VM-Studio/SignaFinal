/**
 * ÓRDENES DE MUESTRA PARA EL TABLERO (solo en la base de desarrollo): agrega órdenes "importadas" con los
 * estados que no salen del seed (Solicitud de presupuesto, Entregado, Anulada, una con importe "A confirmar"
 * y textos largos de varias líneas), para ver el tablero como la planilla de Alejandra en las capturas.
 * Se pueden volver a cargar (borra las suyas primero) y quitar con --borrar.
 *
 *   DATABASE_URL=… npx tsx scripts/demo-tablero.ts [--borrar]
 */
import { PrismaClient, Prisma, type EstadoTablero, type EstadoOC } from "@prisma/client";

const db = new PrismaClient();
const PREFIJO = "demo_tablero_";

type Muestra = { tipo: "OC" | "PE"; n: string; estado: EstadoTablero; dias: number; entrega?: number; importe?: number; aConfirmar?: boolean; obra: number; sol: number; prov: number; detalle: string; pasos?: string; comentarios?: string };

const MUESTRAS: Muestra[] = [
  { tipo: "OC", n: "5", estado: "ENTREGADO", dias: -40, entrega: -30, importe: 723839.42, obra: 0, sol: 0, prov: 0, detalle: "16 Unidades - Protex Seal 77 Flex Impermeabilizante\n4 Unidades - Rodillo lana 22 cm", pasos: "APROBADA. LLEGÓ A OBRA EL 14/9.\nFACTURA PENDIENTE DEL PROVEEDOR." },
  { tipo: "OC", n: "14", estado: "ENTREGADO", dias: -25, aConfirmar: true, obra: 1, sol: 1, prov: 1, detalle: "1) Corte y Plegado Dº97,5 Prep. (T. x 2.44 mts)\n2) Babeta de chapa galvanizada N°24\n3) Cumbrera lisa 2 mts", comentarios: "Pagado con ECHEQ" },
  { tipo: "OC", n: "41 B", estado: "SOLICITUD_PRESUPUESTO", dias: -2, obra: 2, sol: 0, prov: 2, detalle: "35 mts - Cable tipo TPR 4x1.5mm\n12 - Cajas de paso 10x10", pasos: "Pedí presupuesto a dos casas, espero respuesta el jueves." },
  { tipo: "PE", n: "2", estado: "ANULADA", dias: -12, importe: 84402.96, obra: 0, sol: 1, prov: 0, detalle: "98 unid. - Placa Durlock Estándar (12.5mm)", comentarios: "Repetida con la OC 46 A" },
];

const ESTADO_OC: Record<EstadoTablero, EstadoOC> = { PEDIR_AUTORIZACION: "ESPERANDO_AUTORIZACION", AUTORIZADA: "AUTORIZADA", SOLICITUD_PRESUPUESTO: "EN_COMPRAS", ENCARGADO: "ENCARGADA", HABILITADA: "HABILITADA", ENTREGADO: "ENTREGADA", ANULADA: "ANULADA" };
const dia = (d: number) => new Date(Date.now() + d * 86_400_000);

(async () => {
  if (!/signa_v2_dev/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de desarrollo (signa_v2_dev).");
  const b = await db.ordenCompra.deleteMany({ where: { id: { startsWith: PREFIJO } } });
  if (process.argv.includes("--borrar")) {
    console.log(`Borradas ${b.count} órdenes de muestra.`);
    return db.$disconnect();
  }
  const [obras, sols, provs, creador] = await Promise.all([
    db.obra.findMany({ where: { estado: "ACTIVA" }, orderBy: { nombre: "asc" }, select: { id: true } }),
    db.usuario.findMany({ where: { rol: "RESPONSABLE_OBRA", activo: true }, orderBy: { nombre: "asc" }, select: { id: true } }),
    db.proveedor.findMany({ orderBy: { nombre: "asc" }, select: { id: true } }),
    db.usuario.findFirstOrThrow({ where: { rol: "COMPRAS" }, select: { id: true } }),
  ]);
  for (const [i, m] of MUESTRAS.entries()) {
    await db.ordenCompra.create({
      data: {
        id: `${PREFIJO}${i}`, tipo: m.tipo, numero: `${m.tipo}-${m.n}`, numeroTexto: m.n, fuente: "IMPORTADA",
        estado: ESTADO_OC[m.estado], estadoTablero: m.estado, estadoTableroAuto: m.estado,
        fecha: dia(m.dias), fechaNecesaria: dia(m.dias + 7), fechaEntrega: m.entrega != null ? dia(m.entrega) : null,
        obraId: obras[m.obra % obras.length]?.id, solicitanteId: sols[m.sol % sols.length]?.id, proveedorId: provs[m.prov % provs.length]?.id,
        importe: m.importe != null ? new Prisma.Decimal(m.importe) : null, importeAConfirmar: !!m.aConfirmar,
        detallePedido: m.detalle, proximosPasos: m.pasos ?? null, comentarios: m.comentarios ?? null, creadaPorId: creador.id,
      },
    });
  }
  console.log(`Cargadas ${MUESTRAS.length} órdenes de muestra (total: ${await db.ordenCompra.count()}).`);
  await db.$disconnect();
})();
