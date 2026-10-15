import "server-only";
import type { EstadoOC, TipoOrden } from "@prisma/client";
import type { ValoresCeldas } from "./permisosCeldas";
import { textosDe, type DocumentoDb } from "./celdas";
import { TIPO_ORDEN } from "./estados";

/**
 * LA HOJA IMPRESA: lo que se ve en la plantilla en modo lectura, en /compras/oc/[id]/imprimir y en el PDF
 * (que es esa misma ruta impresa por Chromium, o el respaldo de @react-pdf con la misma grilla).
 */
export type HojaImpresa = {
  tipo: TipoOrden;
  titulo: string;
  color: string;
  estado: EstadoOC;
  textos: Required<ValoresCeldas>;
  /** 2. Autorización a la Orden de Pedido */
  autorizacion: { texto: string | null; por: string | null; en: string | null; rechazo: string | null };
  /** 4. Autorización a la Orden de Pago */
  pago: { pedidoPor: string | null; autorizadoPor: string | null; en: string | null };
};

const fechaHora = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

export function hojaDe(d: DocumentoDb): HojaImpresa {
  const t = TIPO_ORDEN[d.tipo];
  const autorizada = !!d.aprobadaEn && ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(d.estado);
  return {
    tipo: d.tipo,
    titulo: t.tituloPDF,
    color: t.color,
    estado: d.estado,
    textos: textosDe(d),
    autorizacion: {
      texto: autorizada ? `AUTORIZADA por ${d.aprobadaPor?.nombre ?? "Dirección"}` : d.estado === "ESPERANDO_AUTORIZACION" ? "Esperando autorización" : d.estado === "ANULADA" ? "ANULADA" : null,
      por: autorizada ? d.aprobadaPor?.nombre ?? null : null,
      en: autorizada && d.aprobadaEn ? fechaHora(d.aprobadaEn) : null,
      rechazo: d.motivoRechazo,
    },
    pago: {
      pedidoPor: d.pagoSolicitadoEn ? d.pagoSolicitadoPor?.nombre ?? null : null,
      autorizadoPor: d.ordenPagoAutorizadaEn ? d.ordenPagoAutorizadaPor?.nombre ?? "Dirección" : null,
      en: d.ordenPagoAutorizadaEn ? fechaHora(d.ordenPagoAutorizadaEn) : null,
    },
  };
}
