import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { HojaImpresa } from "./hoja";
import type { Celda } from "./permisosCeldas";

/**
 * RESPALDO DEL PDF (si Chromium no está disponible): la MISMA grilla de docs/plantilla-oc/orden-de-compra.pdf
 * dibujada con @react-pdf, en puntos de A4 (595 × 842), con las posiciones medidas del original. El PDF
 * principal es /compras/oc/[id]/imprimir impreso por Chromium (src/lib/compras/pdf.ts).
 */
Font.registerHyphenationCallback((palabra) => [palabra]);

const LINEA = "#000000";
const e = StyleSheet.create({
  pagina: { fontFamily: "Helvetica", fontSize: 6.6, color: "#000" },
  marco: { position: "absolute", left: 50, top: 54, width: 497, height: 703, borderWidth: 0.8, borderColor: LINEA },
  titulo: { position: "absolute", left: 83, top: 80, width: 431, height: 18, borderWidth: 0.8, borderColor: LINEA, justifyContent: "center", alignItems: "center" },
  tituloTexto: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  encabezado: { position: "absolute", borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: LINEA, justifyContent: "flex-end", paddingBottom: 2 },
  encabezadoTexto: { fontFamily: "Helvetica-Oblique", fontSize: 6.2 },
  fila: { flexDirection: "row", borderColor: LINEA, borderLeftWidth: 0.6, borderRightWidth: 0.6, borderBottomWidth: 0.6 },
  etiqueta: { borderRightWidth: 0.6, borderColor: LINEA, paddingHorizontal: 2, paddingTop: 2.6 },
  valor: { flex: 1, paddingHorizontal: 3, paddingTop: 2.6 },
  caja: { position: "absolute", borderWidth: 0.6, borderColor: LINEA },
  sello: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#1F7A4D" },
});

type Pos = { left: number; top: number; width: number };
const IZQ: Pos = { left: 83, top: 138, width: 224 };
const DER: Pos = { left: 347, top: 138, width: 167 };
const FILA = 13.6;

function Tabla({ pos, etiquetaAncho, filas, h, textos }: { pos: Pos; etiquetaAncho: number; filas: [Celda, string][]; h?: number; textos: HojaImpresa["textos"] }) {
  return (
    <View style={{ position: "absolute", left: pos.left, top: pos.top, width: pos.width, borderTopWidth: 0.6, borderColor: LINEA }}>
      {filas.map(([c, etiqueta]) => (
        <View key={c} style={[e.fila, { height: h ?? FILA }]}>
          <Text style={[e.etiqueta, { width: etiquetaAncho }]}>{etiqueta}</Text>
          <Text style={e.valor}>{textos[c]}</Text>
        </View>
      ))}
    </View>
  );
}

function Encabezado({ left, top, width, texto, negrita = false }: { left: number; top: number; width: number; texto: string; negrita?: boolean }) {
  return (
    <View style={[e.encabezado, { left, top, width, height: 13 }]}>
      <Text style={[e.encabezadoTexto, negrita ? { fontFamily: "Helvetica-BoldOblique" } : {}]}>{texto}</Text>
    </View>
  );
}

