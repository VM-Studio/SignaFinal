import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { leerTableroExcel } from "./leerTablero";
import { emparejarObra, emparejarPersona, emparejarProveedor, filaValida, leerEstado, leerFecha, leerImporte, leerNumero, revisarTodo, type Catalogos } from "./importarTablero";

const catalogos: Catalogos = {
  usuarios: [{ id: "u-dani", nombre: "Daniela" }, { id: "u-vicky", nombre: "Vicky" }, { id: "u-cesar", nombre: "César" }, { id: "u-lolo", nombre: "Lolo" }],
  externos: [{ id: "e-romina", nombre: "Romina" }],
  obras: [
    { id: "o-pinares", nombre: "Pinares II Country Club", localidad: "Exaltación de la Cruz" },
    { id: "o-darwin", nombre: "Darwin 1299", localidad: "Villa Crespo, CABA" },
    { id: "o-chubut", nombre: "Chubut 550", localidad: "Benavídez, Tigre" },
    { id: "o-blaspareda", nombre: "Blaspareda 100", localidad: "Ingeniero Maschwitz, Escobar" },
    { id: "o-eden", nombre: "Edén", localidad: "Interior" },
  ],
  proveedores: [{ id: "p-rex", nombre: "REX" }, { id: "p-horblock", nombre: "Horblock" }],
};

