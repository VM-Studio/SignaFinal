import Link from "next/link";
import { claseBoton } from "./boton";

/** "Cargar más": suma una página a la lista sin perder el lugar. */
export function CargarMas({ href }: { href: string }) {
  return (
    <div className="mt-4 flex justify-center">
      <Link href={href} scroll={false} className={claseBoton("secundario", "normal", true, "max-w-sm")}>Cargar más</Link>
    </div>
  );
}
