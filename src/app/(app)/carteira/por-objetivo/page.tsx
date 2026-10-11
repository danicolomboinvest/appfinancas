import { redirect } from "next/navigation";

/**
 * "Por objetivo" saiu da Carteira na versão nova (rodada 16): o objetivo de cada ativo aparece no
 * detalhe do ativo ("Para: ...") e no detalhe da meta. O endereço antigo leva para Meus ativos.
 */
export default function PorObjetivoPage() {
  redirect("/carteira");
}
