import type { ClienteLebane, ObraLebane, OrdenCompraLebane, ProveedorLebane } from "./tipos";

/**
 * Datos de ejemplo mientras no haya acceso a la API de Lebane.
 * Direcciones y coordenadas aproximadas: se reemplazan solas al conectar la API.
 */

const OBRAS: ObraLebane[] = [
  { idLebane: "OB-101", nombre: "Darwin", direccion: "Darwin 1154", localidad: "CABA", lat: -34.5925, lng: -58.4376, activa: true },
  { idLebane: "OB-102", nombre: "Pinares II", direccion: "Av. de los Lagos 7008", localidad: "Nordelta", lat: -34.4092, lng: -58.6461, activa: true },
  { idLebane: "OB-103", nombre: "Chubut", direccion: "Chubut 1621", localidad: "Olivos", lat: -34.5081, lng: -58.4952, activa: true },
  { idLebane: "OB-104", nombre: "Gaspar Campos", direccion: "Gaspar Campos 1950", localidad: "Vicente López", lat: -34.5226, lng: -58.4876, activa: true },
  { idLebane: "OB-105", nombre: "Laura Thomas", direccion: "Laura Thomas 2450", localidad: "San Isidro", lat: -34.4733, lng: -58.5307, activa: true },
  { idLebane: "OB-106", nombre: "Libertador 14500", direccion: "Av. del Libertador 14500", localidad: "Martínez", lat: -34.4874, lng: -58.4982, activa: true },
  { idLebane: "OB-107", nombre: "Alvear", direccion: "Alvear 2210", localidad: "Martínez", lat: -34.4951, lng: -58.5154, activa: true },
  { idLebane: "OB-108", nombre: "Fondo de la Legua", direccion: "Fondo de la Legua 1300", localidad: "Boulogne", lat: -34.4961, lng: -58.5545, activa: true },
];

const PROVEEDORES: ProveedorLebane[] = [
  { idLebane: "PR-201", nombre: "Corralón El Ceibo", rubro: "Corralón", direccion: "Av. Fondo de la Legua 1850", localidad: "San Isidro", lat: -34.5019, lng: -58.5463, telefono: "11 4743-2200", activo: true },
  { idLebane: "PR-202", nombre: "Hierros Martínez", rubro: "Hierro", direccion: "Av. Santa Fe 2900", localidad: "Martínez", lat: -34.4921, lng: -58.5101, telefono: "11 4792-8811", activo: true },
  { idLebane: "PR-203", nombre: "Sanitarios Norte", rubro: "Sanitarios", direccion: "Av. Maipú 2100", localidad: "Olivos", lat: -34.5138, lng: -58.4915, telefono: "11 4799-3030", activo: true },
  { idLebane: "PR-204", nombre: "Eléctrica Libertador", rubro: "Electricidad", direccion: "Av. del Libertador 13100", localidad: "Martínez", lat: -34.4969, lng: -58.4934, telefono: "11 4798-1414", activo: true },
  { idLebane: "PR-205", nombre: "Maderera Boulogne", rubro: "Maderas", direccion: "Av. Avelino Rolón 1500", localidad: "Boulogne", lat: -34.4985, lng: -58.5712, telefono: "11 4737-5050", activo: true },
  { idLebane: "PR-206", nombre: "Hormigonera Panamericana", rubro: "Hormigón", direccion: "Colectora Panamericana 2400", localidad: "Munro", lat: -34.5268, lng: -58.5229, telefono: "11 4756-9000", activo: true },
  { idLebane: "PR-207", nombre: "Andamios del Norte", rubro: "Alquiler de equipos", direccion: "Av. Márquez 900", localidad: "San Isidro", lat: -34.4832, lng: -58.5465, telefono: "11 4747-2121", activo: true },
  { idLebane: "PR-208", nombre: "Pinturerías Rex Tigre", rubro: "Pinturería", direccion: "Av. Cazón 1200", localidad: "Tigre", lat: -34.4246, lng: -58.5806, telefono: "11 4749-6060", activo: true },
];

function hoyMenos(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

const ORDENES: OrdenCompraLebane[] = [
  { idLebane: "OC-3001", numero: "OC 3001", fecha: hoyMenos(2), descripcion: "120 bolsas de cemento + 40 de cal", pesoEstimadoKg: 6800, abierta: true, idLebaneProveedor: "PR-201", idLebaneObra: "OB-101" },
  { idLebane: "OC-3002", numero: "OC 3002", fecha: hoyMenos(1), descripcion: "Hierro del 8 y del 10, 60 barras", pesoEstimadoKg: 2400, abierta: true, idLebaneProveedor: "PR-202", idLebaneObra: "OB-103" },
  { idLebane: "OC-3003", numero: "OC 3003", fecha: hoyMenos(3), descripcion: "Caños PPF 20 y 25 + accesorios", pesoEstimadoKg: 180, abierta: true, idLebaneProveedor: "PR-203", idLebaneObra: "OB-104" },
  { idLebane: "OC-3004", numero: "OC 3004", fecha: hoyMenos(1), descripcion: "Cable 2,5 mm x 10 rollos + cajas", pesoEstimadoKg: 120, abierta: true, idLebaneProveedor: "PR-204", idLebaneObra: "OB-105" },
  { idLebane: "OC-3005", numero: "OC 3005", fecha: hoyMenos(4), descripcion: "Tirantes y fenólicos para encofrado", pesoEstimadoKg: 3200, abierta: true, idLebaneProveedor: "PR-205", idLebaneObra: "OB-102" },
  { idLebane: "OC-3006", numero: "OC 3006", fecha: hoyMenos(0), descripcion: "Ladrillos huecos 18 x 3000 u.", pesoEstimadoKg: 4500, abierta: true, idLebaneProveedor: "PR-201", idLebaneObra: "OB-106" },
  { idLebane: "OC-3007", numero: "OC 3007", fecha: hoyMenos(2), descripcion: "Látex exterior 20 l x 12", pesoEstimadoKg: 300, abierta: true, idLebaneProveedor: "PR-208", idLebaneObra: "OB-102" },
  { idLebane: "OC-3008", numero: "OC 3008", fecha: hoyMenos(5), descripcion: "Malla sima y alambre", pesoEstimadoKg: 1500, abierta: true, idLebaneProveedor: "PR-202", idLebaneObra: "OB-107" },
  { idLebane: "OC-3009", numero: "OC 3009", fecha: hoyMenos(6), descripcion: "Arena y piedra 6 m³", pesoEstimadoKg: 9000, abierta: false, idLebaneProveedor: "PR-201", idLebaneObra: "OB-108" },
];

export class LebaneMock implements ClienteLebane {
  readonly origen = "mock" as const;
  async listarObras() {
    return OBRAS;
  }
  async listarProveedores() {
    return PROVEEDORES;
  }
  async listarOrdenesCompra() {
    return ORDENES;
  }
}
