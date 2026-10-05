import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { misAvisos } from "@/lib/avisos/consultas";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { MarcarLeidos } from "@/components/avisos/marcar-leidos";
import { cuando } from "@/lib/formato";

export const metadata: Metadata = { title: "Avisos" };

/** Cada uno ve solo lo suyo: sus avisos personales y las alertas que lo tienen como destinatario. */
export default async function PaginaAvisos() {
  const { notificaciones, alertas } = await misAvisos();
  const sinLeer = notificaciones.filter((n) => !n.leidaEn).length;
  const item = "block rounded-[var(--radius-caja)] border border-linea bg-papel p-4";
  return (
    <div className="mx-auto max-w-2xl">
      <MarcarLeidos hay={sinLeer > 0} />
      <Titulo>Avisos</Titulo>
      {notificaciones.length + alertas.length === 0 ? (
        <Vacio icono={<Bell className="size-10" />} titulo="No tenés avisos">Cuando pase algo con tus pedidos o tus cosas, te avisamos acá.</Vacio>
      ) : (
        <>
          {alertas.length > 0 && (
            <>
              <Subtitulo>Para resolver</Subtitulo>
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
              <Subtitulo>Novedades</Subtitulo>
              <ul className="flex flex-col gap-2">
                {notificaciones.map((n) => {
                  const contenido = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{n.titulo}</p>
                        {!n.leidaEn && <Insignia tono="activo">Nuevo</Insignia>}
                      </div>
                      <p className="mt-1 text-[15px]">{n.cuerpo}</p>
                      <p className="mt-1 text-sm text-suave">{cuando(n.creadaEn)}</p>
                    </>
                  );
                  return <li key={n.id}>{n.enlace ? <Link href={n.enlace} className={`${item} hover:bg-fondo/60`}>{contenido}</Link> : <div className={item}>{contenido}</div>}</li>;
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
