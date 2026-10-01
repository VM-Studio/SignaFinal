"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { recalcularAlertas } from "@/lib/acciones/usuarios";

export function BotonRecalcular() {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const aviso = useAviso();
  return (
    <Boton
      variante="secundario"
      tamano="chico"
      cargando={pendiente}
      icono={<RefreshCw className="size-4" />}
      onClick={() =>
        iniciar(async () => {
          const r = await recalcularAlertas();
          if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
          router.refresh();
        })
      }
    >
      Revisar ahora
    </Boton>
  );
}
