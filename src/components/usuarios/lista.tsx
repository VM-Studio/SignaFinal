"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Insignia } from "@/components/ui/basicos";
import { FormularioUsuario, NUEVO, type UsuarioEditable } from "./formulario";

export type FilaUsuario = UsuarioEditable & { id: string; rolTexto: string; detalle: string; licencia: { texto: string; tono: "ok" | "aviso" | "critico" } | null };

/** Lista de personas: cada una se edita en una hoja. "?u=<id>" la abre directo (desde una alerta). */
export function ListaUsuarios({ filas, obras, puedeDireccion, yoId, abrir }: {
  filas: FilaUsuario[]; obras: { id: string; nombre: string }[]; puedeDireccion: boolean; yoId: string; abrir?: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<UsuarioEditable | null>(() => filas.find((f) => f.id === abrir) ?? null);
  const cerrar = () => {
    setEditando(null);
    if (abrir) router.replace("/usuarios", { scroll: false });
  };
  return (
    <>
      <Boton icono={<UserPlus />} onClick={() => setEditando(NUEVO)} className="mb-3">Agregar persona</Boton>
      <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
        {filas.map((f) => (
          <li key={f.id}>
            <button onClick={() => setEditando(f)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover ${f.activo ? "" : "opacity-60"}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[13px] font-medium">{f.nombre.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{f.nombre}{f.id === yoId ? " (vos)" : ""}</span>
                <span className="block truncate text-sm text-suave">{f.rolTexto} · {f.detalle}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {!f.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                {f.licencia && <Insignia tono={f.licencia.tono}>{f.licencia.texto}</Insignia>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Hoja abierta={!!editando} onCerrar={cerrar} titulo={editando?.id ? editando.nombre : "Nueva persona"}>
        {editando && <FormularioUsuario key={editando.id ?? "nuevo"} inicial={editando} obras={obras} puedeDireccion={puedeDireccion} esYo={editando.id === yoId} cerrar={cerrar} />}
      </Hoja>
    </>
  );
}
