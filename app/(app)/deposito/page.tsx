import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ScanLine, Search, Wrench } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { inventario } from "@/lib/datos/deposito";
import { Tabla, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonLink } from "@/components/ui/boton";
import { Estado } from "@/components/ui/estado";
import { ConPanel } from "@/components/ui/panel";
import { FormularioItem } from "@/components/deposito/formulario-item";
import { CATEGORIA_ITEM, ESTADO_ITEM } from "@/lib/etiquetas";

export const metadata: Metadata = { title: "Depósito" };

function Ubicacion({ i }: { i: Awaited<ReturnType<typeof inventario>>[number] }) {
  if (i.control === "UNITARIA") {
    return i.enObras[0] ? <span>Obra {i.enObras[0].obra}{i.tenedor ? ` · ${i.tenedor}` : ""}</span> : <span className="font-semibold">En depósito</span>;
  }
  return (
    <span>
      <b>{i.enDeposito}</b> en depósito
      {i.enObras.map((o) => ` · ${o.cantidad} en ${o.obra}`).join("")}
    </span>
  );
}

export default async function PaginaDeposito({ searchParams }: { searchParams: Promise<{ q?: string; donde?: string }> }) {
  const u = await requerirUsuario("deposito.ver");
  const { q, donde } = await searchParams;
  const [items, obras] = await Promise.all([inventario({ q, donde }), db.obra.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } })]);
  const editar = puede(u.rol, "deposito.editar");

  return (
    <div>
      <Titulo
        detalle="Maquinaria y herramientas: en el depósito o en una obra."
        accion={
          <>
            {puede(u.rol, "deposito.mover") && (
              <BotonLink href="/deposito/escanear" icono={<ScanLine className="size-5" />}>
                Escanear
              </BotonLink>
            )}
            {editar && (
              <ConPanel titulo="Agregar al depósito" etiqueta="Agregar" variante="secundario" icono={<Plus className="size-5" />}>
                <FormularioItem />
              </ConPanel>
            )}
          </>
        }
      >
        Depósito
      </Titulo>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/deposito">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-suave" />
          <input name="q" defaultValue={q} placeholder="Buscar: hormigonera, palas…" className="min-h-[52px] w-full rounded-[var(--radius-caja)] border-2 border-linea bg-papel pr-4 pl-11" />
        </div>
        <select name="donde" defaultValue={donde ?? ""} className="min-h-[52px] rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-4">
          <option value="">Todo</option>
          <option value="deposito">En el depósito</option>
          <option value="obras">En obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>Obra {o.nombre}</option>
          ))}
        </select>
        <button className="min-h-[52px] rounded-[var(--radius-caja)] bg-negro px-5 font-semibold text-white">Buscar</button>
      </form>

      {items.length === 0 ? (
        <Vacio titulo="No se encontró nada" icono={<Wrench className="size-8" />} />
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/deposito/${i.id}`} className="block rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{i.nombre}</p>
                    {i.estado !== "OPERATIVO" && <Estado tono={ESTADO_ITEM[i.estado].tono}>{ESTADO_ITEM[i.estado].texto}</Estado>}
                  </div>
                  <p className="text-sm text-suave">{CATEGORIA_ITEM[i.categoria]}{i.marca ? ` · ${i.marca}` : ""}</p>
                  <p className="mt-1 text-[15px]"><Ubicacion i={i} /></p>
                </Link>
              </li>
            ))}
          </ul>
          <Tabla className="hidden lg:block">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Marca / modelo</th>
                <th>Dónde está</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="font-semibold"><Link href={`/deposito/${i.id}`} className="hover:underline">{i.nombre}</Link></td>
                  <td>{CATEGORIA_ITEM[i.categoria]}</td>
                  <td className="text-suave">{i.marca || "—"}</td>
                  <td><Ubicacion i={i} /></td>
                  <td><Estado tono={ESTADO_ITEM[i.estado].tono}>{ESTADO_ITEM[i.estado].texto}</Estado></td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}
    </div>
  );
}