/** Un tablero chico con los casos raros de la planilla real (títulos de la fila 9 incluidos). */
async function xlsxDePrueba() {
  const libro = new ExcelJS.Workbook();
  libro.addWorksheet("OC NUEVA").getCell("C3").value = "ORDEN DE COMPRA";
  const h = libro.addWorksheet("TABLERO DE CONTROL ORDENES DE C");
  h.getCell("C7").value = "Planilla de control COMPRAS - ALE";
  h.getRow(9).values = [null, null, "OC/PE", "N° OC / PE", "FECHA", "SOLICITADO POR", "OBRA", "PROVEEDOR", "IMPORTE", "DESCRIPCION / MATERIALES", "ESTADO", "FECHA DE ENTREGA", null, "Observaciones en OC / Próximos Pasos", "Comentarios"];
  const filas: unknown[][] = [
    ["OC", 5, new Date("2026-07-31T00:00:00Z"), "DANIELA", "PINARES", "REX", "$ 723.839,42", "16 Unidades - Protex Seal", "ENTREGADO", null, null, "APROBADA. FALTA QUE LLEGUE A OBRA", null],
    ["OC", 10, "31/3/0202", "DANIELA", "DARWIN", "ZINGUERIA ASAMBLEA- MERCADO LIBRE.", "$  534.000,00", "1 unidad: reja", "ENRTEGADO", new Date("2026-04-07T00:00:00Z"), null, null, null],
    ["OC", 14, new Date("2026-07-31T00:00:00Z"), "ROMINA", "CHUBUT", "ZINGUERÍA BARCALA", "????????", "Corte y plegado", "ENTREGDO", "????", null, null, null],
    ["OC", "20 A", new Date("2026-07-31T00:00:00Z"), "DANIELA", "DARWIN", "HORBLOCK - ACOPIO", "$  7.817.917,69", "Cañerías", "ANUDALADA", null, null, null, null],
    ["PE", "41 B", new Date("2026-08-10T00:00:00Z"), "VICTORIA", "PINARES LOTE 468", "MERCADO LIBRE", null, "3 rollos malla", "ENCARGADAS", "jue/vier", null, null, "YA ESTA EN OBRA"],
    ["OC", 15, new Date("2026-08-11T00:00:00Z"), "MARTIN", "MASCHWITZ", "REX", "$  -", "Cemento", "REPETIDA", null, null, null, null],
    ["OC", 16, new Date("2026-08-12T00:00:00Z"), "LOLO", "CONGRESO", "REX", 1500.5, "Arena", "AUTORIZADO", null, null, null, null],
    ["XX", 17, null, "LOLO", "DARWIN", null, null, "Algo", null, null, null, null, null],
    ["OC", 5, new Date("2026-08-01T00:00:00Z"), "CÉSAR", "EDEN LINCOLN", "REX", null, "Repetida", "PEDIR AUTORIZACION", null, null, null, null],
    [null, null, null, null, null, null, null, null, null, null, null, null, null],
  ];
  filas.forEach((f, i) => { h.getRow(10 + i).values = [null, 3, ...f] as ExcelJS.CellValue[]; });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe("lectura del Excel", () => {
  it("encuentra la hoja del tablero y la fila de encabezados (9), y mapea sus títulos", async () => {
    const r = await leerTableroExcel(await xlsxDePrueba());
    if ("error" in r) throw new Error(r.error);
    expect(r.hoja).toBe("TABLERO DE CONTROL ORDENES DE C");
    expect(r.filaEncabezados).toBe(9);
    expect(r.mapeo).toMatchObject({ tipo: 2, numero: 3, fecha: 4, solicitado: 5, obra: 6, proveedor: 7, importe: 8, materiales: 9, estado: 10, fechaEntrega: 11, proximosPasos: 13, comentarios: 14 });
    expect(r.filas).toHaveLength(9); // la vacía no cuenta
  });

  it("revisión completa: válidas, avisos y errores como en la planilla real", async () => {
    const r = await leerTableroExcel(await xlsxDePrueba());
    if ("error" in r) throw new Error(r.error);
    const rev = revisarTodo(r.filas, r.mapeo, catalogos);
    const fila = (n: number) => rev.find((x) => x.n === n)!;
    // OC 5: todo bien.
    expect(fila(10)).toMatchObject({ tipo: "OC", numeroTexto: "5", fecha: "2026-07-31", importe: 723839.42, estado: "ENTREGADO", obra: { id: "o-pinares" }, proveedor: { id: "p-rex" }, solicitado: { tipo: "u", id: "u-dani" } });
    expect(filaValida(fila(10))).toBe(true);
    // Fecha 31/3/0202: aviso (no error), queda en comentarios. ENRTEGADO → ENTREGADO.
    expect(fila(11).fecha).toBeNull();
    expect(fila(11).avisos.join(" ")).toContain("31/3/0202");
    expect(fila(11).estado).toBe("ENTREGADO");
    expect(fila(11).proveedor.nuevo).toBe(true);
    // ???? → a confirmar; ROMINA (externo); fecha de entrega "????" a comentarios.
    expect(fila(12)).toMatchObject({ importe: null, importeAConfirmar: true, solicitado: { tipo: "e", id: "e-romina" }, estado: "ENTREGADO" });
    expect(fila(12).comentarios).toContain("Fecha de entrega: ????");
    // "20 A" se guarda como texto; HORBLOCK - ACOPIO es Horblock; ANUDALADA → ANULADA.
    expect(fila(13)).toMatchObject({ numeroTexto: "20 A", numero: null, proveedor: { id: "p-horblock" }, estado: "ANULADA" });
    // PE 41 B: VICTORIA → Vicky; PINARES LOTE 468 → Pinares II; ENCARGADAS → ENCARGADO; "jue/vier" a comentarios.
    expect(fila(14)).toMatchObject({ tipo: "PE", numeroTexto: "41 B", solicitado: { tipo: "u", id: "u-vicky" }, obra: { id: "o-pinares" }, estado: "ENCARGADO" });
    expect(fila(14).comentarios).toContain("YA ESTA EN OBRA");
    expect(fila(14).comentarios).toContain("Fecha de entrega: jue/vier");
    // MARTIN: externo nuevo; MASCHWITZ → la obra de Ingeniero Maschwitz; REPETIDA no es estado; "$  -" vacío.
    expect(fila(15)).toMatchObject({ solicitado: { tipo: "nuevo", nombre: "Martin" }, obra: { id: "o-blaspareda" }, estado: null, importe: null, importeAConfirmar: false });
    expect(fila(15).comentarios).toContain("REPETIDA");
    // CONGRESO: sin emparejar (pendiente, aviso). AUTORIZADO → AUTORIZADA.
    expect(fila(16)).toMatchObject({ obra: { id: null, texto: "CONGRESO" }, estado: "AUTORIZADA", importe: 1500.5 });
    expect(filaValida(fila(16))).toBe(true);
    // XX: error de tipo.
    expect(filaValida(fila(17))).toBe(false);
    expect(fila(17).errores.join(" ")).toContain("OC o PE");
    // OC 5 repetida en el archivo: error, con la fila de la primera.
    expect(fila(18).errores.join(" ")).toContain("fila 10");
  });

  it("correcciones en la vista previa: excluir, elegir la obra pendiente, corregir el número", async () => {
    const r = await leerTableroExcel(await xlsxDePrueba());
    if ("error" in r) throw new Error(r.error);
    const rev = revisarTodo(r.filas, r.mapeo, catalogos, { 16: { obraId: "o-darwin" }, 17: { tipo: "OC" }, 18: { numero: "5 B" } });
    expect(rev.find((x) => x.n === 16)!.obra.id).toBe("o-darwin");
    expect(filaValida(rev.find((x) => x.n === 17)!)).toBe(true);
    expect(filaValida(rev.find((x) => x.n === 18)!)).toBe(true);
    expect(rev.filter(filaValida)).toHaveLength(9);
  });

  it("un archivo sin tablero se rechaza con un mensaje claro", async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Hoja1").getCell("A1").value = "nada";
    const r = await leerTableroExcel(Buffer.from(await libro.xlsx.writeBuffer()));
    expect("error" in r && r.error).toContain("N° OC / PE");
  });
});

