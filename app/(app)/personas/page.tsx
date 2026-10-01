import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { db } from "@/lib/db";
import { cambiarActivoUsuario } from "@/lib/acciones/usuarios";
import { Tabla, Titulo } from "@/components/ui/basicos";
import { Estado } from "@/components/ui/estado";
import { ConPanel } from "@/components/ui/panel";
import { BotonActivo } from "@/components/flota/boton-activo";
import { FormularioPersona } from "@/components/personas/formulario-persona";
import { ROL } from "@/lib/etiquetas";
import { aInputFecha, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Personas" };

export default async function PaginaPersonas() {
  const u = await requerirUsuario("usuarios.gestionar");
  const [personas, obras] = await Promise.all([
    db.usuario.findMany({ orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }], include: { obras: { select: { id: true, nombre: true } } } }),
    db.obra.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return (
    <div>
      <Titulo
        detalle="Quién entra a la app y qué puede hacer."
        accion={
          <ConPanel titulo="Agregar persona" etiqueta="Agregar" icono={<Plus className="size-5" />}>
            <FormularioPersona inicial={{ nombre: "", usuario: "", rol: "", telefono: "", licenciaVence: "", obraIds: [] }} obras={obras} />
          </ConPanel>
        }
      >
        Personas
      </Titulo>
      <Tabla>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Rol</th>
            <th className="hidden md:table-cell">Obras / licencia</th>
            <th className="hidden sm:table-cell">Usuario</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {personas.map((p) => {
            const lic = p.rol === "CHOFER" ? vencimiento(p.licenciaVence) : null;
            return (
              <tr key={p.id} className={p.activo ? "" : "opacity-50"}>
                <td className="font-semibold">{p.nombre}{!p.activo && <span className="ml-2 text-sm font-normal">(desactivado)</span>}</td>
                <td>{ROL[p.rol]}</td>
                <td className="hidden md:table-cell">
                  {lic ? <Estado tono={lic.nivel === "ok" ? "ok" : lic.nivel === "critico" ? "critico" : "aviso"}>Licencia: {lic.texto.toLowerCase()}</Estado> : p.rol === "RESPONSABLE_OBRA" ? p.obras.map((o) => o.nombre).join(", ") : "Todas"}
                </td>
                <td className="hidden text-suave sm:table-cell">{p.usuario}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <ConPanel titulo={`Editar · ${p.nombre}`} etiqueta="Editar" variante="fantasma" tamano="chico">
                      <FormularioPersona
                        inicial={{ id: p.id, nombre: p.nombre, usuario: p.usuario, rol: p.rol, telefono: p.telefono ?? "", licenciaVence: aInputFecha(p.licenciaVence), obraIds: p.obras.map((o) => o.id) }}
                        obras={obras}
                      />
                    </ConPanel>
                    {p.id !== u.id && <BotonActivo activo={p.activo} nombre={p.nombre} accion={cambiarActivoUsuario.bind(null, p.id)} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>
    </div>
  );
}
