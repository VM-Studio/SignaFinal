"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Rol } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Fecha, MensajeError, Selector } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { cambiarActivo, guardarUsuario } from "@/lib/usuarios/acciones";
import { ROL } from "@/lib/etiquetas";

export type UsuarioEditable = {
  id?: string; nombre: string; email: string; rol: Rol; telefono: string; activo: boolean;
  licenciaCategoria: string; licenciaVencimiento: string; obras: string[]; obraPrincipal: string;
};

export const NUEVO: UsuarioEditable = { nombre: "", email: "", rol: "RESPONSABLE_OBRA", telefono: "", activo: true, licenciaCategoria: "", licenciaVencimiento: "", obras: [], obraPrincipal: "" };

/** Alta o edición de una persona: datos, rol, licencia (choferes) y obras a cargo (responsables). */
export function FormularioUsuario({ inicial, obras, puedeDireccion, esYo, cerrar }: {
  inicial: UsuarioEditable; obras: { id: string; nombre: string }[]; puedeDireccion: boolean; esYo: boolean; cerrar: () => void;
}) {
  const [u, setU] = useState(inicial);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  const cambiar = <K extends keyof UsuarioEditable>(k: K, v: UsuarioEditable[K]) => setU((x) => ({ ...x, [k]: v }));
  const roles = (Object.keys(ROL) as Rol[]).filter((r) => r !== "DIRECCION" || puedeDireccion || inicial.rol === "DIRECCION");

  async function guardar() {
    setEnviando(true);
    setError(undefined);
    const r = await guardarUsuario({ ...u, password: password || undefined });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: u.id ? `Guardado: ${u.nombre}.` : `${u.nombre} ya puede entrar con su email y la contraseña inicial.` });
    cerrar();
    router.refresh();
  }

  async function activar(activo: boolean) {
    setEnviando(true);
    const r = await cambiarActivo(u.id!, activo);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: activo ? `${u.nombre} puede volver a entrar.` : `${u.nombre} ya no puede entrar. No se borró nada.` });
    cerrar();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" htmlFor="u-nombre"><Entrada id="u-nombre" value={u.nombre} onChange={(e) => cambiar("nombre", e.target.value)} maxLength={60} /></Campo>
      <Campo etiqueta="Email (para entrar)" htmlFor="u-email"><Entrada id="u-email" type="email" inputMode="email" autoCapitalize="none" value={u.email} onChange={(e) => cambiar("email", e.target.value)} /></Campo>
      <Campo etiqueta="Rol" htmlFor="u-rol">
        <Selector id="u-rol" value={u.rol} disabled={esYo} onChange={(e) => cambiar("rol", e.target.value as Rol)}>
          {roles.map((r) => <option key={r} value={r}>{ROL[r]}</option>)}
        </Selector>
      </Campo>
      <Campo etiqueta="Teléfono" htmlFor="u-tel"><Entrada id="u-tel" type="tel" inputMode="tel" value={u.telefono} onChange={(e) => cambiar("telefono", e.target.value)} placeholder="11 5000-1000" /></Campo>

      {u.rol === "CHOFER" && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Licencia (categoría)" htmlFor="u-lic"><Entrada id="u-lic" value={u.licenciaCategoria} onChange={(e) => cambiar("licenciaCategoria", e.target.value.toUpperCase())} placeholder="C2" maxLength={10} /></Campo>
          <Campo etiqueta="Vence" htmlFor="u-licv"><Fecha id="u-licv" value={u.licenciaVencimiento} onChange={(e) => cambiar("licenciaVencimiento", e.target.value)} /></Campo>
        </div>
      )}

      {u.rol === "RESPONSABLE_OBRA" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold">Obras a cargo (tocá la estrella para la principal)</legend>
          {obras.map((o) => {
            const tiene = u.obras.includes(o.id);
            const principal = tiene && (u.obraPrincipal || u.obras[0]) === o.id;
            return (
              <div key={o.id} className={`flex min-h-[48px] items-center gap-3 rounded-[var(--radius-caja)] border px-3 ${tiene ? "border-linea bg-papel" : "border-linea"}`}>
                <label className="flex flex-1 items-center gap-3 font-medium">
                  <input type="checkbox" className="size-5 accent-negro" checked={tiene} onChange={() => cambiar("obras", tiene ? u.obras.filter((x) => x !== o.id) : [...u.obras, o.id])} />
                  Obra {o.nombre}
                </label>
                {tiene && (
                  <button type="button" onClick={() => cambiar("obraPrincipal", o.id)} aria-pressed={principal} className={`text-sm font-semibold ${principal ? "text-negro" : "text-suave underline"}`}>
                    {principal ? "★ Principal" : "Hacer principal"}
                  </button>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      <Campo etiqueta={u.id ? "Nueva contraseña (opcional)" : "Contraseña inicial"} htmlFor="u-pass" ayuda="Mínimo 8 caracteres. Pasásela a la persona en mano.">
        <Entrada id="u-pass" type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Campo>
      <MensajeError>{error}</MensajeError>
      <Boton ancho cargando={enviando} onClick={guardar}>{u.id ? "Guardar" : "Dar de alta"}</Boton>
      {u.id && !esYo && (
        <Boton ancho variante={u.activo ? "peligro" : "secundario"} cargando={enviando} onClick={() => activar(!u.activo)}>
          {u.activo ? "Desactivar (no se borra nada)" : "Volver a activar"}
        </Boton>
      )}
    </div>
  );
}
