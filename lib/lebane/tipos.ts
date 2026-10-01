/**
 * Contrato con Lebane (sistema de gestión). Lebane es dueño de obras, proveedores
 * y órdenes de compra; esta app solo los lee. Cuando haya API real, se implementa
 * ClienteLebane contra ella y no cambia nada más.
 */

export type ObraLebane = {
  idLebane: string;
  nombre: string;
  direccion: string;
  localidad?: string;
  lat?: number;
  lng?: number;
  activa: boolean;
};

export type ProveedorLebane = {
  idLebane: string;
  nombre: string;
  rubro?: string;
  direccion: string;
  localidad?: string;
  lat?: number;
  lng?: number;
  telefono?: string;
  activo: boolean;
};

export type OrdenCompraLebane = {
  idLebane: string;
  numero: string;
  fecha: string; // ISO yyyy-mm-dd
  descripcion: string;
  pesoEstimadoKg?: number;
  abierta: boolean;
  idLebaneProveedor: string;
  idLebaneObra: string;
};

export interface ClienteLebane {
  readonly origen: "mock" | "api";
  listarObras(): Promise<ObraLebane[]>;
  listarProveedores(): Promise<ProveedorLebane[]>;
  listarOrdenesCompra(): Promise<OrdenCompraLebane[]>;
}
