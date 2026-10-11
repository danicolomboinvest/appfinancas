import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { carregarRaioX } from "@/app/(app)/mensal/foco/dados";
import { contasQueOsProventosPagam } from "@/lib/portfolio/proventos";
import { grupoDoAtivo } from "@/lib/portfolio/classificacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { proventosDaCarteira } from "../dados";
import { COR_DO_GRUPO } from "../cores-dos-grupos";
import { ProventosTela } from "./ProventosTela";

/**
 * Carteira › Proventos (rodada 16, a "régua de tom" da rodada 43): a renda passiva. Herói com o
 * recebido nos 12 meses e a média por mês, "Sua renda passiva já paga..." com uma conta real
 * dela, as colunas mês a mês (recebido sólido, a caminho listrado), o que está a caminho e quem
 * mais pagou, com o rendimento sobre o que ela pagou. Nada de "reinvestir agora".
 */
export default async function ProventosPage() {
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const agora = nowInBrazil();
  const [{ resumo }, ativos, contas, raioX] = await Promise.all([
    proventosDaCarteira(ctx),
    listAssets(ctx),
    listarContasAPagar(ctx),
    carregarRaioX(ctx, agora.getFullYear(), agora.getMonth() + 1),
  ]);

  // As contas que a média já paga: assinaturas do extrato (Raio-X) e contas fixas de valor certo.
  const candidatas = [
    ...raioX.itens.filter((i) => i.tipo === "assinatura").map((i) => ({ nome: i.nome, valor: Math.round(i.mensal * 100) / 100 })),
    ...contas.filter((c) => c.valor !== null).map((c) => ({ nome: c.nome, valor: Number(c.valor) })),
  ];
  const paga = contasQueOsProventosPagam(resumo.mediaPorMes, candidatas);

  const porTicker = new Map(ativos.filter((a) => a.ticker).map((a) => [a.ticker!.toUpperCase(), a]));
  const visual = (ticker: string) => {
    const a = porTicker.get(ticker);
    return { nome: a?.name ?? ticker, cor: a ? COR_DO_GRUPO[grupoDoAtivo(a)] : "var(--color-strat-outros)" };
  };

  return (
    <ProventosTela
      dozeMeses={resumo.dozeMeses}
      media={resumo.mediaPorMes}
      meses={resumo.meses}
      aCaminho={resumo.aCaminho.map((p) => ({ ticker: p.ticker, tipo: p.tipo, data: p.pagamento.toISOString(), valor: p.valor, ...visual(p.ticker) }))}
      totalACaminho={resumo.totalACaminho}
      ranking={resumo.ranking.map((r) => ({ ...r, ...visual(r.ticker) }))}
      paga={paga.map((c) => c.nome)}
      temBruto={resumo.temBruto}
    />
  );
}
