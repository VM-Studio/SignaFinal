import type { HTMLAttributes, ReactNode } from "react";
import type { Celda } from "@/lib/compras/permisosCeldas";

/**
 * LA HOJA (docs/plantilla-oc/orden-de-compra.pdf, calcada): A4, título en la franja de color según el tipo
 * (celeste ORDEN DE COMPRA, verde PEDIDO ESPECIAL), dos columnas: 1. Orden de Pedido, 1.1 Observaciones y
 * 2. Autorización a la izquierda; 3. Facturación y 4. Orden de Pago a la derecha. La misma para editar (cada
 * celda de valor la pone quien la usa: un campo en línea) y para imprimir (texto). Estilos: .hoja en globals.css.
 * En el celular, la misma hoja a ancho completo y en una columna (sección 1, 1.1, 2, 3 y 4).
 */
type Fila = [Celda, string];
const SECCION_1A: Fila[] = [["empresa", "Empresa"], ["fechaPedido", "Fecha del pedido"], ["fechaCaducidad", "Fecha de caducidad"], ["nDeOrden", "N° de Orden"], ["solicitadoPor", "Solicitado por"], ["obra", "Obra"]];
const SECCION_1B: Fila[] = [["proveedorSugerido", "Proveedor Sugerido"], ["proveedorFinal", "Proveedor Final"], ["presupuestoN", "Presupuesto N°"], ["importe", "Importe"], ["formaDePago", "Forma de Pago"]];
const SECCION_3: Fila[] = [["empresaParaFacturar", "Empresa para Facturar"], ["cuit", "Cuit"], ["facturaN", "Factura N°"], ["facturaImporte", "Importe"], ["facturaFormaDePago", "Forma de Pago"], ["condicionDePago", "Condición de Pago"]];

export type PropsHoja = {
  titulo: string;
  color: string;
  /** El contenido de la celda de valor (campo en línea o texto). */
  celda: (c: Celda) => ReactNode;
  /** Atributos de la celda de valor (data-editable, data-falta…). */
  atributos?: (c: Celda) => HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, boolean | undefined>;
  autorizacion: ReactNode;
  pago: ReactNode;
  /** Fila extra de la sección 3 en pantalla: el archivo de la factura (en el PDF va como segunda página). */
  factura?: ReactNode;
  impresion?: boolean;
};

function Tabla({ filas, celda, atributos, ancho }: { filas: Fila[]; celda: PropsHoja["celda"]; atributos?: PropsHoja["atributos"]; ancho: "izq" | "der" }) {
  return (
    <div className={`hoja-tabla hoja-tabla-${ancho}`}>
      {filas.map(([c, etiqueta]) => (
        <div key={c} className="hoja-fila">
          <div className="hoja-etiqueta">{etiqueta}</div>
          <div className="hoja-valor" data-celda={c} {...atributos?.(c)}>{celda(c)}</div>
        </div>
      ))}
    </div>
  );
}

export function HojaOC({ titulo, color, celda, atributos, autorizacion, pago, factura, impresion = false }: PropsHoja) {
  return (
    <div className={`hoja ${impresion ? "hoja-impresa" : ""}`}>
      <div className="hoja-marco">
        <div className="hoja-titulo" style={{ background: color }}>{titulo}</div>
        <div className="hoja-cuerpo">
          {/* Fila A: lo de arriba de las dos columnas */}
          <section className="hoja-izq-a">
            <h2 className="hoja-seccion">1. Orden de Pedido</h2>
            <Tabla filas={SECCION_1A} celda={celda} atributos={atributos} ancho="izq" />
            <div className="hoja-detalle">
              <div className="hoja-etiqueta">Detalle del Pedido</div>
              <div className="hoja-valor" data-celda="detalleDelPedido" {...atributos?.("detalleDelPedido")}>{celda("detalleDelPedido")}</div>
            </div>
          </section>
          <section className="hoja-der-a">
            <h2 className="hoja-seccion">3. Facturación</h2>
            <Tabla filas={SECCION_3} celda={celda} atributos={atributos} ancho="der" />
            {factura && !impresion && (
              <div className="hoja-tabla hoja-tabla-der hoja-tabla-extra">
                <div className="hoja-fila">
                  <div className="hoja-etiqueta">Factura (archivo)</div>
                  <div className="hoja-valor" data-celda="facturaAdjunto" {...atributos?.("facturaAdjunto")}>{factura}</div>
                </div>
              </div>
            )}
          </section>
          {/* Fila B: desde Proveedor Sugerido (a la izquierda) y 4. Orden de Pago (a la derecha), alineados */}
          <section className="hoja-izq-b">
            <Tabla filas={SECCION_1B} celda={celda} atributos={atributos} ancho="izq" />
            <h2 className="hoja-seccion hoja-seccion-11">1.1 Observaciones de la Orden de Pedido.</h2>
            <div className="hoja-observaciones hoja-valor" data-celda="observacionesOrdenPedido" {...atributos?.("observacionesOrdenPedido")}>{celda("observacionesOrdenPedido")}</div>
            <h2 className="hoja-seccion hoja-seccion-fuerte">2. Autorización a la Orden de Pedido:</h2>
            <div className="hoja-autorizacion">{autorizacion}</div>
          </section>
          <section className="hoja-der-b">
            <h2 className="hoja-caja-titulo">4. Orden de Pago</h2>
            <div className="hoja-pago">
              <div className="hoja-etiqueta">Autorización a la Orden de Pago</div>
              <div className="hoja-pago-valor">{pago}</div>
            </div>
            <Tabla filas={[["fechaDePago", "Fecha de Pago"]]} celda={celda} atributos={atributos} ancho="der" />
          </section>
        </div>
      </div>
    </div>
  );
}
