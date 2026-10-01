"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pasos } from "@/components/ui/pasos";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { guardarUsuario, type DatosUsuario } from "@/lib/acciones/usuarios";
import { ROL } from "@/lib/etiquetas";

export type PersonaEditable = { id?: string; nombre: string; usuario: string; rol: string; telefono: string; licenciaVence: string; obraIds: string[] };

export function FormularioPersona({ inicial, obras }: { inicial: PersonaEditable; obras: { id: string; nombre: string }[] }) {
  const [d, setD] = useState({ ...inicial, password: "" });
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();
  const campo = (k: "nombre" | "usuario" | "telefono" | "licenciaVence" | "password") => ({ id: `per-${k}`, value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value }) });

  async function guardar() {
    setEnviando(true);
    const r = await guardarUsuario({ ...d, rol: d.rol as DatosUsuario["rol"] });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: inicial.id ? "Cambios guardados." : `${d.nombre} ya puede entrar.` });
    panel.cerrar();
    router.refresh();
  }

  return (
    <Pasos
      titulos={["Quién es", "Qué hace", "Acceso"]}
      textoFinal={inicial.id ? "Guardar" : "Crear"}
      onFinal={guardar}
      enviando={enviando}
      error={error}
      validar={(i) => {
        if (i === 0 && (d.nombre.trim().length < 2 || d.usuario.trim().length < 3)) return "Completá nombre y usuario.";
        if (i === 1 && !d.rol) return "Elegí el rol.";
        if (i === 2 && !inicial.id && d.password.length < 8) return "La contraseña inicial necesita 8 caracteres.";
      }}
    >
      <>
        <Campo etiqueta="Nombre" htmlFor="per-nombre"><Entrada {...campo("nombre")} maxLength={60} /></Campo>
        <Campo etiqueta="Usuario para entrar" htmlFor="per-usuario" ayuda="Sin espacios ni acentos. Ej.: claudio"><Entrada {...campo("usuario")} autoCapitalize="none" maxLength={30} /></Campo>
        <Campo etiqueta="Teléfono" htmlFor="per-telefono"><Entrada {...campo("telefono")} inputMode="tel" maxLength={30} /></Campo>
      </>
      <>
        <Opciones nombre="Rol" columnas={2} valor={d.rol} onElegir={(rol) => setD({ ...d, rol })} opciones={Object.entries(ROL).map(([valor, titulo]) => ({ valor, titulo }))} />
        {d.rol === "CHOFER" && (
          <Campo etiqueta="Licencia vence" htmlFor="per-licenciaVence"><Entrada {...campo("licenciaVence")} type="date" /></Campo>
        )}
        {d.rol === "RESPONSABLE_OBRA" && (
          <div>
            <p className="mb-2 text-sm font-semibold">Obras a cargo</p>
            <div className="grid grid-cols-2 gap-2">
              {obras.map((o) => (
                <label key={o.id} className="flex min-h-11 items-center gap-2 rounded-md border-2 border-linea bg-papel px-3">
                  <input type="checkbox" className="size-5 accent-negro" checked={d.obraIds.includes(o.id)} onChange={(e) => setD({ ...d, obraIds: e.target.checked ? [...d.obraIds, o.id] : d.obraIds.filter((x) => x !== o.id) })} />
                  {o.nombre}
                </label>
              ))}
            </div>
          </div>
        )}
      </>
      <>
        <Campo etiqueta={inicial.id ? "Nueva contraseña (dejá vacío para no cambiarla)" : "Contraseña inicial"} htmlFor="per-password">
          <Entrada {...campo("password")} type="text" autoComplete="new-password" />
        </Campo>
      </>
    </Pasos>
  );
}
