import Link from "next/link";
import type { Metadata } from "next";
import { Building2, ChevronRight } from "lucide-react";
import { listaObras } from "@/lib/obras/consultas";
import { Insignia, Titulo, Vacio } from "@/components/ui/basicos";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { NuevaObra } from "@/components/obras/formulario-obra";

export const metadata: Metadata = { title: "Obras" };

/** Mis obras: nombre, dirección y dos números (pedidos activos y herramientas en la obra). */
export default async function PaginaObras() {
  const [obras, u] = await Promise.all([listaObras(), exigirSesion()]);
  const carga = puede(u.rol, "obras.cargar");
  const responsables = carga ? await db.usuario.findMany({ where: { rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ"] }, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }) : [];
  return (
    <div>
      <Titulo siempre={carga} accion={carga ? <NuevaObra responsables={responsables} /> : undefined}>Obras</Titulo>
      {obras.length === 0 ? (
        carga
          ? <Vacio icono={<Building2 className="size-10" />} titulo="Todavía no hay obras">Cargá la primera con “Nueva obra”. Después, en Usuarios, se le asignan más responsables.</Vacio>
          : <Vacio icono={<Building2 className="size-10" />} titulo="No tenés obras asignadas">Pedile a la oficina que te asigne tus obras.</Vacio>
      ) : (
        <>
          {/* Celular: filas */}
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {obras.map((o) => (
              <li key={o.id}>
                <Link href={`/obras/${o.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-hover">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Obra {o.nombre}</p>
                    <p className="truncate text-sm text-suave">{o.direccion}</p>
                    <p className="text-sm text-suave tabular-nums">{o.pedidosActivos} {o.pedidosActivos === 1 ? "pedido activo" : "pedidos activos"} · {o.herramientas} {o.herramientas === 1 ? "herramienta" : "herramientas"}</p>
                  </div>
                  {o.estado !== "ACTIVA" ? <Insignia tono="aviso">Pausada</Insignia> : <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />}
                </Link>
              </li>
            ))}
          </ul>
          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla">
              <thead>
                <tr><th>Obra</th><th>Localidad</th><th>Dirección</th><th>Estado</th><th className="num">Pedidos activos</th><th className="num">Herramientas</th></tr>
              </thead>
              <tbody>
                {obras.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium"><Link href={`/obras/${o.id}`} className="hover:underline">Obra {o.nombre}</Link></td>
                    <td>{o.localidad}</td>
                    <td className="text-suave">{o.calle}</td>
                    <td>{o.estado !== "ACTIVA" ? <Insignia tono="aviso">Pausada</Insignia> : <Insignia tono="ok">Activa</Insignia>}</td>
                    <td className="num">{o.pedidosActivos}</td>
                    <td className="num">{o.herramientas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
