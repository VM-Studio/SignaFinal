import type { HojaImpresa as Datos } from "@/lib/compras/hoja";
import { HojaOC } from "./hoja";

/** La hoja en modo lectura (impresión y PDF): cada celda con su texto, como el original. */
export function HojaImpresa({ h }: { h: Datos }) {
  return (
    <HojaOC
      impresion
      titulo={h.titulo}
      color={h.color}
      celda={(c) => h.textos[c] || null}
      autorizacion={
        <>
          {h.autorizacion.por ? <p style={{ fontWeight: 700, color: "#1F7A4D", fontSize: 12 }}>AUTORIZADA por {h.autorizacion.por}</p> : h.autorizacion.texto ? <p>{h.autorizacion.texto}</p> : null}
          {h.autorizacion.en && <p>{h.autorizacion.en}</p>}
        </>
      }
      pago={
        h.pago.autorizadoPor ? (
          <>
            <p style={{ fontWeight: 700, color: "#1F7A4D" }}>AUTORIZADO</p>
            <p>por {h.pago.autorizadoPor}</p>
            <p>{h.pago.en}</p>
          </>
        ) : h.pago.pedidoPor ? <p>Pedida por {h.pago.pedidoPor}</p> : null
      }
    />
  );
}
