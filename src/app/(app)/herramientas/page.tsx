import Link from "next/link";
import type { Metadata } from "next";
import { Plus, QrCode, ScanLine, Upload, Wrench } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { cifras, listar, opciones, PESTANAS, sobrantes, type Pestana } from "@/lib/herramientas/consultas";
import { ESTADO } from "@/lib/herramientas/presentacion";
import { Buscador } from "@/components/ui/campos";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, Insignia, Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { ConHoja } from "@/components/ui/hoja";
import { FormularioHerramienta } from "@/components/herramientas/formulario";
import { Sobrantes } from "@/components/herramientas/sobrantes";
import { FiltroUbicacion } from "@/components/herramientas/filtro";
import { vencimiento } from "@/lib/formato";
import { VistaObra } from "@/components/herramientas/vista-obra";

export const metadata: Metadata = { title: "Herramientas" };

type P = { tab?: string; q?: string; donde?: string; vista?: string };

export default async function PaginaHerramientas({ searchParams }: { searchParams: Promise<P> }) {
  const u = await exigirPermiso("herramientas.ver");
  const sp = await searchParams;
  // Gente de obra (y Dirección, salvo que pida la vista del depósito): la versión para pedir.
  const deObra = u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ" || (u.rol === "DIRECCION" && sp.vista !== "deposito" && !sp.tab);
  if (deObra) return <VistaObra u={u} vista={sp.vista === "todas" ? "todas" : "disponibles"} q={sp.q} />;
  const tab: Pestana = sp.tab && sp.tab in PESTANAS ? (sp.tab as Pestana) : "maquinaria";
  const [c, ops] = await Promise.all([cifras(), opciones()]);
  const qs = (extra: Partial<P>) => {
    const p = new URLSearchParams(Object.entries({ tab, q: sp.q, donde: sp.donde, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/herramientas?${p.toString()}`;
  };

  return (
    <div>
      <Titulo
        detalle="Maquinaria y herramientas: en el depósito o en una obra, nunca en otro lado."
        accion={
          <div className="flex flex-wrap gap-2">
            {puede(u.rol, "herramientas.mover") && <BotonLink href="/herramientas/escanear" icono={<ScanLine className="size-5" />}>Escanear</BotonLink>}
            {puede(u.rol, "herramientas.editar") && (
              <>
                <BotonLink href="/herramientas/etiquetas" variante="secundario" icono={<QrCode className="size-5" />}>Etiquetas</BotonLink>
                <BotonLink href="/herramientas/importar" variante="secundario" icono={<Upload className="size-5" />}>Importar CSV</BotonLink>
                <ConHoja titulo="Nueva herramienta" etiqueta="Agregar" variante="secundario" icono={<Plus className="size-5" />}>
                  <FormularioHerramienta categorias={ops.categorias.map((x) => x.nombre)} />
                </ConHoja>
              </>
            )}
          </div>
        }
      >
        Herramientas
      </Titulo>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Link href={qs({ donde: "deposito" })}><Cifra etiqueta="En depósito" valor={c.deposito} tono="ok" /></Link>
        <Cifra etiqueta="En obras" valor={c.obras} />
        <Cifra etiqueta="En reparación" valor={c.reparacion} tono={c.reparacion ? "aviso" : undefined} />
        <Cifra etiqueta="Devoluciones vencidas" valor={c.vencidas} tono={c.vencidas ? "critico" : "ok"} />
      </div>

      <Pestanas items={(Object.keys(PESTANAS) as Pestana[]).map((k) => ({ href: qs({ tab: k }), etiqueta: PESTANAS[k], activa: k === tab }))} />

      {tab === "sobrantes" ? (
        <Sobrantes lista={await sobrantes()} obras={ops.obras} editar={puede(u.rol, "sobrantes.editar")} />
      ) : (
        <Lista tab={tab} q={sp.q} donde={sp.donde} obras={ops.obras} qs={qs} />
      )}
    </div>
  );
}

async function Lista({ tab, q, donde, obras, qs }: { tab: Exclude<Pestana, "sobrantes">; q?: string; donde?: string; obras: { id: string; nombre: string }[]; qs: (e: Partial<P>) => string }) {
  const filas = await listar({ tab, q, ubicacion: donde });
  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_16rem]">
        <Buscador accion="/herramientas" valor={q} placeholder="Buscar por nombre o código (SIG-0001)" ocultos={{ tab, donde }} />
        <FiltroUbicacion valor={donde ?? ""} obras={obras} base={qs({ donde: undefined })} />
      </div>
      {filas.length === 0 ? (
        <Vacio icono={<Wrench className="size-10" />} titulo="No se encontró nada">{q || donde ? "Probá con otra búsqueda u otra ubicación." : undefined}</Vacio>
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {filas.map((h) => (
              <li key={h.id}>
                <Link href={`/herramientas/${h.id}`} className={`block rounded-[var(--radius-caja)] border bg-papel p-4 ${h.vencida ? "border-2 border-critico" : "border-linea"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{h.nombre}</p>
                      <p className="text-sm text-suave tabular-nums">{h.codigo} · {h.categoria}</p>
                    </div>
                    {h.tipoControl === "UNITARIA" ? <Insignia tono={h.vencida ? "critico" : ESTADO[h.estado].tono}>{h.vencida ? "Devolución vencida" : ESTADO[h.estado].texto}</Insignia> : <span className="text-lg font-bold tabular-nums">{h.total}</span>}
                  </div>
                  <p className="mt-2 text-[15px]">{h.donde}{h.quien ? ` · la tiene ${h.quien}` : ""}</p>
                  {h.vencida && h.devolucionPrevista && <p className="text-sm font-semibold text-critico">{vencimiento(h.devolucionPrevista).texto.replace("Vencido", "Debía volver")}</p>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-linea text-xs tracking-wider text-suave uppercase">
                <tr className="[&>th]:px-4 [&>th]:py-3"><th>Nombre</th><th>Código</th><th>Dónde está</th><th>Quién la tiene</th><th>Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {filas.map((h) => (
                  <tr key={h.id} className={`hover:bg-fondo/60 [&>td]:px-4 [&>td]:py-3 ${h.vencida ? "bg-critico-fondo/50" : ""}`}>
                    <td className="font-semibold"><Link href={`/herramientas/${h.id}`} className="hover:underline">{h.nombre}</Link><span className="block text-xs font-normal text-suave">{h.categoria}</span></td>
                    <td className="tabular-nums">{h.codigo}</td>
                    <td>{h.donde}</td>
                    <td>{h.quien ?? <span className="text-suave">—</span>}</td>
                    <td>
                      {h.tipoControl === "CANTIDAD" ? (
                        <span className="font-semibold tabular-nums">{h.total} en total</span>
                      ) : h.vencida && h.devolucionPrevista ? (
                        <Insignia tono="critico">{vencimiento(h.devolucionPrevista).texto.replace("Vencido", "Devolución vencida")}</Insignia>
                      ) : (
                        <Insignia tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Insignia>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
