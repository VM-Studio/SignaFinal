import Link from "next/link";
import type { Metadata } from "next";
import { PackagePlus, Undo2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { obrasDe } from "@/lib/datos/obras";
import { inventario, solicitudes } from "@/lib/datos/deposito";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { ConPanel } from "@/components/ui/panel";
import { SolicitudObra } from "@/components/deposito/solicitudes";
import { FormularioSolicitud } from "@/components/deposito/formulario-solicitud";
import { hace } from "@/lib/formato";

export const metadata: Metadata = { title: "Herramientas" };

export default async function PaginaHerramientas() {
  const u = await requerirUsuario("herramientas.solicitar");
  const obras = await obrasDe(u);
  const ids = new Set(obras.map((o) => o.id));
  const [items, mias] = await Promise.all([
    inventario(),
    solicitudes({ solicitanteId: u.id, OR: [{ estado: "PENDIENTE" }, { resueltaEn: { gte: new Date(Date.now() - 3 * 86400000) } }] }, 20),
  ]);
  const operativos = items.filter((i) => i.estado === "OPERATIVO");
  const solicitables = operativos.map((i) => ({ id: i.id, nombre: i.nombre, control: i.control, unidad: i.unidad, disponible: i.enDeposito, enObras: i.enObras }));
  const enMisObras = items.filter((i) => i.enObras.some((o) => ids.has(o.obraId)));
  const obrasSimple = obras.map((o) => ({ id: o.id, nombre: o.nombre }));

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Pedí al depósito o avisá lo que devolvés.">Herramientas</Titulo>
      <div className="grid grid-cols-2 gap-2">
        <ConPanel titulo="Pedir al depósito" etiqueta="Pedir" tamano="grande" ancho icono={<PackagePlus className="size-5" />}>
          <FormularioSolicitud tipo="PEDIDO" obras={obrasSimple} items={solicitables} />
        </ConPanel>
        <ConPanel titulo="Devolver al depósito" etiqueta="Devolver" tamano="grande" variante="secundario" ancho icono={<Undo2 className="size-5" />}>
          <FormularioSolicitud tipo="DEVOLUCION" obras={obrasSimple} items={items.map((i) => ({ id: i.id, nombre: i.nombre, control: i.control, unidad: i.unidad, disponible: i.enDeposito, enObras: i.enObras }))} />
        </ConPanel>
      </div>

      {mias.length > 0 && (
        <>
          <Subtitulo>Tus solicitudes</Subtitulo>
          <ul className="flex flex-col gap-2">{mias.map((s) => <SolicitudObra key={s.id} s={s} />)}</ul>
        </>
      )}

      <Subtitulo>En {u.rol === "RESPONSABLE_OBRA" ? "tus obras" : "obras"}</Subtitulo>
      {enMisObras.length === 0 ? (
        <Vacio titulo="No hay herramientas del depósito en obra" />
      ) : (
        <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {enMisObras.flatMap((i) =>
            i.enObras.filter((o) => ids.has(o.obraId)).map((o) => (
              <li key={`${i.id}-${o.obraId}`}>
                <Link href={`/deposito/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block font-semibold">{i.control === "CANTIDAD" ? `${o.cantidad} ${i.nombre.toLowerCase()}` : i.nombre}</span>
                    <span className="text-sm text-suave">Obra {o.obra}{i.control === "UNITARIA" && i.tenedor ? ` · ${i.tenedor} · ${hace(i.ubicadoDesde)}` : ""}</span>
                  </span>
                </Link>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
