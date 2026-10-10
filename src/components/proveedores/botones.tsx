"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PlusCircle, Star } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { useAviso } from "@/components/ui/avisos";
import { marcarPrincipal } from "@/lib/proveedores/acciones";
import { FormularioEditarProveedor, FormularioProveedor, FormularioSucursal, type ProveedorEditable, type SucursalEditable } from "./formularios";

/** "Nuevo proveedor" (lista de proveedores): al guardar abre su ficha. */
export function NuevoProveedor() {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton icono={<PlusCircle />} onClick={() => setAbierta(true)}>Nuevo proveedor</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Nuevo proveedor">
        {abierta && <FormularioProveedor onCreado={(p) => { setAbierta(false); aviso({ mensaje: `${p.nombre} cargado.` }); router.push(`/proveedores/${p.id}`); }} />}
      </Hoja>
    </>
  );
}

export function EditarProveedor({ inicial }: { inicial: ProveedorEditable }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante="secundario" icono={<Pencil />} onClick={() => setAbierta(true)}>Editar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Editar ${inicial.nombre}`}>
        {abierta && <FormularioEditarProveedor inicial={inicial} onGuardado={() => { setAbierta(false); aviso({ mensaje: "Proveedor actualizado." }); router.refresh(); }} />}
      </Hoja>
    </>
  );
}

/** Agregar o editar una sucursal (ficha del proveedor). */
export function BotonSucursal({ proveedorId, sucursal }: { proveedorId: string; sucursal?: SucursalEditable }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante="secundario" tamano={sucursal ? "chico" : "normal"} icono={sucursal ? <Pencil /> : <PlusCircle />} onClick={() => setAbierta(true)}>{sucursal ? "Editar" : "Agregar sucursal"}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={sucursal ? `Sucursal ${sucursal.nombre}` : "Nueva sucursal"}>
        {abierta && <FormularioSucursal proveedorId={proveedorId} inicial={sucursal} onGuardada={() => { setAbierta(false); aviso({ mensaje: sucursal ? "Sucursal actualizada." : "Sucursal agregada." }); router.refresh(); }} />}
      </Hoja>
    </>
  );
}

export function BotonPrincipal({ sucursalId }: { sucursalId: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  return (
    <Boton variante="fantasma" tamano="chico" icono={<Star />} cargando={enviando} onClick={async () => {
      setEnviando(true);
      const r = await marcarPrincipal(sucursalId);
      setEnviando(false);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      aviso({ mensaje: "Marcada como principal." });
      router.refresh();
    }}>Marcar como principal</Boton>
  );
}
