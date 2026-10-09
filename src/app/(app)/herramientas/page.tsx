import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus, Upload, Wrench } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { cifras, listar, opciones, PESTANAS, type Pestana } from "@/lib/herramientas/consultas";
import { ESTADO } from "@/lib/herramientas/presentacion";
import { Buscador } from "@/components/ui/campos";
import { BotonLink } from "@/components/ui/boton";
import { Cifra, Insignia, Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { ConHoja } from "@/components/ui/hoja";
import { FormularioHerramienta } from "@/components/herramientas/formulario";
import { FiltroUbicacion } from "@/components/herramientas/filtro";
import { vencimiento } from "@/lib/formato";
import { VistaObra } from "@/components/herramientas/vista-obra";
import { limiteDe } from "@/lib/pagina";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Depósito" };

type P = { tab?: string; q?: string; donde?: string; vista?: string; n?: string };

export default async function PaginaHerramientas({ searchParams }: { searchParams: Promise<P> }) {
  const u = await exigirPermiso("herramientas.ver");
  const sp = await searchParams;
  // Gente de obra: la versión para pedir. Los demás: el depósito.
  const deObra = u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ";
  if (deObra) return <VistaObra u={u} vista={sp.vista === "todas" ? "todas" : "disponibles"} q={sp.q} n={sp.n} />;
  if (sp.tab === "sobrantes") redirect("/sobrantes");
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
            {puede(u.rol, "herramientas.editar") && (
              <>
                <BotonLink href="/herramientas/importar" variante="secundario" icono={<Upload />}>Importar CSV</BotonLink>
                <ConHoja titulo="Nueva herramienta" etiqueta="Agregar" icono={<Plus />}>
                  <FormularioHerramienta categorias={ops.categorias.map((x) => x.nombre)} />
                </ConHoja>
              </>
            )}
          </div>
        }
      >
        Depósito
      </Titulo>

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <Link href={qs({ donde: "deposito" })}><Cifra etiqueta="En depósito" valor={c.deposito} tono="ok" /></Link>
        <Cifra etiqueta="En obras" valor={c.obras} />
        <Cifra etiqueta="En reparación" valor={c.reparacion} tono={c.reparacion ? "aviso" : undefined} />
        <Cifra etiqueta="Devoluciones vencidas" valor={c.vencidas} tono={c.vencidas ? "critico" : "ok"} />
      </div>

      <Pestanas items={(Object.keys(PESTANAS) as Pestana[]).map((k) => ({ href: qs({ tab: k }), etiqueta: PESTANAS[k], activa: k === tab }))} />

      <Lista tab={tab} q={sp.q} donde={sp.donde} n={sp.n} obras={ops.obras} qs={qs} />
    </div>
  );
}

async function Lista({ tab, q, donde, n, obras, qs }: { tab: Pestana; q?: string; donde?: string; n?: string; obras: { id: string; nombre: string }[]; qs: (e: Partial<P>) => string }) {
  const { limite, siguiente } = await limiteDe(n);
  const todas = await listar({ tab, q, ubicacion: donde, limite });
  const filas = todas.slice(0, limite);
  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,420px)_16rem]">
        <Buscador accion="/herramientas" valor={q} placeholder="Buscar por nombre o código (SIG-0001)" ocultos={{ tab, donde }} />
        <FiltroUbicacion valor={donde ?? ""} obras={obras} base={qs({ donde: undefined })} />
      </div>
      {filas.length === 0 ? (
        <Vacio icono={<Wrench className="size-10" />} titulo="No se encontró nada">{q || donde ? "Probá con otra búsqueda u otra ubicación." : undefined}</Vacio>
      ) : (
        <>
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {filas.map((h) => (
              <li key={h.id}>
                <Link href={`/herramientas/${h.id}`} className="flex min-h-14 items-start justify-between gap-3 px-4 py-3 active:bg-hover">
                  <div className="min-w-0">
                    <p className="font-medium">{h.nombre}</p>
                    <p className="truncate text-sm text-suave tabular-nums">{h.codigo} · {h.donde}{h.quien ? ` · la tiene ${h.quien}` : ""}</p>
                    {h.vencida && h.devolucionPrevista && <p className="text-sm font-medium text-critico">{vencimiento(h.devolucionPrevista).texto.replace("Vencido", "Debía volver")}</p>}
                  </div>
                  {h.tipoControl === "UNITARIA" ? <Insignia tono={h.vencida ? "critico" : ESTADO[h.estado].tono}>{h.vencida ? "Vencida" : ESTADO[h.estado].texto}</Insignia> : <span className="font-medium tabular-nums">{h.total}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla">
              <thead>
                <tr><th>Nombre</th><th>Código</th><th>Categoría</th><th>Dónde está</th><th>Quién la tiene</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {filas.map((h) => (
                  <tr key={h.id}>
                    <td className="font-medium"><Link href={`/herramientas/${h.id}`} className="hover:underline">{h.nombre}</Link></td>
                    <td className="text-suave tabular-nums">{h.codigo}</td>
                    <td className="text-suave">{h.categoria}</td>
                    <td>{h.donde}</td>
                    <td>{h.quien ?? <span className="text-suave">—</span>}</td>
                    <td>
                      {h.tipoControl === "CANTIDAD" ? (
                        <span className="tabular-nums">{h.total} en total</span>
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
      {todas.length > limite && <CargarMas href={qs({ n: String(siguiente) })} />}
    </>
  );
}
