"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { guardarEstadoLista } from "./volver";

/** Fila de tabla que abre un detalle (toda la fila es tocable) y guarda la lista para "← Volver". */
export function FilaEnlace({ href, clave, children, ...resto }: { href: string; clave: string; children: ReactNode; "data-vivo-id"?: string }) {
  const router = useRouter();
  return (
    <tr {...resto} className="cursor-pointer" onClick={() => { guardarEstadoLista(clave); router.push(href); }}>
      {children}
    </tr>
  );
}
