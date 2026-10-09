import {
  AlertTriangle, Building2, Fuel, HardHat, Home, ListOrdered, Map, Menu, PackageCheck, PlusCircle, Route,
  Store, Truck, UserCircle2, Users, Wrench, Warehouse, Boxes, CalendarClock, CircleDollarSign, Sun, Bell, Activity, FileUp, ShoppingCart, PackageOpen, Stamp, SatelliteDish, type LucideIcon,
} from "lucide-react";
import type { Icono } from "@/lib/navegacion";

export const ICONOS: Record<Icono, LucideIcon> = {
  inicio: Home, pedidos: ListOrdered, pedir: PlusCircle, viajes: Route, combustible: Fuel, flota: Truck,
  mantenimiento: HardHat, herramientas: Wrench, deposito: Warehouse, entregas: PackageCheck, sobrantes: Boxes,
  mapa: Map, alertas: AlertTriangle, obras: Building2, proveedores: Store, usuarios: Users, cuenta: UserCircle2, mas: Menu,
  agenda: CalendarClock, costos: CircleDollarSign,
  hoy: Sun, avisos: Bell, actividad: Activity, importar: FileUp,
  compras: ShoppingCart, habilitados: PackageOpen, aprobaciones: Stamp, rastreo: SatelliteDish,
};
