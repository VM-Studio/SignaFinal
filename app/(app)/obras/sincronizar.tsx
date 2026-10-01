"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { sincronizarConLebane } from "@/lib/acciones/usuarios";

export function BotonSincronizar() {
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();
  return (
    <Boton
      variante="secundario"
      cargando={pendiente}
      icono={<RefreshCw className="size-5" />}
      onClick={() =>
        iniciar(async () => {
          const r = await sincronizarConLebane();
          if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
          aviso({ mensaje: `Lebane${r.datos.origen === "mock" ? " (datos de prueba)" : ""}: ${r.datos.obras} obras, ${r.datos.proveedores} proveedores, ${r.datos.ordenes} órdenes.` });
          router.refresh();
        })
      }
    >
      Traer de Lebane
    </Boton>
  );
}
