"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { marcarVista, revisarAhora } from "@/lib/alertas/acciones";

export function BotonVista({ id }: { id: string }) {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Boton variante="fantasma" tamano="chico" cargando={pendiente} icono={<Eye />} onClick={() => iniciar(async () => { await marcarVista(id); router.refresh(); })}>
      Ya la vi
    </Boton>
  );
}

export function BotonRevisar() {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const aviso = useAviso();
  return (
    <Boton variante="secundario" tamano="chico" cargando={pendiente} icono={<RefreshCw />} onClick={() => iniciar(async () => {
      const r = await revisarAhora();
      aviso(r.ok ? { mensaje: `Revisadas: ${r.datos.activas} activas.` } : { mensaje: r.error, tono: "error" });
      router.refresh();
    })}>
      Revisar ahora
    </Boton>
  );
}
