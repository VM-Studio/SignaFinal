import type { Metadata } from "next";
import type { Rol } from "@prisma/client";
import { exigirPermiso } from "@/lib/auth/sesion";
import { listaUsuarios } from "@/lib/usuarios/consultas";
import { ROL } from "@/lib/etiquetas";
import { diaISO, vencimiento } from "@/lib/formato";
import { Buscador } from "@/components/ui/campos";
import { Pestanas, Titulo } from "@/components/ui/basicos";
import { ListaUsuarios, type FilaUsuario } from "@/components/usuarios/lista";

export const metadata: Metadata = { title: "Usuarios" };

const ROLES = Object.keys(ROL) as Rol[];

/** Quién entra a la app, con qué rol y qué obras tiene. Nada se borra: se desactiva. */
export default async function PaginaUsuarios({ searchParams }: { searchParams: Promise<{ rol?: string; q?: string; u?: string; inactivos?: string }> }) {
  const yo = await exigirPermiso("usuarios.gestionar");
  const sp = await searchParams;
  const rol = ROLES.includes(sp.rol as Rol) ? (sp.rol as Rol) : undefined;
  const { usuarios, obras } = await listaUsuarios({ rol, q: sp.q, inactivos: sp.inactivos === "1" || !!sp.u });
  const filas: FilaUsuario[] = usuarios.map((u) => {
    const v = u.licenciaVencimiento ? vencimiento(u.licenciaVencimiento) : null;
    return {
      id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, telefono: u.telefono ?? "", activo: u.activo,
      licenciaCategoria: u.licenciaCategoria ?? "", licenciaVencimiento: u.licenciaVencimiento ? diaISO(u.licenciaVencimiento) : "",
      obras: u.obrasACargo.map((o) => o.obraId), obraPrincipal: u.obrasACargo.find((o) => o.principal)?.obraId ?? "",
      rolTexto: ROL[u.rol],
      detalle: u.rol === "RESPONSABLE_OBRA" ? (u.obrasACargo.map((o) => `Obra ${o.obra.nombre}`).join(", ") || "sin obras") : u.rol === "CAPATAZ" ? "todas las obras" : u.vehiculoAsignado ? u.vehiculoAsignado.nombre : u.email,
      licencia: u.rol !== "CHOFER" ? null : !v ? { texto: "Sin licencia cargada", tono: "critico" } : { texto: v.dias < 0 ? "Licencia vencida" : v.dias <= 30 ? `Licencia: ${v.texto.toLowerCase()}` : `Licencia ${u.licenciaCategoria ?? ""}`.trim(), tono: v.dias < 0 ? "critico" : v.dias <= 30 ? "aviso" : "ok" },
    };
  });
  const href = (r?: Rol) => `/usuarios${r ? `?rol=${r}` : ""}`;
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Quién entra a la app, con qué rol y qué obras tiene. Para sacar a alguien se lo desactiva: no se borra nada.">Usuarios</Titulo>
      <Pestanas items={[{ href: href(), etiqueta: "Todos", activa: !rol }, ...ROLES.map((r) => ({ href: href(r), etiqueta: ROL[r], activa: rol === r }))]} />
      <div className="mb-3"><Buscador accion="/usuarios" valor={sp.q} placeholder="Buscar por nombre o email" ocultos={{ rol }} /></div>
      <ListaUsuarios filas={filas} obras={obras} puedeDireccion={yo.rol === "DIRECCION"} yoId={yo.id} abrir={sp.u} />
      {sp.inactivos !== "1" && <a href={`/usuarios?inactivos=1${rol ? `&rol=${rol}` : ""}`} className="mt-3 inline-block text-sm font-semibold text-suave underline">Ver también los desactivados</a>}
    </div>
  );
}
