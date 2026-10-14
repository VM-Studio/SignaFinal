import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Moneda, SemaforoPE, TipoOrden } from "@prisma/client";
import { LOGO_PLANTILLA } from "./logo-oc";
import { importeTexto, TIPO_ORDEN } from "./estados";
import { SEMAFORO_PE } from "./estadoTablero";
import { diaISO } from "@/lib/formato";

/**
 * PDF DE LA ORDEN (A4, una hoja si entra), CALCADO del bloque de la planilla de Alejandra
 * (docs/plantilla-oc/, hoja "OC NUEVA" / "PEDIDOS ESPECIALES"): logo, título ORDEN DE COMPRA o PEDIDO
 * ESPECIAL, la grilla de dos columnas con las etiquetas exactas (1. Orden de Pedido a la izquierda;
 * 3. Facturación y 4. Orden de Pago a la derecha, solo si tienen datos), "1.1 Observaciones de la
 * Orden de Pedido." y "2. Autorización a la Orden de Pedido:" con el sello cuando está aprobada.
 * Sale SIEMPRE de los datos de la orden (nunca al revés).
 */

export type DatosPDFOC = {
  tipo: TipoOrden;
  numero: string | null;
  version: number;
  empresa: { nombre: string; cuit: string | null } | null;
  fechaPedido: Date;
  fechaCaducidad: Date | null;
  solicitadoPor: string;
  obra: string;
  direccionObra: string | null;
  detallePedido: string | null;
  renglones: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number | null; subtotal: number | null }[];
  proveedorSugerido: string | null;
  proveedorFinal: { nombre: string; cuit: string | null; sucursal: string | null; telefono: string | null; contacto: string | null } | null;
  presupuestoNumero: string | null;
  importe: number | null;
  importeAConfirmar: boolean;
  moneda: Moneda;
  cotizacionUsd: number | null;
  formaPago: string | null;
  condicionPago: string | null;
  fechaEntrega: Date | null;
  observaciones: string | null;
  semaforo: SemaforoPE | null;
  autorizacion: { estado: string; por: string | null; en: Date | null; motivo: string | null; aprobada: boolean };
  facturacion: { empresa: string | null; cuit: string | null; numero: string | null; importe: number | null; fecha: Date | null; formaPago: string | null; condicion: string | null } | null;
  ordenPago: { autorizadaPor: string | null; autorizadaEn: Date | null; fechaPago: Date | null; importe: number | null; observaciones: string | null } | null;
  creadaPor: string;
};

// Sin cortar palabras con guiones (react-pdf las parte por defecto).
Font.registerHyphenationCallback((palabra) => [palabra]);

const TINTA = "#111827";
const SUAVE = "#6b7280";
const LINEA = "#9ca3af"; // la grilla de la planilla: bordes finos grises
const FONDO_ETIQUETA = "#f3f4f6";
const OK = "#1f7a4d";
const CRITICO = "#b42318";

const e = StyleSheet.create({
  pagina: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 40, fontFamily: "Helvetica", fontSize: 8.5, color: TINTA },
  cabeza: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: LINEA },
  logoCaja: { width: 150, padding: 6, borderRightWidth: 1, borderRightColor: LINEA },
  logo: { width: 136, height: 50, objectFit: "contain" },
  titulo: { flex: 1, textAlign: "center", fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  numeroCaja: { width: 120, padding: 6, borderLeftWidth: 1, borderLeftColor: LINEA, alignItems: "flex-end" },
  numeroEtiqueta: { fontSize: 7, color: SUAVE },
  numero: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  semaforo: { marginTop: 6, flexDirection: "row", gap: 6, alignItems: "center" },
  columnas: { flexDirection: "row", gap: 10, marginTop: 10 },
  col: { flex: 1 },
  seccion: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 },
  grilla: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: LINEA },
  fila: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINEA },
  etiqueta: { width: 108, padding: 4, backgroundColor: FONDO_ETIQUETA, borderRightWidth: 1, borderRightColor: LINEA, fontFamily: "Helvetica-Bold" },
  valor: { flex: 1, padding: 4, borderRightWidth: 1, borderRightColor: LINEA },
  suave: { color: SUAVE },
  fuerte: { fontFamily: "Helvetica-Bold" },
  bloque: { marginTop: 10 },
  caja: { borderWidth: 1, borderColor: LINEA, padding: 6, minHeight: 34 },
  tabla: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderColor: LINEA },
  tFila: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINEA },
  tCant: { width: 44, padding: 3, textAlign: "right", borderRightWidth: 1, borderRightColor: LINEA },
  tUni: { width: 56, padding: 3, borderRightWidth: 1, borderRightColor: LINEA },
  tDesc: { flex: 1, padding: 3, borderRightWidth: 1, borderRightColor: LINEA },
  tPre: { width: 90, padding: 3, textAlign: "right", borderRightWidth: 1, borderRightColor: LINEA },
  sello: { marginTop: 4, borderWidth: 1.5, borderRadius: 3, padding: 6 },
  pie: { position: "absolute", left: 32, right: 32, bottom: 18, fontSize: 7, color: SUAVE, flexDirection: "row", justifyContent: "space-between" },
  marca: { position: "absolute", top: 330, left: -40, right: -40, textAlign: "center", fontSize: 80, color: "#e5e7eb", fontFamily: "Helvetica-Bold", transform: "rotate(-30deg)" },
});

