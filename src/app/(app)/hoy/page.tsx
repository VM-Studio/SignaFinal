import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListOrdered, Route } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { viajesDelChofer, type Tarjeta } from "@/lib/viajes/chofer";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { Buscador } from "@/components/ui/campos";
import { Pestanas, Subtitulo, Vacio } from "@/components/ui/basicos";
import { TarjetaChofer } from "@/components/viajes/tarjeta-chofer";
import { BotonEtapa } from "@/components/viajes/acciones-viaje";
import { diaISO } from "@/lib/formato";
import { ddmm, diaSemana, diasEntre } from "@/lib/viajes/fecha";

export const metadata: Metadata = { title: "Hoy" };

type Vista = "hoy" | "proximos" | "todos";

/** El día del chofer. Arriba: Hoy · Próximos · Todos. */
export default async function PaginaHoy({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string; pagina?: string }> }) {
  const u = await exigirSesion();
  if (!puede(u.rol, "viajes.verPropios")) redirect(puede(u.rol, "viajes.verTodos") ? "/viajes" : "/inicio");
  const sp = await searchParams;
  const vista: Vista = sp.vista === "proximos" || sp.vista === "todos" ? sp.vista : "hoy";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const { tarjetas, total, paginas } = await viajesDelChofer(vista, { q: sp.q, pagina });

  return (
    <div>
      <Pestanas items={[
        { href: "/hoy", etiqueta: "Hoy", activa: vista === "hoy" },
        { href: "/hoy?vista=proximos", etiqueta: "Próximos", activa: vista === "proximos" },
        { href: "/hoy?vista=todos", etiqueta: "Todos", activa: vista === "todos" },
      ]} />
      {vista === "hoy" && <Hoy tarjetas={tarjetas} />}
      {vista === "proximos" && <Proximos tarjetas={tarjetas} />}
      {vista === "todos" && (
        <>
          <div className="mb-3"><Buscador accion="/hoy" valor={sp.q} placeholder="Buscar por obra" ocultos={{ vista: "todos" }} /></div>
          {tarjetas.length === 0 ? (
            <Vacio icono={<Route className="size-10" />} titulo={sp.q ? `Nada para "${sp.q}"` : "Todavía no hiciste viajes"} />
          ) : (
            <>
              <ul className="flex flex-col gap-3">{tarjetas.map((t) => <TarjetaChofer key={t.pedidoId} t={t} href={`/viaje/${t.pedidoId}`} />)}</ul>
              <div className="mt-4 flex items-center justify-between gap-3">
                {pagina > 1 ? <Link href={`/hoy?vista=todos&pagina=${pagina - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} className={claseBoton("secundario")}>Más nuevos</Link> : <span />}
                <span className="text-sm text-suave">{total} viajes · página {pagina} de {paginas}</span>
                {pagina < paginas ? <Link href={`/hoy?vista=todos&pagina=${pagina + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} className={claseBoton("secundario")}>Más viejos</Link> : <span />}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Hoy({ tarjetas }: { tarjetas: Tarjeta[] }) {
  if (tarjetas.length === 0) {
    return (
      <Vacio icono={<Route className="size-10" />} titulo="No tenés viajes para hoy" accion={<BotonLink href="/solicitudes" icono={<ListOrdered />}>Ver solicitudes</BotonLink>}>
        Aceptá una solicitud y aparece acá.
      </Vacio>
    );
  }
  const enCurso = tarjetas.find((t) => t.etapa && ETAPAS_EN_CURSO.includes(t.etapa));
  // El botón de lo que sigue va en una sola tarjeta: la que está en curso, o si no, la próxima en salir.
  const conBoton = enCurso ?? tarjetas[0];
  return (
    <ul className="flex flex-col gap-3">
      {tarjetas.map((t) => (
        <TarjetaChofer
          key={t.pedidoId}
          t={t}
          href={`/viaje/${t.pedidoId}`}
          destacada={t === conBoton}
          accion={t === conBoton && t.etapa ? (
            <BotonEtapa etapa={t.etapa} pedidoId={t.pedidoId} numero={t.numero} vehiculo={t.vehiculo ?? ""} kmActual={t.kmActual} kmSalida={t.kmSalida} obra={t.entregar.nombre} paraCuando={t.fecha} irAlViaje />
          ) : undefined}
        />
      ))}
    </ul>
  );
}

function Proximos({ tarjetas }: { tarjetas: Tarjeta[] }) {
  if (tarjetas.length === 0) return <Vacio icono={<Route className="size-10" />} titulo="No tenés viajes aceptados para los próximos días" />;
  const dias = [...new Set(tarjetas.map((t) => diaISO(t.fecha)))];
  return (
    <>
      {dias.map((d) => {
        const delDia = tarjetas.filter((t) => diaISO(t.fecha) === d);
        return (
          <section key={d}>
            <Subtitulo>{tituloDia(delDia[0].fecha)}</Subtitulo>
            <ul className="flex flex-col gap-3">{delDia.map((t) => <TarjetaChofer key={t.pedidoId} t={t} href={`/viaje/${t.pedidoId}`} />)}</ul>
          </section>
        );
      })}
    </>
  );
}

/** "Mañana · sábado 11/10", "Lunes 13/10". */
function tituloDia(f: Date) {
  const t = `${diaSemana(f)} ${ddmm(f)}`;
  return diasEntre(f) === 1 ? `Mañana · ${t}` : `${t[0].toUpperCase()}${t.slice(1)}`;
}
