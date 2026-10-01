import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { inventario } from "@/lib/datos/deposito";
import { cambiarActivoItem } from "@/lib/acciones/deposito";
import { Dato, Subtitulo, Tarjeta, Vacio } from "@/components/ui/basicos";
import { Estado } from "@/components/ui/estado";
import { AccionesItem } from "@/components/deposito/acciones-item";
import { BotonActivo } from "@/components/flota/boton-activo";
import { CATEGORIA_ITEM, ESTADO_ITEM, TIPO_MOVIMIENTO } from "@/lib/etiquetas";
import { cuando, hace } from "@/lib/formato";

export const metadata: Metadata = { title: "Depósito" };

export default async function PaginaItem({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario("deposito.ver");
  const { id } = await params;
  const item = await db.item.findUnique({ where: { id } });
  if (!item) notFound();
  const [[info], movimientos, obras, personas] = await Promise.all([
    inventario({ q: item.codigo }).then((l) => l.filter((x) => x.id === id)),
    db.movimientoItem.findMany({
      where: { itemId: id },
      orderBy: { fecha: "desc" },
      take: 30,
      include: { desdeObra: { select: { nombre: true } }, haciaObra: { select: { nombre: true } }, recibidoPor: { select: { nombre: true } }, registradoPor: { select: { nombre: true } } },
    }),
    db.obra.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.usuario.findMany({ where: { activo: true, rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ", "CHOFER"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  const mover = puede(u.rol, "deposito.mover");
  const editar = puede(u.rol, "deposito.editar");

  return (
    <div className="mx-auto grid max-w-5xl gap-x-6 gap-y-4 lg:grid-cols-[1fr_380px]">
      <header className="lg:col-start-1">
        <Link href="/deposito" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-suave">
          <ArrowLeft className="size-5" /> Depósito
        </Link>
        <p className="text-sm font-semibold uppercase tracking-wider text-suave">{CATEGORIA_ITEM[item.categoria]}</p>
        <h1 className="text-3xl font-bold tracking-tight">{item.nombre}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Estado tono={ESTADO_ITEM[item.estado].tono}>{ESTADO_ITEM[item.estado].texto}</Estado>
          {!item.activo && <Estado tono="neutro">Dado de baja</Estado>}
        </div>
      </header>

      <aside className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-suave">Dónde está</p>
          {item.control === "UNITARIA" ? (
            <p className="mt-1 text-xl font-bold">
              {info?.enObras[0] ? `Obra ${info.enObras[0].obra}` : "En el depósito"}
              {info?.tenedor && <span className="block text-base font-medium text-suave">La tiene {info.tenedor} · {hace(item.ubicadoDesde)}</span>}
            </p>
          ) : (
            <ul className="mt-1">
              <li className="flex justify-between py-1 font-bold"><span>Depósito</span><span>{info?.enDeposito ?? 0} {item.unidad}</span></li>
              {info?.enObras.map((o) => (
                <li key={o.obraId} className="flex justify-between border-t border-linea py-1"><span>Obra {o.obra}</span><span>{o.cantidad}</span></li>
              ))}
            </ul>
          )}
        </Tarjeta>
        {mover && item.activo && info && (
          <AccionesItem
            itemId={item.id} nombre={item.nombre} control={item.control} unidad={item.unidad} estado={item.estado}
            enDeposito={info.enDeposito} enObras={info.enObras} obras={obras} personas={personas} puedeEditar={editar}
          />
        )}
        {editar && (
          <Tarjeta className="flex items-center gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${item.codigo}`} alt="Código QR" className="size-28" />
            <div>
              <p className="font-semibold">Etiqueta QR</p>
              <p className="text-sm text-suave">Imprimila y pegala en la máquina.</p>
              <a href={`/api/qr/${item.codigo}`} download={`${item.nombre}.svg`} className="text-sm font-semibold underline">Descargar</a>
            </div>
          </Tarjeta>
        )}
      </aside>

      <div className="min-w-0 lg:col-start-1">
        <Tarjeta className="p-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dato etiqueta="Marca">{item.marca ?? "—"}</Dato>
            <Dato etiqueta="Modelo">{item.modelo ?? "—"}</Dato>
            {item.numeroSerie && <Dato etiqueta="N.º de serie">{item.numeroSerie}</Dato>}
          </dl>
          {item.notas && <p className="mt-3 text-suave">{item.notas}</p>}
        </Tarjeta>
        <Subtitulo>Movimientos</Subtitulo>
        {movimientos.length === 0 ? (
          <Vacio titulo="Sin movimientos" />
        ) : (
          <ol className="relative ml-2 border-l-2 border-linea pl-5">
            {movimientos.map((m) => (
              <li key={m.id} className="relative pb-4 last:pb-0">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-negro bg-papel" />
                <p className="font-medium">
                  {TIPO_MOVIMIENTO[m.tipo]}
                  {item.control === "CANTIDAD" && ` · ${m.cantidad}`}
                  {m.tipo !== "ALTA" && m.tipo !== "AJUSTE" && `: ${m.desdeObra ? `Obra ${m.desdeObra.nombre}` : "Depósito"} → ${m.haciaObra ? `Obra ${m.haciaObra.nombre}` : "Depósito"}`}
                </p>
                <p className="text-sm text-suave">
                  {cuando(m.fecha)} · registró {m.registradoPor.nombre}
                  {m.recibidoPor && ` · recibió ${m.recibidoPor.nombre}`}
                </p>
                {m.observaciones && <p className="text-sm">{m.observaciones}</p>}
              </li>
            ))}
          </ol>
        )}
        {editar && (
          <div className="mt-8 border-t border-linea pt-4">
            <BotonActivo activo={item.activo} nombre={item.nombre} accion={cambiarActivoItem.bind(null, item.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
