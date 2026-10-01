import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Cliente = Prisma.TransactionClient | typeof db;

export async function auditar(
  cliente: Cliente,
  datos: { usuarioId: string | null; accion: string; entidad: string; entidadId: string; detalle?: Prisma.InputJsonValue },
) {
  await cliente.auditoria.create({ data: datos });
}
