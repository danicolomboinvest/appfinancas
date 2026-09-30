import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * "‹ Decidir" no topo de todo simulador, da lista e do cadeado.
 *
 * As telas do Decidir já tinham esse link; os simuladores não. No app instalado no iPhone não
 * existe o botão de voltar do navegador, e o Decidir mora no menu "Mais": quem abria um
 * simulador ficava sem saída. 44px de altura de toque, com a margem negativa pra não empurrar
 * o título pra baixo.
 */
export function VoltarProDecidir() {
  return (
    <Link href="/decidir" className="-my-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm text-ink-muted hover:text-ink">
      <ChevronLeft size={16} aria-hidden /> Decidir
    </Link>
  );
}
