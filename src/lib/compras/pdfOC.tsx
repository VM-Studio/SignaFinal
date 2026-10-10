import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { MetodoPago, Moneda } from "@prisma/client";
import { LOGO_SIGNA } from "./logo";
import { METODO_PAGO } from "./estados";
import { diaISO } from "@/lib/formato";

/**
 * PDF DE LA ORDEN DE COMPRA (A4, una hoja). Sale SIEMPRE de los datos de la OC (nunca al revés).
 * Diseño sobrio con el logo de Signa, en el mismo orden que el formulario: encabezado, proveedor,
 * entrega, materiales, pago y totales, observaciones y firmas. Cuando llegue la plantilla real de
 * Signa (docs/plantilla-oc/), se ajusta acá (estilos y bloques) sin tocar el resto.
 */

export type DatosPDFOC = {
  numero: string | null;
  fecha: Date;
  fechaNecesaria: Date | null;
  obra: { nombre: string; direccion: string };
  sede: string | null;
  solicitante: string;
  creadaPor: string;
  proveedor: { nombre: string; cuit: string | null; telefono: string | null; email: string | null } | null;
  sucursal: { nombre: string; direccion: string; telefono: string | null; contacto: string | null; horario: string | null } | null;
  renglones: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number | null; subtotal: number | null }[];
  metodoPago: MetodoPago | null;
  moneda: Moneda;
  condiciones: string | null;
  subtotal: number | null;
  ivaPorcentaje: number | null;
  iva: number | null;
  total: number | null;
  observaciones: string | null;
  aprobada: { por: string; en: Date } | null;
};

// Sin cortar palabras con guiones (react-pdf las parte por defecto).
Font.registerHyphenationCallback((palabra) => [palabra]);

const NEGRO = "#0a0a0a";
const TINTA = "#111827";
const SUAVE = "#6b7280";
const LINEA = "#e5e7eb";
const OK = "#1f7a4d";

