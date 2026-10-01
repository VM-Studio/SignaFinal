import { Construction, PackagePlus, Store, Trash2, Users, Wrench, Package, type LucideIcon } from "lucide-react";
import type { TipoPedido } from "@prisma/client";

export const ICONO_TIPO: Record<TipoPedido, LucideIcon> = {
  RETIRO_PROVEEDOR: Store,
  TRASLADO_MAQUINARIA: Construction,
  TRASLADO_HERRAMIENTAS: Wrench,
  LLEVAR_A_OBRA: PackagePlus,
  RETIRO_ESCOMBROS: Trash2,
  TRASLADO_PERSONAS: Users,
  OTRO: Package,
};

export function IconoTipo({ tipo, className = "size-5" }: { tipo: TipoPedido; className?: string }) {
  const I = ICONO_TIPO[tipo];
  return <I aria-hidden className={className} />;
}
