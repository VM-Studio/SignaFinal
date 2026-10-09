import type { TipoNotificacion } from "@prisma/client";
import { Bell, Check, CopyX, Flag, Hand, MapPinCheck, PackageOpen, Play, Siren, Truck, Undo2, WifiOff, Wrench, X, type LucideIcon } from "lucide-react";

/** Ícono de cada tipo de aviso en la bandeja. */
export const ICONO_AVISO: Record<TipoNotificacion, LucideIcon> = {
  PEDIDO_ACEPTADO: Check,
  VIAJE_INICIADO: Play,
  LLEGO_RETIRO: MapPinCheck,
  SALIO_RETIRO: Truck,
  LLEGO_DESTINO: Flag,
  SIN_SENAL: WifiOff,
  PEDIDO_SOLTADO: Undo2,
  PEDIDO_CANCELADO: X,
  NUEVA_SOLICITUD: Hand,
  SOLICITUD_URGENTE: Siren,
  HERRAMIENTA_VENCIDA: Wrench,
  DUPLICADO: CopyX,
  MATERIAL: PackageOpen,
  GENERAL: Bell,
};
