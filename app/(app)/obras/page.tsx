import Link from "next/link";
import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { Tabla, Titulo } from "@/components/ui/basicos";
import { hace } from "@/lib/formato";
import { BotonSincronizar } from "./sincronizar";

export const metadata: Metadata = { title: "Obras" };

export default async function PaginaObras() {
  const u = await requerirUsuario("obras.ver");
  const obras = await db.obra.findMany({
    where: { activa: true, ...(u.rol === "RESPONSABLE_OBRA" ? { responsables: { some: { id: u.id } } } : {}) },
    orderBy: { nombre: "asc" },
    include: {
      responsables: { select: { nombre: true } },
      _count: { select: { pedidos: { where: { estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } } }, itemsEnObra: true } },
    },
  });
  const ultima = obras.reduce<Date | null>((a, o) => (!a || o.sincronizadaEn > a ? o.sincronizadaEn : a), null);

  return (
    <div>
      <Titulo
        detalle={`Vienen de Lebane${ultima ? ` · actualizado ${hace(ultima)}` : ""}. No se editan acá.`}
        accion={puede(u.rol, "obras.sincronizar") ? <BotonSincronizar /> : undefined}
      >
        {u.rol === "RESPONSABLE_OBRA" ? "Mis obras" : "Obras"}
      </Titulo>
      <Tabla>
        <thead>
          <tr>
            <th>Obra</th>
            <th className="hidden sm:table-cell">Dirección</th>
            <th className="hidden lg:table-cell">Responsables</th>
            <th className="text-right">Viajes en curso</th>
            <th className="hidden text-right sm:table-cell">Máquinas</th>
          </tr>
        </thead>
        <tbody>
          {obras.map((o) => (
            <tr key={o.id}>
              <td className="font-semibold"><Link href={`/obras/${o.id}`} className="hover:underline">Obra {o.nombre}</Link></td>
              <td className="hidden text-suave sm:table-cell">{[o.direccion, o.localidad].filter(Boolean).join(", ")}</td>
              <td className="hidden lg:table-cell">{o.responsables.map((r) => r.nombre).join(", ") || "—"}</td>
              <td className="text-right tabular-nums">{o._count.pedidos}</td>
              <td className="hidden text-right tabular-nums sm:table-cell">{o._count.itemsEnObra}</td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  );
}
