import { redirect } from "next/navigation";

/** Planejar por categoria e Planejado x Realizado foram unificados em /orcamento/[year]. */
export default function OrcamentoIndexPage() {
  redirect(`/orcamento/${new Date().getFullYear()}`);
}
