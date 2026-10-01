import Link from "next/link";
import type { Metadata } from "next";
import { PlusCircle, ListOrdered } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { obtenerCola, obtenerHistorial, type PedidoPlano } from "@/lib/datos/pedidos";
import { idsObrasDe } from "@/lib/datos/obras";
import { datosFormularioPedido } from "@/lib/datos/formulario-pedido";
import { Titulo, Subtitulo, Vacio, Tabla } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";
import { Estado } from "@/components/ui/estado";
import { ConPanel } from "@/components/ui/panel";
import { TarjetaPedido, EstadoPedido } from "@/components/pedidos/tarjeta-pedido";
import { BotonTomar } from "@/components/pedidos/acciones-pedido";
import { FormularioPedido } from "@/components/pedidos/formulario-pedido";
import { TIPO_CARGA } from "@/lib/etiquetas";
import { cuando, peso, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Cola de pedidos" };

type Params = { ver?: string; obras?: string };

export default async function PaginaPedidos({ searchParams }: { searchParams: Promise<Params> }) {
  const u = await requerirUsuario("pedidos.ver");
  const { ver = "cola", obras } = await searchParams;
  const esResponsable = u.rol === "RESPONSABLE_OBRA";
  const soloMias = esResponsable && obras !== "todas";
  const obraIds = soloMias ? await idsObrasDe(u) : null;
  const puedePedir = puede(u.rol, "pedidos.crear");
  const esChofer = u.rol === "CHOFER";

  const qs = (cambios: Partial<Params>) => {
    const p = new URLSearchParams({ ...(ver !== "cola" ? { ver } : {}), ...(obras ? { obras } : {}) });
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/pedidos?${s}` : "/pedidos";
  };

  return (
    <div>
      <Titulo
        detalle="Una sola cola para todos. Los choferes toman en orden."
        accion={
          puedePedir && (
            <>
              <BotonLink href="/pedidos/nuevo" icono={<PlusCircle className="size-5" />} className="lg:hidden">
                Pedir
              </BotonLink>
              <div className="hidden lg:block">
                <ConPanel titulo="Pedir un viaje" etiqueta="Pedir un viaje" icono={<PlusCircle className="size-5" />}>
                  <FormularioPedido datos={await datosFormularioPedido(u)} />
                </ConPanel>
              </div>
            </>
          )
        }
      >
        Pedidos
      </Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav className="grid grid-cols-2 gap-1 rounded-[var(--radius-caja)] bg-black/5 p-1">
          {[
            ["cola", "En curso"],
            ["historial", "Últimos 30 días"],
          ].map(([v, t]) => (
            <Link key={v} href={qs({ ver: v === "cola" ? undefined : v })} className={`grid min-h-11 place-items-center rounded-md px-4 text-sm font-semibold ${ver === v ? "bg-papel shadow-[0_0_0_1px_var(--color-linea)]" : "text-suave"}`}>
              {t}
            </Link>
          ))}
        </nav>
        {esResponsable && (
          <Link href={qs({ obras: soloMias ? "todas" : undefined })} className="min-h-11 rounded-md px-3 py-2.5 text-sm font-semibold underline">
            {soloMias ? "Ver todas las obras" : "Ver solo mis obras"}
          </Link>
        )}
      </div>

      {ver === "historial" ? <Historial obraIds={obraIds} /> : <Cola obraIds={obraIds} esChofer={esChofer} />}
    </div>
  );
}

async function Cola({ obraIds, esChofer }: { obraIds: string[] | null; esChofer: boolean }) {
  const { pendientes, tomados, enViaje } = await obtenerCola({ obraIds });
  const todos = [...pendientes, ...tomados, ...enViaje];
  if (todos.length === 0) {
    return (
      <Vacio titulo="No hay pedidos en curso" icono={<ListOrdered className="size-8" />}>
        Cuando alguien pida un viaje aparece acá.
      </Vacio>
    );
  }
  return (
    <>
      {/* Celular */}
      <div className="lg:hidden">
        {[
          ["Esperando chofer", pendientes],
          ["Tomados", tomados],
          ["En viaje", enViaje],
        ].map(([titulo, lista]) =>
          (lista as PedidoPlano[]).length ? (
            <section key={titulo as string}>
              <Subtitulo>
                {titulo as string} ({(lista as PedidoPlano[]).length})
              </Subtitulo>
              <ul className="flex flex-col gap-3">
                {(lista as PedidoPlano[]).map((p, i) => (
                  <TarjetaPedido key={p.id} p={p} posicion={p.estado === "PENDIENTE" ? i + 1 : undefined} accion={esChofer && p.estado === "PENDIENTE" ? <BotonTomar pedidoId={p.id} /> : undefined} />
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>

      {/* Escritorio */}
      <Tabla className="hidden lg:block">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Obra</th>
            <th>Desde</th>
            <th>Qué</th>
            <th>Peso</th>
            <th>Pidió</th>
            <th>Cuándo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((p) => (
            <tr key={p.id}>
              <td className="text-suave tabular-nums">{p.numero}</td>
              <td className="font-semibold">
                <Link href={`/pedidos/${p.id}`} className="hover:underline">
                  Obra {p.obra.nombre}
                </Link>
                {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Estado tono="critico" className="ml-2">Urgente</Estado>}
              </td>
              <td>{p.origen}</td>
              <td className="max-w-xs">
                <span className="line-clamp-1">{p.descripcion}</span>
                <span className="text-sm text-suave">{TIPO_CARGA[p.tipoCarga]}</span>
              </td>
              <td className="tabular-nums">{p.pesoKg ? peso(p.pesoKg) : "—"}</td>
              <td>{p.solicitante.nombre}</td>
              <td className="whitespace-nowrap text-suave">{cuando(p.creadoEn)}</td>
              <td>
                <EstadoPedido p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </>
  );
}

async function Historial({ obraIds }: { obraIds: string[] | null }) {
  const lista = await obtenerHistorial({ obraIds });
  if (lista.length === 0) return <Vacio titulo="Sin pedidos terminados en los últimos 30 días" />;
  return (
    <>
      <ul className="flex flex-col gap-3 lg:hidden">
        {lista.map((p) => (
          <TarjetaPedido key={p.id} p={p} />
        ))}
      </ul>
      <Tabla className="hidden lg:block">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Obra</th>
            <th>Desde</th>
            <th>Qué</th>
            <th>Chofer</th>
            <th>Vehículo</th>
            <th>Llegó</th>
            <th className="text-right">Costo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id}>
              <td className="text-suave tabular-nums">{p.numero}</td>
              <td className="font-semibold">
                <Link href={`/pedidos/${p.id}`} className="hover:underline">
                  Obra {p.obra.nombre}
                </Link>
              </td>
              <td>{p.origen}</td>
              <td className="max-w-xs">
                <span className="line-clamp-1">{p.descripcion}</span>
              </td>
              <td>{p.chofer?.nombre ?? "—"}</td>
              <td>{p.vehiculo?.nombre ?? "—"}</td>
              <td className="whitespace-nowrap text-suave">{p.viaje?.llegadaEn ? cuando(p.viaje.llegadaEn) : p.canceladoEn ? cuando(p.canceladoEn) : "—"}</td>
              <td className="text-right tabular-nums">{p.viaje?.costo != null ? plata(p.viaje.costo) : "—"}</td>
              <td>
                <EstadoPedido p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </>
  );
}
