import "server-only";
import { leerBuffer } from "@/lib/archivos";
import { esExcelLegible, leerListaExcel, type RenglonLista } from "./leerLista";

/**
 * Los materiales de las planillas Excel (.xlsx) adjuntas, en el orden en que se adjuntaron. Un archivo que no se
 * puede leer no corta nada: queda adjunto igual y Compras lo abre.
 */
export async function materialesDeExcels(adjuntos: { url: string; nombre: string }[]): Promise<{ renglones: RenglonLista[]; archivos: string[] }> {
  const renglones: RenglonLista[] = [];
  const archivos: string[] = [];
  for (const a of adjuntos.filter((x) => esExcelLegible(x.nombre))) {
    try {
      const datos = await leerBuffer(a.url);
      const rs = datos ? await leerListaExcel(datos) : [];
      if (rs.length) {
        renglones.push(...rs);
        archivos.push(a.nombre);
      }
    } catch (e) {
      console.error(`No se pudo leer la lista ${a.nombre}`, e);
    }
  }
  return { renglones, archivos };
}
