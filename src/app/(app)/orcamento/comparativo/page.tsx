import { redirect } from "next/navigation";

/** Planejar por categoria e Planejado x Realizado foram unificados em /orcamento/[year] — mantém o
 * link antigo funcionando em vez de quebrar quem tinha essa URL salva. */
export default function OrcamentoComparativoIndexPage() {
  redirect(`/orcamento/${new Date().getFullYear()}`);
}
