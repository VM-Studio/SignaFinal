"use client";

import { useState } from "react";
import { MapPin, PlusCircle, Store } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Combobox } from "@/components/ui/combobox";
import { distancia } from "@/lib/geo";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import { FormularioProveedor, FormularioSucursal } from "./formularios";

export type ValorProveedor = { proveedorId: string | null; sucursalId: string | null };

const km = (m: number) => `${(m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;

/**
 * Proveedor y sucursal (Habilitar para retirar y Orden de compra):
 *  · buscador por nombre o CUIT, con cuántas sucursales tiene cada uno;
 *  · "Nuevo proveedor" al lado: alta rápida con la primera sucursal, queda seleccionado;
 *  · con UNA sucursal se elige sola y se muestra la dirección; con VARIAS hay que elegir (con la
 *    distancia a la obra, si se conoce);
 *  · siempre, "Agregar sucursal" para ese proveedor (queda seleccionada).
 */
export function SelectorProveedorSucursal({ proveedores: iniciales, valor, onCambio, destino, puedeCargar = true }: {
  proveedores: ProveedorConSucursales[]; valor: ValorProveedor; onCambio: (v: ValorProveedor, p?: ProveedorConSucursales) => void; destino?: { lat: number; lng: number } | null; puedeCargar?: boolean;
}) {
  const [proveedores, setProveedores] = useState(iniciales);
  const [alta, setAlta] = useState<"proveedor" | "sucursal" | null>(null);
  const prov = proveedores.find((p) => p.id === valor.proveedorId) ?? null;

  function elegirProveedor(id: string | null, lista = proveedores) {
    const p = lista.find((x) => x.id === id) ?? null;
    // Una sola sucursal: se elige sola.
    onCambio({ proveedorId: id, sucursalId: p && p.sucursales.length === 1 ? p.sucursales[0].id : null }, p ?? undefined);
  }
  function reemplazar(p: ProveedorConSucursales) {
    const lista = proveedores.some((x) => x.id === p.id) ? proveedores.map((x) => (x.id === p.id ? p : x)) : [...proveedores, p].sort((a, b) => a.nombre.localeCompare(b.nombre));
    setProveedores(lista);
    return lista;
  }

  const sucursales = prov ? [...prov.sucursales].sort((a, b) => (destino ? distancia(a, destino) - distancia(b, destino) : Number(b.principal) - Number(a.principal))) : [];
  return (
    <div className="flex flex-col gap-2">
      <Combobox
        etiqueta="Proveedor"
        placeholder="Buscar por nombre o CUIT"
        items={proveedores.map((p) => ({ id: p.id, titulo: p.nombre, detalle: `${p.sucursales.length} ${p.sucursales.length === 1 ? "sucursal" : "sucursales"}${p.cuit ? ` · CUIT ${p.cuit}` : ""}`, buscar: `${p.cuit ?? ""} ${p.cuit?.replace(/-/g, "") ?? ""} ${p.sucursales.map((s) => `${s.nombre} ${s.localidad}`).join(" ")}` }))}
        valor={valor.proveedorId}
        onElegir={(id) => elegirProveedor(id)}
        vacio="Ningún proveedor con ese nombre. Cargalo con “Nuevo proveedor”."
        accion={puedeCargar ? <Boton variante="secundario" icono={<Store />} onClick={() => setAlta("proveedor")} className="shrink-0">Nuevo proveedor</Boton> : undefined}
      />

      {prov && (
        <div className="flex flex-col gap-2">
          {prov.sucursales.length === 1 ? (
            <p className="flex items-start gap-2 rounded-md bg-fondo px-3 py-2 text-sm">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-suave" />
              <span><span className="font-medium">{prov.sucursales[0].nombre}</span> · {prov.sucursales[0].direccion}, {prov.sucursales[0].localidad}{prov.sucursales[0].horarioRetiro ? ` · ${prov.sucursales[0].horarioRetiro}` : ""}</span>
            </p>
          ) : prov.sucursales.length > 1 ? (
            <fieldset>
              <legend className="mb-1 text-[12px] font-medium text-suave">¿En qué sucursal? (obligatorio)</legend>
              <div role="radiogroup" className="flex flex-col gap-1.5">
                {sucursales.map((s) => {
                  const si = s.id === valor.sucursalId;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={si} onClick={() => onCambio({ proveedorId: prov.id, sucursalId: s.id }, prov)}
                      className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-left ${si ? "border-tinta bg-hover" : "border-linea bg-papel hover:border-linea-fuerte"}`}>
                      <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full border ${si ? "border-tinta" : "border-linea-fuerte"}`}>{si && <span className="size-2 rounded-full bg-tinta" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{s.nombre}{s.principal ? " · principal" : ""}</span>
                        <span className="block text-[12px] text-suave">{s.direccion}, {s.localidad}{s.horarioRetiro ? ` · ${s.horarioRetiro}` : ""}</span>
                      </span>
                      {destino && <span className="shrink-0 text-[12px] text-suave tabular-nums">a {km(distancia(s, destino))} de la obra</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-critico">Este proveedor no tiene sucursales activas. Agregale una.</p>
          )}
          {puedeCargar && (
            <Boton variante="fantasma" tamano="chico" icono={<PlusCircle />} onClick={() => setAlta("sucursal")} className="self-start">Agregar sucursal</Boton>
          )}
        </div>
      )}

      <Hoja abierta={alta === "proveedor"} onCerrar={() => setAlta(null)} titulo="Nuevo proveedor">
        {alta === "proveedor" && (
          <FormularioProveedor
            rapido
            onCreado={(p) => {
              const lista = reemplazar(p);
              setAlta(null);
              onCambio({ proveedorId: p.id, sucursalId: p.sucursales[0]?.id ?? null }, lista.find((x) => x.id === p.id));
            }}
          />
        )}
      </Hoja>
      <Hoja abierta={alta === "sucursal"} onCerrar={() => setAlta(null)} titulo={prov ? `Nueva sucursal de ${prov.nombre}` : "Nueva sucursal"}>
        {alta === "sucursal" && prov && (
          <FormularioSucursal
            proveedorId={prov.id}
            onGuardada={(p) => {
              reemplazar(p);
              setAlta(null);
              onCambio({ proveedorId: p.id, sucursalId: p.sucursalId }, p);
            }}
          />
        )}
      </Hoja>
    </div>
  );
}