/** dd/mm/aaaa del día argentino (las fechas sin hora de la base llegan a medianoche UTC: diaISO las toma tal cual). */
const fecha = (d: Date | null) => (d ? diaISO(d).split("-").reverse().join("/") : "");
const fechaHora = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};
const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

function Fila({ etiqueta, children, alto }: { etiqueta: string; children?: React.ReactNode; alto?: number }) {
  return (
    <View style={[e.fila, alto ? { minHeight: alto } : {}]} wrap={false}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <View style={e.valor}>{typeof children === "string" || children == null ? <Text>{children ?? ""}</Text> : children}</View>
    </View>
  );
}

export function DocumentoOC({ d, borrador = false }: { d: DatosPDFOC; borrador?: boolean }) {
  const t = TIPO_ORDEN[d.tipo];
  const conDerecha = !!(d.facturacion || d.ordenPago);
  const numero = d.numero ? `${d.numero}${d.version > 1 ? ` v${d.version}` : ""}` : "Se asigna al enviar";
  const prov = d.proveedorFinal;
  const conPrecios = d.renglones.some((r) => r.precioUnitario != null);
  const tono = d.autorizacion.aprobada ? OK : d.autorizacion.motivo ? CRITICO : SUAVE;

  const izquierda = (
    <View style={e.col}>
      <Text style={e.seccion}>1. Orden de Pedido</Text>
      <View style={e.grilla}>
        <Fila etiqueta="Empresa">{d.empresa ? `${d.empresa.nombre}${d.empresa.cuit ? ` (${d.empresa.cuit})` : ""}` : ""}</Fila>
        <Fila etiqueta="Fecha del pedido">{fecha(d.fechaPedido)}</Fila>
        <Fila etiqueta="Fecha de caducidad">{fecha(d.fechaCaducidad)}</Fila>
        <Fila etiqueta="N° de Orden">{d.numero ? numero : ""}</Fila>
        <Fila etiqueta="Solicitado por">{d.solicitadoPor}</Fila>
        <Fila etiqueta="Obra">
          <Text>{d.obra}</Text>
          {d.direccionObra ? <Text style={e.suave}>{d.direccionObra}</Text> : null}
        </Fila>
        <Fila etiqueta="Detalle del Pedido" alto={48}>
          {d.detallePedido ? <Text>{d.detallePedido}</Text> : d.renglones.length ? <Text style={e.suave}>Ver renglones abajo.</Text> : null}
        </Fila>
        <Fila etiqueta="Proveedor Sugerido">{d.proveedorSugerido ?? ""}</Fila>
        <Fila etiqueta="Proveedor Final">
          {prov ? (
            <>
              <Text>{prov.nombre}{prov.cuit ? ` · CUIT ${prov.cuit}` : ""}</Text>
              {prov.sucursal ? <Text style={e.suave}>{prov.sucursal}</Text> : null}
              {prov.contacto || prov.telefono ? <Text style={e.suave}>{[prov.contacto, prov.telefono].filter(Boolean).join(" · ")}</Text> : null}
            </>
          ) : null}
        </Fila>
        <Fila etiqueta="Presupuesto N°">{d.presupuestoNumero ?? ""}</Fila>
        <Fila etiqueta="Importe">
          <Text style={e.fuerte}>{d.importe != null || d.importeAConfirmar ? importeTexto(d.importe, d.moneda, d.importeAConfirmar) : ""}</Text>
          {d.moneda === "USD" && d.cotizacionUsd ? <Text style={e.suave}>Dólar del día: $ {num(d.cotizacionUsd)}</Text> : null}
        </Fila>
        <Fila etiqueta="Forma de Pago">{d.formaPago ?? ""}</Fila>
        <Fila etiqueta="Condición de Pago">{d.condicionPago ?? ""}</Fila>
        <Fila etiqueta="Fecha de entrega">{fecha(d.fechaEntrega)}</Fila>
      </View>
    </View>
  );

  const derecha = conDerecha ? (
    <View style={[e.col, { maxWidth: 230 }]}>
      {d.facturacion && (
        <View>
          <Text style={e.seccion}>3. Facturación</Text>
          <View style={e.grilla}>
            <Fila etiqueta="Empresa para Facturar">{d.facturacion.empresa ?? ""}</Fila>
            <Fila etiqueta="Cuit">{d.facturacion.cuit ?? ""}</Fila>
            <Fila etiqueta="Factura N°">{d.facturacion.numero ?? ""}</Fila>
            <Fila etiqueta="Importe">{d.facturacion.importe != null ? importeTexto(d.facturacion.importe, d.moneda) : ""}</Fila>
            <Fila etiqueta="Fecha">{fecha(d.facturacion.fecha)}</Fila>
            <Fila etiqueta="Forma de Pago">{d.facturacion.formaPago ?? ""}</Fila>
            <Fila etiqueta="Condición de Pago">{d.facturacion.condicion ?? ""}</Fila>
          </View>
        </View>
      )}
      {d.ordenPago && (
        <View style={d.facturacion ? e.bloque : undefined}>
          <Text style={e.seccion}>4. Orden de Pago</Text>
          <View style={e.grilla}>
            <Fila etiqueta="Autorización a la Orden de Pago">{d.ordenPago.autorizadaPor ? `${d.ordenPago.autorizadaPor}${d.ordenPago.autorizadaEn ? ` · ${fechaHora(d.ordenPago.autorizadaEn)}` : ""}` : ""}</Fila>
            <Fila etiqueta="Fecha de Pago">{fecha(d.ordenPago.fechaPago)}</Fila>
            <Fila etiqueta="Importe pagado">{d.ordenPago.importe != null ? importeTexto(d.ordenPago.importe, d.moneda) : ""}</Fila>
            <Fila etiqueta="Observaciones">{d.ordenPago.observaciones ?? ""}</Fila>
          </View>
        </View>
      )}
    </View>
  ) : null;

  return (
    <Document title={d.numero ? `${t.titulo} ${d.numero}` : `${t.titulo} (borrador)`} author="Signa Desarrollos" creator="Signa Logística">
      <Page size="A4" style={e.pagina}>
        {borrador && <Text style={e.marca} fixed>BORRADOR</Text>}
        <View style={e.cabeza}>
          <View style={e.logoCaja}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_PLANTILLA} style={e.logo} />
          </View>
          <Text style={e.titulo}>{t.tituloPDF}</Text>
          <View style={e.numeroCaja}>
            <Text style={e.numeroEtiqueta}>N° de Orden</Text>
            <Text style={e.numero}>{numero}</Text>
          </View>
        </View>
        {d.tipo === "PE" && d.semaforo && (
          <View style={e.semaforo}>
            <Text style={e.fuerte}>ESTADO DE LA ORDEN:</Text>
            <Text>{SEMAFORO_PE[d.semaforo].titulo.toUpperCase()}{SEMAFORO_PE[d.semaforo].detalle ? ` (${SEMAFORO_PE[d.semaforo].detalle.toUpperCase()})` : ""}</Text>
          </View>
        )}

        <View style={e.columnas}>
          {izquierda}
          {derecha}
        </View>

        {d.renglones.length > 0 && (
          <View style={e.bloque}>
            <Text style={e.seccion}>Renglones del pedido</Text>
            <View style={e.tabla}>
              <View style={[e.tFila, { backgroundColor: FONDO_ETIQUETA }]}>
                <Text style={[e.tCant, e.fuerte]}>Cant.</Text>
                <Text style={[e.tUni, e.fuerte]}>Unidad</Text>
                <Text style={[e.tDesc, e.fuerte]}>Material</Text>
                {conPrecios && <Text style={[e.tPre, e.fuerte]}>Precio unit.</Text>}
              </View>
              {d.renglones.map((r, i) => (
                <View key={i} style={e.tFila} wrap={false}>
                  <Text style={e.tCant}>{num(r.cantidad)}</Text>
                  <Text style={e.tUni}>{r.unidad}</Text>
                  <Text style={e.tDesc}>{r.descripcion}</Text>
                  {conPrecios && <Text style={e.tPre}>{r.precioUnitario != null ? importeTexto(r.precioUnitario, d.moneda) : ""}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={e.bloque} wrap={false}>
          <Text style={e.seccion}>1.1 Observaciones de la Orden de Pedido.</Text>
          <View style={e.caja}><Text>{d.observaciones ?? ""}</Text></View>
        </View>

        <View style={e.bloque} wrap={false}>
          <Text style={e.seccion}>2. Autorización a la Orden de Pedido:</Text>
          <View style={[e.sello, { borderColor: tono, color: tono }]}>
            <Text style={e.fuerte}>{d.autorizacion.estado.toUpperCase()}</Text>
            {d.autorizacion.aprobada && d.autorizacion.por && d.autorizacion.en ? (
              <Text>Autorizó {d.autorizacion.por} el {fechaHora(d.autorizacion.en)} · {numero} · firma digital en el sistema de Signa.</Text>
            ) : null}
            {d.autorizacion.motivo ? <Text>Motivo: {d.autorizacion.motivo}</Text> : null}
          </View>
        </View>

        <View style={e.pie} fixed>
          <Text>Signa Desarrollos · {t.titulo} {d.numero ?? "(borrador)"} · armó {d.creadaPor}</Text>
          <Text render={({ pageNumber, totalPages }) => `Hoja ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** El PDF como Buffer (para guardarlo en Blob, servirlo o probarlo). */
export async function generarPDFOC(d: DatosPDFOC, opciones: { borrador?: boolean } = {}) {
  return renderToBuffer(<DocumentoOC d={d} borrador={opciones.borrador} />);
}
