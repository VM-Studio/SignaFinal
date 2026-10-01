"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import type { Resultado } from "@/lib/acciones/resultado";

/** Dar de baja / reactivar con un toque y deshacer. Nada se borra. */
export function BotonActivo({
  activo,
  nombre,
  accion,
}: {
  activo: boolean;
  nombre: string;
  accion: (activo: boolean) => Promise<Resultado<null>>;
}) {
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();
  return (
    <Boton
      variante={activo ? "peligro" : "secundario"}
      cargando={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await accion(!activo);
          if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
          aviso({
            mensaje: activo ? `${nombre} dado de baja.` : `${nombre} reactivado.`,
            deshacer: async () => {
              await accion(activo);
              router.refresh();
            },
          });
          router.refresh();
        })
      }
    >
      {activo ? "Dar de baja" : "Reactivar"}
    </Boton>
  );
}