const e = StyleSheet.create({
  pagina: { paddingBottom: 48, fontFamily: "Helvetica", fontSize: 9, color: TINTA },
  banda: { backgroundColor: NEGRO, paddingHorizontal: 36, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 120, height: 45 },
  tituloOC: { color: "#ffffff", fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  numeroOC: { color: "#ffffff", fontSize: 12, textAlign: "right", marginTop: 2 },
  cuerpo: { paddingHorizontal: 36, paddingTop: 18 },
  fila: { flexDirection: "row", gap: 12 },
  caja: { flex: 1, borderWidth: 1, borderColor: LINEA, borderRadius: 4, padding: 8 },
  cajaSola: { borderWidth: 1, borderColor: LINEA, borderRadius: 4, padding: 8 },
  etiqueta: { fontSize: 7, color: SUAVE, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  fuerte: { fontFamily: "Helvetica-Bold" },
  suave: { color: SUAVE },
  seccion: { marginTop: 12 },
  tabla: { borderWidth: 1, borderColor: LINEA, borderRadius: 4 },
  cabezaTabla: { flexDirection: "row", backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: LINEA, paddingVertical: 5, paddingHorizontal: 6 },
  filaTabla: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINEA, paddingVertical: 5, paddingHorizontal: 6 },
  cN: { width: 18, color: SUAVE },
  cDesc: { flex: 1, paddingRight: 6 },
  cCant: { width: 52, textAlign: "right" },
  cUni: { width: 44, paddingLeft: 6 },
  cPre: { width: 70, textAlign: "right" },
  cSub: { width: 74, textAlign: "right" },
  totales: { marginTop: 8, alignSelf: "flex-end", width: 220 },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  firmas: { position: "absolute", left: 36, right: 36, bottom: 64, flexDirection: "row", gap: 48 },
  firma: { flex: 1, borderTopWidth: 1, borderTopColor: TINTA, paddingTop: 4, textAlign: "center" },
  pie: { position: "absolute", left: 36, right: 36, bottom: 24, fontSize: 7, color: SUAVE, flexDirection: "row", justifyContent: "space-between" },
  marca: { position: "absolute", top: 330, left: -40, right: -40, textAlign: "center", fontSize: 80, color: "#e5e7eb", fontFamily: "Helvetica-Bold", transform: "rotate(-30deg)" },
  sello: { marginTop: 10, borderWidth: 1.5, borderColor: OK, borderRadius: 4, padding: 8, color: OK },
});

/** dd/mm/aaaa del día argentino (las fechas sin hora de la base llegan a medianoche UTC: diaISO las toma tal cual). */
const fecha = (d: Date) => diaISO(d).split("-").reverse().join("/");
const fechaHora = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} a las ${p.hour}:${p.minute}`;
};
const plata = (n: number, moneda: Moneda) => `${moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function DocumentoOC({ d, borrador = false }: { d: DatosPDFOC; borrador?: boolean }) {
  const conPrecios = d.total != null;
  return (
    <Document title={d.numero ? `Orden de compra ${d.numero}` : "Orden de compra (borrador)"} author="Signa Desarrollos" creator="Signa Logística">
      <Page size="A4" style={e.pagina}>
        {borrador && <Text style={e.marca} fixed>BORRADOR</Text>}
        <View style={e.banda}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_SIGNA} style={e.logo} />
          <View>
            <Text style={e.tituloOC}>ORDEN DE COMPRA</Text>
            <Text style={e.numeroOC}>{d.numero ?? "Sin número (borrador)"}</Text>
          </View>
        </View>

        <View style={e.cuerpo}>
          <View style={e.fila}>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Fecha de emisión</Text>
              <Text style={e.fuerte}>{fecha(d.fecha)}</Text>
            </View>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Fecha necesaria</Text>
              <Text style={e.fuerte}>{d.fechaNecesaria ? fecha(d.fechaNecesaria) : "—"}</Text>
            </View>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Solicitante</Text>
              <Text style={e.fuerte}>{d.solicitante}</Text>
            </View>
          </View>

          <View style={[e.fila, e.seccion]}>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Proveedor</Text>
              <Text style={e.fuerte}>{d.proveedor?.nombre ?? "—"}</Text>
              {d.proveedor?.cuit ? <Text>CUIT {d.proveedor.cuit}</Text> : null}
              {d.sucursal ? <Text>{d.sucursal.nombre} · {d.sucursal.direccion}</Text> : null}
              {d.sucursal?.telefono || d.proveedor?.telefono ? <Text>Tel. {d.sucursal?.telefono ?? d.proveedor?.telefono}</Text> : null}
              {d.sucursal?.contacto ? <Text>Contacto: {d.sucursal.contacto}</Text> : null}
              {d.sucursal?.horario ? <Text style={e.suave}>Horario: {d.sucursal.horario}</Text> : null}
              {d.proveedor?.email ? <Text style={e.suave}>{d.proveedor.email}</Text> : null}
            </View>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Obra y entrega</Text>
              <Text style={e.fuerte}>Obra {d.obra.nombre}{d.sede ? ` · ${d.sede}` : ""}</Text>
              <Text>{d.obra.direccion}</Text>
            </View>
          </View>

          <View style={e.seccion}>
            <Text style={e.etiqueta}>Materiales</Text>
            <View style={e.tabla}>
              <View style={e.cabezaTabla}>
                <Text style={[e.cN, e.fuerte]}>#</Text>
                <Text style={[e.cDesc, e.fuerte]}>Descripción</Text>
                <Text style={[e.cCant, e.fuerte]}>Cantidad</Text>
                <Text style={[e.cUni, e.fuerte]}>Unidad</Text>
                {conPrecios && <Text style={[e.cPre, e.fuerte]}>Precio unit.</Text>}
                {conPrecios && <Text style={[e.cSub, e.fuerte]}>Subtotal</Text>}
              </View>
              {d.renglones.map((r, i) => (
                <View key={i} style={e.filaTabla} wrap={false}>
                  <Text style={e.cN}>{i + 1}</Text>
                  <Text style={e.cDesc}>{r.descripcion}</Text>
                  <Text style={e.cCant}>{num(r.cantidad)}</Text>
                  <Text style={e.cUni}>{r.unidad}</Text>
                  {conPrecios && <Text style={e.cPre}>{r.precioUnitario != null ? plata(r.precioUnitario, d.moneda) : "—"}</Text>}
                  {conPrecios && <Text style={e.cSub}>{r.subtotal != null ? plata(r.subtotal, d.moneda) : "—"}</Text>}
                </View>
              ))}
              {!d.renglones.length && <View style={e.filaTabla}><Text style={e.suave}>Según presupuesto adjunto.</Text></View>}
            </View>
            {conPrecios ? (
              <View style={e.totales}>
                <View style={e.filaTotal}><Text>Subtotal</Text><Text>{plata(d.subtotal ?? 0, d.moneda)}</Text></View>
                <View style={e.filaTotal}><Text>{d.ivaPorcentaje != null ? `IVA ${num(d.ivaPorcentaje)} %` : d.iva ? "IVA" : "Sin IVA"}</Text><Text>{plata(d.iva ?? 0, d.moneda)}</Text></View>
                <View style={[e.filaTotal, { borderTopWidth: 1, borderTopColor: TINTA, marginTop: 2, paddingTop: 4 }]}><Text style={e.fuerte}>Total</Text><Text style={e.fuerte}>{plata(d.total ?? 0, d.moneda)}</Text></View>
              </View>
            ) : (
              <Text style={[e.suave, { marginTop: 6 }]}>Precios: según presupuesto adjunto.</Text>
            )}
          </View>

          <View style={[e.fila, e.seccion]}>
            <View style={e.caja}>
              <Text style={e.etiqueta}>Método de pago</Text>
              <Text style={e.fuerte}>{d.metodoPago ? METODO_PAGO[d.metodoPago] : "—"}{d.moneda === "USD" ? " · en dólares" : ""}</Text>
            </View>
            <View style={[e.caja, { flex: 2 }]}>
              <Text style={e.etiqueta}>Condiciones</Text>
              <Text>{d.condiciones || "—"}</Text>
            </View>
          </View>

          {d.observaciones ? (
            <View style={[e.cajaSola, e.seccion]}>
              <Text style={e.etiqueta}>Observaciones</Text>
              <Text>{d.observaciones}</Text>
            </View>
          ) : null}

          {d.aprobada && (
            <View style={e.sello}>
              <Text style={e.fuerte}>APROBADA por {d.aprobada.por} el {fechaHora(d.aprobada.en)}</Text>
              <Text>Firma digital: {d.aprobada.por} · {d.numero} · aprobada en el sistema de Signa Logística.</Text>
            </View>
          )}
        </View>

        <View style={e.firmas} fixed>
          <Text style={e.firma}>Compras{"\n"}{d.creadaPor}</Text>
          <Text style={e.firma}>Autorizó{"\n"}{d.aprobada?.por ?? ""}</Text>
        </View>
        <View style={e.pie} fixed>
          <Text>Signa Desarrollos · {d.numero ?? "Borrador"}</Text>
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
