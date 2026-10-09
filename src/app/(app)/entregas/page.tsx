import Link from "next/link";
import type { Metadata } from "next";
import { PackageCheck, ScanLine } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { movimientosDeHoy, paraEntregar } from "@/lib/herramientas/consultas";
import { MOVIMIENTO } from "@/lib/herramientas/presentacion";
import { textoEstado, textoParaCuando } from "@/lib/pedidos/presentacion";
import { BotonLink } from "@/components/ui/boton";
import { FilaLista, Insignia, Lista, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { hora } from "@/lib/formato";
import { limiteDe } from "@/lib/pagina";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Entregas" };

export default async function PaginaEntregas({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  await exigirPermiso("herramientas.mover");
  const { limite, siguiente } = await limiteDe((await searchParams).n);
  const [todos, hoy] = await Promise.all([paraEntregar(limite), movimientosDeHoy()]);
  const pendientes = todos.slice(0, limite);
  return (
    <div>
      <Titulo siempre detalle="Lo que pidieron las obras y lo que se movió hoy." accion={<BotonLink href="/herramientas/escanear" icono={<ScanLine />}>Escanear</BotonLink>}>Entregas</Titulo>
      <Subtitulo>Para entregar</Subtitulo>
      {pendientes.length === 0 ? (
        <Vacio icono={<PackageCheck className="size-8" />} titulo="Nada pedido por ahora">Cuando una obra pida una máquina o herramienta, aparece acá.</Vacio>
      ) : (
        <Lista>
          {pendientes.map((p) => {
            const e = textoEstado({ estado: p.estado, chofer: p.tomadoPor?.nombre });
            return (
              <FilaLista
                key={p.id}
                href={`/herramientas/${p.herramienta!.id}?accion=entregar`}
                titulo={`${p.herramienta!.nombre} → Obra ${p.obra.nombre}`}
                detalle={`${p.herramienta!.codigo} · para ${textoParaCuando(p.paraCuando, p.franja)} · pidió ${p.solicitante.nombre}`}
                derecha={<div className="flex flex-col items-end gap-1"><Insignia tono={e.tono}>{p.estado === "PENDIENTE" ? "Sin chofer" : e.texto}</Insignia>{p.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}</div>}
              />
            );
          })}
        </Lista>
      )}
      {todos.length > limite && <CargarMas href={`/entregas?n=${siguiente}`} />}
      <Subtitulo>Movimientos de hoy</Subtitulo>
      {hoy.length === 0 ? (
        <Vacio titulo="Todavía no se movió nada hoy" />
      ) : (
        <Lista>
          {hoy.map((m) => (
            <li key={m.id}>
              <Link href={`/herramientas/${m.herramienta.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11 hover:bg-hover">
                <span className="w-12 shrink-0 font-semibold tabular-nums">{hora(m.fecha)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.herramienta.nombre}{m.cantidad > 1 ? ` × ${m.cantidad}` : ""}</span>
                  <span className="block truncate text-sm text-suave">
                    {MOVIMIENTO[m.tipo]}{m.haciaObra ? ` a Obra ${m.haciaObra.nombre}` : m.desdeObra ? ` desde Obra ${m.desdeObra.nombre}` : ""}{m.recibidoPor ? ` · ${m.recibidoPor.nombre}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Lista>
      )}
    </div>
  );
}