describe("valores sueltos", () => {
  it("fechas: serial de Excel, dd/mm/aaaa, dd/mm/aa e inválidas", () => {
    expect(leerFecha(46234).iso).toBe("2026-07-31");
    expect(leerFecha("7/4/2026").iso).toBe("2026-04-07");
    expect(leerFecha("07/04/26").iso).toBe("2026-04-07");
    expect(leerFecha("31/3/0202")).toMatchObject({ iso: null, invalida: true });
    expect(leerFecha("30/2/2026")).toMatchObject({ iso: null, invalida: true });
  });
  it("importes", () => {
    expect(leerImporte("$ 723.839,42").valor).toBe(723839.42);
    expect(leerImporte("$  7.817.917,69").valor).toBe(7817917.69);
    expect(leerImporte("????").aConfirmar).toBe(true);
    expect(leerImporte("$  -")).toMatchObject({ valor: null, aConfirmar: false });
    expect(leerImporte("='OC NUEVA'!D12909").aConfirmar).toBe(true);
  });
  it("números de orden", () => {
    expect(leerNumero(5)).toEqual({ texto: "5", numero: 5 });
    expect(leerNumero("41 B")).toEqual({ texto: "41 B", numero: null });
    expect(leerNumero(" oc-120 ")).toEqual({ texto: "120", numero: 120 });
  });
  it("estados con errores de tipeo", () => {
    for (const t of ["ENRTEGADO", "ENTREGDO", "ENTERGADO", "ENTREGADA", "entregado"]) expect(leerEstado(t).estado).toBe("ENTREGADO");
    expect(leerEstado("ANUDALADA").estado).toBe("ANULADA");
    expect(leerEstado("Anulada").estado).toBe("ANULADA");
    expect(leerEstado("ENCARGADA").estado).toBe("ENCARGADO");
    expect(leerEstado("ENCARGADAS").estado).toBe("ENCARGADO");
    expect(leerEstado("AUTORIZADO").estado).toBe("AUTORIZADA");
    expect(leerEstado("EN LA OFICINA")).toMatchObject({ estado: null, texto: "EN LA OFICINA" });
    expect(leerEstado("ENTREGADA: 1\nFALTA: 1").estado).toBeNull();
  });
  it("emparejar: personas, obras y proveedores", () => {
    expect(emparejarPersona("CÉSAR", catalogos)).toMatchObject({ tipo: "u", id: "u-cesar" });
    expect(emparejarPersona("CESAR", catalogos)).toMatchObject({ tipo: "u", id: "u-cesar" });
    expect(emparejarPersona("DANIELA SOLARI", catalogos)).toMatchObject({ tipo: "u", id: "u-dani" });
    expect(emparejarPersona("DANIEL PUIG", catalogos)).toMatchObject({ tipo: "nuevo", nombre: "Daniel Puig" });
    expect(emparejarObra("PINARES II", catalogos).id).toBe("o-pinares");
    expect(emparejarObra("Suc EDEN Lincoln", catalogos).id).toBe("o-eden");
    expect(emparejarObra("Darwin 1299 S.A", catalogos).id).toBe("o-darwin");
    expect(emparejarObra("NORDELTA GLORIETAS", catalogos).id).toBeNull();
    expect(emparejarProveedor("HORBLOCK ACOPIO", catalogos).id).toBe("p-horblock");
    expect(emparejarProveedor("CONSTRUNORT - ACOPIO", catalogos)).toMatchObject({ id: null, nombre: "CONSTRUNORT", nuevo: true });
  });
});
