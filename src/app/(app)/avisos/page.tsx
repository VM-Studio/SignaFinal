import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { misAvisos } from "@/lib/avisos/consultas";
import { exigirSesion } from "@/lib/auth/sesion";
import { rutaPermitida } from "@/lib/permisos";
import { limiteDe } from "@/lib/pagina";
import { CargarMas } from "@/components/ui/cargar-mas";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonMarcarTodas, ItemAviso } from "@/components/avisos/item-aviso";
import { cuando } from "@/lib/formato";

export const metadata: Metadata = { title: "Avisos" };

/** Cada uno ve solo lo suyo: sus avisos personales y las alertas que lo tienen como destinatario. */
export default async function PaginaAvisos({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const u = await exigirSesion();
  const { limite, siguiente } = await limiteDe((await searchParams).n);
  const { notificaciones: todasNotif, alertas: todas } = await misAvisos(limite);
  const hayMas = todasNotif.length > limite;
  const notificaciones = todasNotif.slice(0, limite);
  // Una sola bandeja para quien no tiene /alertas (obra, chofer, depósito): sus alertas, arriba.
  const alertas = rutaPermitida(u.rol, "/alertas") ? [] : todas;
  const sinLeer = notificaciones.filter((n) => !n.leidaEn).length;
  const item = "block rounded-[var(--radius-caja)] border border-linea bg-papel p-4";
  return (
    <div className="mx-auto max-w-2xl">
      <Titulo accion={<BotonMarcarTodas hay={sinLeer} />}>Avisos</Titulo>
      {notificaciones.length + alertas.length === 0 ? (
        <Vacio icono={<Bell className="size-10" />} titulo="No tenés avisos">Cuando pase algo con tus pedidos o tus cosas, te avisamos acá.</Vacio>
      ) : (
        <>
          {alertas.length > 0 && (
            <>
              <Subtitulo>Alertas</Subtitulo>
              <ul className="flex flex-col gap-2">
                {alertas.map((a) => {
                  const contenido = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{a.titulo}</p>
                        <Insignia tono={a.severidad === "CRITICA" ? "critico" : "aviso"}>{a.severidad === "CRITICA" ? "Crítica" : "Aviso"}</Insignia>
                      </div>
                      <p className="mt-1 text-[15px] text-suave">{a.detalle}</p>
                    </>
                  );
                  return <li key={a.id}>{a.enlace ? <Link href={a.enlace} className={`${item} hover:bg-fondo/60`}>{contenido}</Link> : <div className={item}>{contenido}</div>}</li>;
                })}
              </ul>
            </>
          )}
          {notificaciones.length > 0 && (
            <>
              <Subtitulo>{sinLeer ? `Novedades · ${sinLeer} sin leer` : "Novedades"}</Subtitulo>
              <ul className="flex flex-col gap-2">
                {notificaciones.map((n) => (
                  <li key={n.id}>
                    <ItemAviso id={n.id} enlace={n.enlace} leida={!!n.leidaEn}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{n.titulo}</p>
                        {!n.leidaEn && <Insignia tono="activo">Nuevo</Insignia>}
                      </div>
                      <p className="mt-1 text-[15px]">{n.cuerpo}</p>
                      <p className="mt-1 text-sm text-suave">{cuando(n.creadaEn)}</p>
                    </ItemAviso>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {hayMas && <CargarMas href={`/avisos?n=${siguiente}`} />}
    </div>
  );
}
