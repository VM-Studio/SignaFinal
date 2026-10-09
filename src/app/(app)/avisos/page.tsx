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
import { cuando, dia, hace } from "@/lib/formato";
import { ICONO_AVISO } from "@/components/avisos/iconos";

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
  // No leídos arriba; después, lo leído agrupado por día ("Hoy", "Ayer", "jue 8 oct").
  const grupos: { titulo: string; items: typeof notificaciones }[] = [];
  if (sinLeer) grupos.push({ titulo: `Sin leer · ${sinLeer}`, items: notificaciones.filter((n) => !n.leidaEn) });
  for (const n of notificaciones.filter((x) => x.leidaEn)) {
    const t = dia(n.creadaEn);
    const titulo = t === "hoy" ? "Hoy" : t === "ayer" ? "Ayer" : t;
    const g = grupos.find((x) => x.titulo === titulo);
    if (g) g.items.push(n);
    else grupos.push({ titulo, items: [n] });
  }
  const item = "block rounded-[var(--radius-caja)] border border-linea bg-papel p-4";
  return (
    <div className="mx-auto max-w-2xl">
      <Titulo siempre accion={<BotonMarcarTodas hay={sinLeer} />}>Avisos</Titulo>
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
          {notificaciones.length > 0 && grupos.map((g) => (
            <section key={g.titulo}>
              <Subtitulo>{g.titulo}</Subtitulo>
              <ul className="flex flex-col gap-2">
                {g.items.map((n) => {
                  const Icono = ICONO_AVISO[n.tipo];
                  return (
                    <li key={n.id}>
                      <ItemAviso id={n.id} enlace={n.enlace} leida={!!n.leidaEn}>
                        <div className="flex items-start gap-3">
                          <Icono aria-hidden className={`mt-0.5 size-5 shrink-0 ${n.leidaEn ? "text-apagado" : ""}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold">{n.titulo}</p>
                              {!n.leidaEn && <Insignia tono="activo">Nuevo</Insignia>}
                            </div>
                            <p className="mt-1 text-[15px]">{n.cuerpo}</p>
                            <p className="mt-1 text-sm text-suave" title={cuando(n.creadaEn)}>{hace(n.creadaEn)}</p>
                          </div>
                        </div>
                      </ItemAviso>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
      {hayMas && <CargarMas href={`/avisos?n=${siguiente}`} />}
    </div>
  );
}
