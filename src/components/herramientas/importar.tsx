"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/basicos";
import { MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { importarHerramientas, type FilaImportacion } from "@/lib/herramientas/acciones";

const COLUMNAS = ["nombre", "categoria", "tipo", "control", "marca", "modelo", "serie", "valor", "cantidad", "mantenimiento_dias"];
const PLANTILLA =
  "﻿" +
  [
    COLUMNAS.join(";"),
    "Hormigonera 130 l;Maquinaria;maquina;unitaria;Czerweny;130;CZ-130-1;980000;;90",
    "Amoladora 7\";Herramientas eléctricas;herramienta;unitaria;Bosch;GWS 20;;150000;;",
    "Fratachos;Herramientas de mano;herramienta;cantidad;;;;8000;20;",
  ].join("\r\n");

type Previa = { fila: FilaImportacion | null; original: string[]; error?: string };

/** Separa una línea CSV respetando comillas. Acepta ";" (Excel en español) o ",". */
function partir(linea: string, sep: string) {
  const out: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (comillas && linea[i + 1] === '"') { actual += '"'; i++; } else comillas = !comillas;
    } else if (c === sep && !comillas) { out.push(actual.trim()); actual = ""; } else actual += c;
  }
  out.push(actual.trim());
  return out;
}

const numero = (s: string) => (s ? Number(s.replace(/\./g, "").replace(",", ".")) : undefined);

function interpretar(texto: string): Previa[] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];
  const sep = (lineas[0].match(/;/g)?.length ?? 0) >= (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cab = partir(lineas[0], sep).map((c) => c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"));
  const col = (fila: string[], nombre: string) => fila[cab.indexOf(nombre)] ?? "";
  return lineas.slice(1).map((l) => {
    const f = partir(l, sep);
    const tipo = col(f, "tipo").toLowerCase();
    const control = col(f, "control").toLowerCase();
    const errores: string[] = [];
    if (col(f, "nombre").length < 2) errores.push("falta el nombre");
    if (col(f, "categoria").length < 2) errores.push("falta la categoría");
    if (tipo && !["maquina", "máquina", "herramienta"].includes(tipo)) errores.push("tipo: máquina o herramienta");
    if (control && !["unitaria", "cantidad"].includes(control)) errores.push("control: unitaria o cantidad");
    const esMaquina = tipo.startsWith("maq") || tipo.startsWith("máq");
    if (esMaquina && control === "cantidad") errores.push("una máquina va por unidad");
    const cantidad = numero(col(f, "cantidad"));
    if (control === "cantidad" && !(cantidad && cantidad > 0)) errores.push("poné la cantidad");
    const valor = numero(col(f, "valor"));
    if (valor != null && Number.isNaN(valor)) errores.push("valor inválido");
    if (errores.length) return { fila: null, original: f, error: errores.join(", ") };
    return {
      original: f,
      fila: {
        nombre: col(f, "nombre"), categoria: col(f, "categoria"), esMaquina, tipoControl: control === "cantidad" ? "CANTIDAD" : "UNITARIA",
        marca: col(f, "marca") || undefined, modelo: col(f, "modelo") || undefined, nroSerie: col(f, "serie") || undefined,
        valorCompra: valor, cantidad, mantenimientoCadaDias: numero(col(f, "mantenimiento_dias")),
      },
    };
  });
}

export function ImportarCSV() {
  const [previa, setPrevia] = useState<Previa[]>([]);
  const [archivo, setArchivo] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  const conError = previa.filter((p) => p.error).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-h-[52px] cursor-pointer items-center gap-2 rounded-[var(--radius-caja)] bg-negro px-5 font-semibold text-white">
          <FileUp className="size-5" /> Elegir archivo CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setArchivo(f.name);
            setError(undefined);
            setPrevia(interpretar(await f.text()));
          }} />
        </label>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(PLANTILLA)}`} download="plantilla-herramientas.csv" className="flex min-h-[52px] items-center gap-2 rounded-[var(--radius-caja)] border-2 border-negro bg-papel px-5 font-semibold">
          <Download className="size-5" /> Bajar plantilla
        </a>
      </div>
      <p className="text-sm text-suave">Columnas: {COLUMNAS.join(", ")}. Separador “;” o “,”. El código SIG se asigna solo y todo entra al depósito.</p>

      {previa.length > 0 && (
        <>
          <p className="font-semibold">
            {archivo}: {previa.length} fila{previa.length === 1 ? "" : "s"}
            {conError ? <span className="text-critico"> · {conError} con error</span> : <span className="text-ok"> · todas bien</span>}
          </p>
          <div className="max-h-[50dvh] overflow-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-linea bg-papel text-xs tracking-wider text-suave uppercase">
                <tr className="[&>th]:px-3 [&>th]:py-2"><th>#</th><th>Nombre</th><th>Categoría</th><th>Tipo</th><th>Cantidad</th><th>Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {previa.map((p, i) => (
                  <tr key={i} className={`[&>td]:px-3 [&>td]:py-2 ${p.error ? "bg-critico-fondo/60" : ""}`}>
                    <td className="text-suave tabular-nums">{i + 2}</td>
                    <td className="font-semibold">{p.fila?.nombre ?? p.original[0]}</td>
                    <td>{p.fila?.categoria ?? p.original[1]}</td>
                    <td>{p.fila ? `${p.fila.esMaquina ? "Máquina" : "Herramienta"} · ${p.fila.tipoControl === "CANTIDAD" ? "por cantidad" : "unitaria"}` : "—"}</td>
                    <td className="tabular-nums">{p.fila?.cantidad ?? (p.fila ? 1 : "—")}</td>
                    <td>{p.error ? <span className="font-medium text-critico">{p.error}</span> : <Insignia tono="ok">Lista</Insignia>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!!conError} cargando={enviando} icono={<Upload className="size-5" />} onClick={async () => {
            setEnviando(true);
            const r = await importarHerramientas(previa.map((p) => p.fila!));
            setEnviando(false);
            if (!r.ok) return setError(r.error);
            aviso({ mensaje: `${r.datos.creadas} cargadas (${r.datos.desde} a ${r.datos.hasta}).` });
            router.push("/herramientas/etiquetas");
          }}>{conError ? "Corregí las filas con error" : `Cargar ${previa.length} al depósito`}</Boton>
        </>
      )}
    </div>
  );
}
