import { redirect } from "next/navigation";
import { nowInBrazil } from "@/lib/date/brazil-now";

/** Planejar por categoria e Planejado x Realizado foram unificados em /orcamento/[year], mantém o
 * link antigo funcionando em vez de quebrar quem tinha essa URL salva. O ano é o de Brasília: no
 * relógio do servidor (UTC), 31/12 depois das 21h já mandava pro ano seguinte. */
export default function OrcamentoComparativoIndexPage() {
  redirect(`/orcamento/${nowInBrazil().getFullYear()}`);
}