function HojaPDF({ h }: { h: HojaImpresa }) {
  const t = h.textos;
  return (
    <Document title={`${h.titulo} ${t.nDeOrden}`.trim()} author="SIGNA">
      <Page size="A4" style={e.pagina}>
        <View style={e.marco} />
        <View style={[e.titulo, { backgroundColor: h.color }]}><Text style={e.tituloTexto}>{h.titulo}</Text></View>

        {/* 1. Orden de Pedido */}
        <Encabezado left={IZQ.left} top={109} width={IZQ.width} texto="1. Orden de Pedido" />
        <Tabla pos={IZQ} etiquetaAncho={63} textos={t} filas={[["empresa", "Empresa"], ["fechaPedido", "Fecha del pedido"], ["fechaCaducidad", "Fecha de caducidad"], ["nDeOrden", "N° de Orden"], ["solicitadoPor", "Solicitado por"], ["obra", "Obra"]]} />
        <View style={[e.caja, { left: IZQ.left, top: 232, width: IZQ.width, height: 291, flexDirection: "row" }]}>
          <View style={{ width: 63, borderRightWidth: 0.6, borderColor: LINEA, justifyContent: "center", paddingHorizontal: 2 }}><Text>Detalle del Pedido</Text></View>
          <Text style={{ flex: 1, padding: 3, lineHeight: 1.3 }}>{t.detalleDelPedido}</Text>
        </View>
        <Tabla pos={{ ...IZQ, top: 523 }} etiquetaAncho={63} textos={t} filas={[["proveedorSugerido", "Proveedor Sugerido"], ["proveedorFinal", "Proveedor Final"], ["presupuestoN", "Presupuesto N°"], ["importe", "Importe"], ["formaDePago", "Forma de Pago"]]} />
        <Encabezado left={IZQ.left} top={603} width={IZQ.width} texto="1.1 Observaciones de la Orden de Pedido." />
        <Text style={{ position: "absolute", left: IZQ.left + 2, top: 620, width: IZQ.width - 4 }}>{t.observacionesOrdenPedido}</Text>
        <Encabezado left={IZQ.left} top={665} width={IZQ.width} texto="2. Autorización a la Orden de Pedido:" negrita />
        <View style={{ position: "absolute", left: IZQ.left + 2, top: 684, width: IZQ.width - 4 }}>
          {h.autorizacion.texto && <Text style={h.autorizacion.por ? e.sello : {}}>{h.autorizacion.texto}</Text>}
          {h.autorizacion.en && <Text style={{ marginTop: 2 }}>{h.autorizacion.en}</Text>}
        </View>
        <View style={{ position: "absolute", left: IZQ.left, top: 731, width: IZQ.width, borderTopWidth: 0.6, borderColor: LINEA }} />

        {/* 3. Facturación */}
        <Encabezado left={DER.left} top={109} width={DER.width} texto="3. Facturación" />
        <Tabla pos={DER} etiquetaAncho={74} textos={t} filas={[["empresaParaFacturar", "Empresa para Facturar"], ["cuit", "Cuit"], ["facturaN", "Factura N°"], ["facturaImporte", "Importe"], ["facturaFormaDePago", "Forma de Pago"], ["condicionDePago", "Condición de Pago"]]} />

        {/* 4. Orden de Pago */}
        <View style={[e.caja, { left: DER.left, top: 523, width: DER.width, height: 13, justifyContent: "center", paddingHorizontal: 2 }]}>
          <Text style={{ fontFamily: "Helvetica-BoldOblique" }}>4. Orden de Pago</Text>
        </View>
        <View style={[e.caja, { left: DER.left, top: 550, width: DER.width, height: 100, flexDirection: "row" }]}>
          <View style={{ width: 74, borderRightWidth: 0.6, borderColor: LINEA, justifyContent: "center", paddingHorizontal: 2 }}><Text>Autorización a la Orden de Pago</Text></View>
          <View style={{ flex: 1, padding: 3, justifyContent: "center" }}>
            {h.pago.autorizadoPor ? <><Text style={e.sello}>AUTORIZADO</Text><Text>por {h.pago.autorizadoPor}</Text><Text>{h.pago.en}</Text></> : h.pago.pedidoPor ? <Text>Pedida por {h.pago.pedidoPor}</Text> : null}
          </View>
        </View>
        <Tabla pos={{ ...DER, top: 650 }} etiquetaAncho={74} textos={t} filas={[["fechaDePago", "Fecha de Pago"]]} />
      </Page>
    </Document>
  );
}

export async function pdfConReactPdf(h: HojaImpresa) {
  return renderToBuffer(<HojaPDF h={h} />);
}
