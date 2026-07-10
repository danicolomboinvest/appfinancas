import { redirect } from "next/navigation";

/** Planejar por categoria e Planejado x Realizado foram unificados em /orcamento/[year] — mantém o
 * link antigo (com o ano) funcionando em vez de quebrar quem tinha essa URL salva. */
export default async function OrcamentoComparativoYearPage(props: PageProps<"/orcamento/comparativo/[year]">) {
  const { year } = await props.params;
  redirect(`/orcamento/${year}`);
}
