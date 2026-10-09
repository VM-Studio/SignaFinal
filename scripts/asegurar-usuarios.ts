/**
 * Asegura que existan los usuarios de demo (los mismos que crea src/lib/demo/datos.ts), sin borrar
 * ni modificar nada: crea solo los que faltan, con la contraseña de demo. Sirve para una base que se
 * cargó antes de que existiera un rol (por ejemplo COMPRAS).
 *
 *   npx tsx scripts/asegurar-usuarios.ts                     (contra DATABASE_URL de .env)
 *   DATABASE_URL="..." npx tsx scripts/asegurar-usuarios.ts  (contra otra base)
 *
 * Al final lista todos los usuarios con su rol.
 */
import { PrismaClient, type Rol } from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const CONTRASENA_DEMO = "signa2026";

/** Mismos usuarios que la carga de demo (src/lib/demo/datos.ts). */
const USUARIOS: { nombre: string; email: string; rol: Rol; telefono?: string }[] = [
  { nombre: "Dirección", email: "direccion", rol: "DIRECCION" },
  { nombre: "Leandro", email: "leandro", rol: "RESPONSABLE_OBRA", telefono: "11 5000-1001" },
  { nombre: "Daniela", email: "daniela", rol: "RESPONSABLE_OBRA", telefono: "11 5000-1002" },
  { nombre: "César", email: "cesar", rol: "RESPONSABLE_OBRA", telefono: "11 5000-1003" },
  { nombre: "Vicky", email: "vicky", rol: "RESPONSABLE_OBRA", telefono: "11 5000-1004" },
  { nombre: "Lolo", email: "lolo", rol: "CAPATAZ", telefono: "11 5000-1005" },
  { nombre: "Claudio", email: "claudio", rol: "CHOFER", telefono: "11 5000-1006" },
  { nombre: "Cristian", email: "cristian", rol: "CHOFER", telefono: "11 5000-1007" },
  { nombre: "David", email: "david", rol: "CHOFER", telefono: "11 5000-1008" },
  { nombre: "Encargado de depósito", email: "deposito", rol: "DEPOSITO" },
  { nombre: "Administración", email: "administracion", rol: "ADMINISTRACION" },
  { nombre: "Compras", email: "compras", rol: "COMPRAS", telefono: "11 5000-1010" },
];

async function main() {
  const db = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(CONTRASENA_DEMO, 10);
    let creados = 0;
    for (const u of USUARIOS) {
      const email = `${u.email}@signa.demo`;
      if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) continue;
      await db.usuario.create({ data: { nombre: u.nombre, email, rol: u.rol, telefono: u.telefono ?? null, passwordHash } });
      await db.auditoria.create({ data: { accion: "usuario.asegurar", entidad: "Usuario", entidadId: email, resumen: `Se creó ${u.nombre} (${u.rol}) porque faltaba en la base` } });
      console.log(`Creado: ${u.nombre} (${email}, ${u.rol})`);
      creados++;
    }
    console.log(creados ? `\n${creados} usuario(s) creado(s).` : "\nNo faltaba ninguno.");
    const todos = await db.usuario.findMany({ orderBy: [{ rol: "asc" }, { nombre: "asc" }], select: { nombre: true, email: true, rol: true, activo: true } });
    console.log("\nUsuarios:");
    for (const u of todos) console.log(`  ${u.rol.padEnd(17)} ${u.nombre.padEnd(24)} ${u.email.padEnd(30)} ${u.activo ? "activo" : "INACTIVO"}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
