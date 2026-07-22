import { redirect } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";

/** Planejar por categoria e Planejado x Realizado foram unificados em /orcamento/[year].
 * Fuso do Brasil, na virada do ano (noite de 31/12), o relógio UTC do servidor mandaria
 * a pessoa pro ano seguinte, ainda vazio. */
export default function OrcamentoIndexPage() {
  redirect(`/orcamento/${nowInBrazil().getFullYear()}`);
}
