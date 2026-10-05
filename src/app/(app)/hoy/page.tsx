import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListOrdered, Route } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { misViajes } from "@/lib/viajes/consultas";
import { BotonLink } from "@/components/ui/boton";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { TarjetaViaje } from "@/components/viajes/tarjeta-viaje";

export const metadata: Metadata = { title: "Hoy" };

/** El día del chofer: lo que está en curso, después los aceptados en orden de salida. */
export default async function PaginaHoy() {
  const u = await exigirSesion();
  if (!puede(u.rol, "viajes.verPropios")) redirect(puede(u.rol, "viajes.verTodos") ? "/viajes" : "/inicio");
  const viajes = await misViajes();
  const enCurso = viajes.find((v) => v.estado === "EN_CURSO");
  const grupos = [
    { titulo: "En curso", lista: viajes.filter((v) => v.estado === "EN_CURSO") },
    { titulo: "Aceptados", lista: viajes.filter((v) => v.estado === "PROGRAMADO") },
    { titulo: "Terminados hoy", lista: viajes.filter((v) => v.estado === "FINALIZADO") },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <Titulo detalle="Primero el que está en curso, después los aceptados en orden de salida.">Hoy</Titulo>
      {viajes.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo="No tenés viajes para hoy" accion={<BotonLink href="/solicitudes" icono={<ListOrdered className="size-5" />}>Ver solicitudes</BotonLink>}>
          Aceptá una solicitud y aparece acá.
        </Vacio>
      ) : (
        grupos.map((g) =>
          g.lista.length ? (
            <section key={g.titulo}>
              <Subtitulo>{g.titulo}</Subtitulo>
              <ul className="flex flex-col gap-3">
                {g.lista.map((v) => (
                  <TarjetaViaje key={v.viajeId} v={v} puedeIniciar={!enCurso} bloqueadoPor={enCurso?.pedidoId} />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}
