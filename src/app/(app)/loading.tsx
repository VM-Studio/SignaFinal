import { Esqueleto } from "@/components/ui/basicos";

export default function Cargando() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 lg:max-w-none" aria-busy="true" aria-label="Cargando">
      <Esqueleto className="h-9 w-48" />
      <Esqueleto className="h-[72px]" />
      <Esqueleto className="h-16" />
      <Esqueleto className="h-16" />
      <Esqueleto className="h-16" />
    </div>
  );
}
