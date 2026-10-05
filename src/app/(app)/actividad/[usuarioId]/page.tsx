import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { actividad, resumenPersona } from "@/lib/actividad/consultas";
import { ROL } from "@/lib/etiquetas";
import { km } from "@/lib/formato";
import { Cifra, FilaLista, Lista, Subtitulo, Vacio } from "@/components/ui/basicos";
import { ListaActividad } from "@/components/actividad/lista";

export const metadata: Metadata = { title: "Actividad" };

/** Ficha de una persona: su mes y todo lo que hizo. */
export default async function PaginaPersona({ params, searchParams }: { params: Promise<{ usuarioId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const [{ usuarioId }, { pagina: pg }] = await Promise.all([params, searchParams]);
  const pagina = Math.max(1, Number(pg) || 1);
  const [r, a] = await Promise.all([resumenPersona(usuarioId), actividad({ persona: usuarioId, pagina })]);
  if (!r) redirect("/actividad");
  const chofer = r.usuario.rol === "CHOFER";
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/actividad" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-suave"><ArrowLeft className="size-5" /> Actividad</Link>
      <h1 className="text-2xl font-bold lg:text-3xl">{r.usuario.nombre}</h1>
      <p className="text-suave">{ROL[r.usuario.rol]}{r.usuario.telefono ? ` · ${r.usuario.telefono}` : ""}{r.usuario.activo ? "" : " · desactivado"}</p>
      <Subtitulo>Este mes</Subtitulo>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cifra etiqueta="Pedidos hechos" valor={r.pedidos} />
        <Cifra etiqueta="Viajes hechos" valor={r.viajes} detalle={chofer ? undefined : "como chofer"} />
        <Cifra etiqueta="Km recorridos" valor={km(r.km)} />
        <Cifra etiqueta="Herramientas que tiene" valor={r.herramientas.length} />
      </div>
      {r.herramientas.length > 0 && (
        <>
          <Subtitulo>Herramientas a su cargo</Subtitulo>
          <Lista>{r.herramientas.map((h) => <FilaLista key={h.id} href={`/herramientas/${h.id}`} titulo={h.nombre} detalle={`${h.codigo} · Obra ${h.obra?.nombre}`} />)}</Lista>
        </>
      )}
      <Subtitulo>Su actividad</Subtitulo>
      {a.filas.length === 0 ? <Vacio titulo="Todavía no hizo nada en el sistema" /> : <ListaActividad {...a} href={(p) => `/actividad/${usuarioId}${p > 1 ? `?pagina=${p}` : ""}`} />}
    </div>
  );
}
