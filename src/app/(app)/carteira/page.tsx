import { after } from "next/server";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { getContributionContext } from "@/lib/portfolio/contribution";
import { assetIdsWithAllocationsIn, getContributionLinkState, getWithdrawalLinkState } from "@/lib/portfolio/contribution-link";
import { planContribution } from "@/lib/portfolio/contribution-plan";
import { classificar, NOME_DO_TIPO } from "@/lib/portfolio/classificacao";
import { resumirCarteira } from "@/lib/portfolio/resumo-carteira";
import { recordPatrimonySnapshotIfNeeded } from "@/lib/portfolio/snapshot";
import { getSavingsTargets } from "@/lib/planning/savings-targets";
import { regraDosAportes, splitSavings } from "@/lib/planning/savings-split";
import { estadoDaAssessoria } from "@/lib/assessoria/estado";
import { atualizarTaxasSeVelhas } from "@/lib/indicadores/indicadores";
import { PARENT_CATEGORY_COLOR } from "@/lib/categories";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { AllocateContributionCard } from "./AllocateContributionCard";
import { evolucaoDoPatrimonio, precosDosTitulos, proventosDaCarteira, taxasDeReferencia, titulosParaABusca } from "./dados";
import { MeusAtivos, type AtivoDaTela, type SugestaoDeAporte } from "./MeusAtivos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Carteira › Meus ativos, na versão nova (rodadas 16, 43, 55, 59, 61 e 76): o herói com o total
 * (Brasil + Exterior somados, o exterior em dólar com "≈ R$"), a linha fina dos 12 meses, os
 * atalhos (Aportes, Novo ativo, Importar, Mais), o "Por tipo" que vira a lista e, no fim, a
 * linha discreta da conta na Fatos Capital.
 */
export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const empresa = ehEmpresa(ctx.profileKind);
  const agora = new Date();
  const now = nowInBrazil();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const mesPassado = new Date(ano, mes - 2, 1);

  const [assets, goals, user, contexto, aporteDoMes, aporteDoMesPassado, resgateDoMes, resgateDoMesPassado, comAporteRecente, alvos, serie, proventos, taxas] = await Promise.all([
    listAssets(ctx),
    listGoals(ctx),
    getOwnUser(ctx),
    getContributionContext(ctx, ano, mes),
    getContributionLinkState(ctx, ano, mes),
    getContributionLinkState(ctx, mesPassado.getFullYear(), mesPassado.getMonth() + 1),
    getWithdrawalLinkState(ctx, ano, mes),
    getWithdrawalLinkState(ctx, mesPassado.getFullYear(), mesPassado.getMonth() + 1),
    assetIdsWithAllocationsIn(ctx, [
      { year: ano, month: mes },
      { year: mesPassado.getFullYear(), month: mesPassado.getMonth() + 1 },
    ]),
    getSavingsTargets(ctx),
    evolucaoDoPatrimonio(ctx),
    proventosDaCarteira(ctx),
    taxasDeReferencia(agora),
  ]);
  const [titulos, titulosDoTesouro] = await Promise.all([precosDosTitulos(assets, agora), titulosParaABusca(agora)]);
  // Números de fora: o Banco Central de novo se o gravado tem mais de 12 horas (depois de responder).
  after(() => atualizarTaxasSeVelhas());

  const ativos: AtivoDaTela[] = assets.map((a) => {
    const c = classificar(a);
    return {
      id: a.id,
      name: a.name,
      ticker: a.ticker,
      assetClass: a.assetClass,
      objective: a.objective,
      goalId: a.goalId,
      quantity: a.quantity !== null ? Number(a.quantity) : null,
      currentUnitPrice: a.currentUnitPrice !== null ? Number(a.currentUnitPrice) : null,
      investedValue: a.investedValue !== null ? Number(a.investedValue) : null,
      currentValue: Number(a.currentValue),
      fixedIncomeIndex: a.fixedIncomeIndex,
      currency: a.currency,
      nativeCurrentValue: a.nativeCurrentValue !== null ? Number(a.nativeCurrentValue) : null,
      nativeInvestedValue: a.nativeInvestedValue !== null ? Number(a.nativeInvestedValue) : null,
      exchangeRate: a.exchangeRate !== null ? Number(a.exchangeRate) : null,
      tipoEscolhido: a.tipoEscolhido,
      ondeEscolhido: a.ondeEscolhido,
      taxaCompra: a.taxaCompra !== null ? Number(a.taxaCompra) : null,
      classificacao: `${NOME_DO_TIPO[c.tipo]} · ${c.onde === "exterior" ? "Exterior" : "Brasil"}`,
      classificacaoEscolhida: c.escolhida,
      tipo: c.tipo,
      onde: c.onde,
      atualizadoEm: a.updatedAt.toISOString(),
    };
  });
  const resumo = resumirCarteira(ativos);
  if (resumo.total > 0) after(() => recordPatrimonySnapshotIfNeeded(ctx, resumo.total));

  // Aportes (rodada 16): o que ela guardou no mês pelo orçamento e, só como sugestão, onde pôr.
  // A reserva segue a regra dos aportes (3.11): menos de 3 meses, 100% para ela.
  const guardouNoMes = aporteDoMes.contributions.reduce((s, c) => s + c.amount, 0);
  const baseDoAporte = guardouNoMes > 0 ? guardouNoMes : contexto.plannedAmount;
  const reserva = alvos.find((t) => t.kind === "reserva");
  const regra = reserva ? regraDosAportes(reserva.monthsCovered ?? null, reserva.remaining <= 0) : null;
  const maior = (lista: typeof assets) => [...lista].sort((x, y) => Number(y.currentValue) - Number(x.currentValue))[0] ?? null;
  const sugestao: SugestaoDeAporte[] = [];
  for (const fatia of splitSavings(baseDoAporte, alvos).slices) {
    if (fatia.kind === "reserva") {
      const a = maior(assets.filter((x) => x.objective === "RESERVA_EMERGENCIA"));
      sugestao.push({ chave: "reserva", nome: "Reserva", ativo: a ? (a.ticker ?? a.name) : null, valor: fatia.amount, cor: "var(--color-dinheiro-guardou)" });
    } else if (fatia.kind === "meta") {
      const a = maior(assets.filter((x) => x.goalId === fatia.id));
      sugestao.push({ chave: fatia.id, nome: fatia.name, ativo: a ? (a.ticker ?? a.name) : null, valor: fatia.amount, cor: "var(--color-strat-ipca)" });
    } else if (contexto.hasStrategy) {
      // O que vai para a liberdade segue a estratégia: a classe que está mais abaixo do alvo.
      for (const p of planContribution(contexto.classes, fatia.amount)) {
        const destino = contexto.destinations[p.assetClass];
        sugestao.push({ chave: `livre-${p.assetClass}`, nome: contexto.labels[p.assetClass], ativo: destino?.assetName ?? null, valor: p.amount, cor: `var(--color-strat-${{ RENDA_FIXA_POS_FIXADA: "pos", RENDA_FIXA_IPCA: "ipca", PREFIXADO: "pre", ACOES_BRASIL: "acoes", FIIS: "fiis", EXTERIOR: "exterior", OUTROS: "outros" }[p.assetClass]})` });
      }
    } else {
      sugestao.push({ chave: "livre", nome: "Liberdade financeira", ativo: null, valor: fatia.amount, cor: "var(--color-strat-acoes)" });
    }
  }

  // O que ela guardou ou resgatou e ainda não disse em qual ativo (o "Registrar aporte").
  const goalNameById = new Map(goals.map((g) => [g.id, g.name]));
  const ativosPraDistribuir = [...assets]
    .sort((a, b) => Number(Boolean(b.goalId)) - Number(Boolean(a.goalId)) || Number(b.currentValue) - Number(a.currentValue))
    .map((a) => ({ id: a.id, name: a.name, ticker: a.ticker, goalName: a.goalId ? (goalNameById.get(a.goalId) ?? null) : null, color: PARENT_CATEGORY_COLOR.OUTROS }));
  const pendente = aporteDoMes.pending + aporteDoMesPassado.pending + resgateDoMes.pending + resgateDoMesPassado.pending;
  const registrar =
    pendente > 0 ? (
      <div className="flex flex-col gap-3">
        {aporteDoMesPassado.pending > 0 && (
          <AllocateContributionCard key="aporte-passado" month={mesPassado.getMonth() + 1} mesPassado abertoDeInicio pending={aporteDoMesPassado.pending} goalOfMonth={aporteDoMesPassado.contributions.find((c) => c.goalName)?.goalName ?? null} assets={ativosPraDistribuir} />
        )}
        {aporteDoMes.pending > 0 && (
          <AllocateContributionCard key="aporte-mes" month={mes} abertoDeInicio={aporteDoMesPassado.pending === 0} pending={aporteDoMes.pending} goalOfMonth={aporteDoMes.contributions.find((c) => c.goalName)?.goalName ?? null} assets={ativosPraDistribuir} />
        )}
        {resgateDoMesPassado.pending > 0 && (
          <AllocateContributionCard key="resgate-passado" resgate mesPassado month={mesPassado.getMonth() + 1} pending={resgateDoMesPassado.pending} goalOfMonth={resgateDoMesPassado.goalName} assets={ativosPraDistribuir} />
        )}
        {resgateDoMes.pending > 0 && <AllocateContributionCard key="resgate-mes" resgate month={mes} pending={resgateDoMes.pending} goalOfMonth={resgateDoMes.goalName} assets={ativosPraDistribuir} />}
      </div>
    ) : null;

  return (
    <MeusAtivos
      ativos={ativos}
      resumo={resumo}
      serie={serie}
      metas={goals.map((g) => ({ id: g.id, nome: g.name }))}
      empresa={empresa}
      comAporteRecente={comAporteRecente}
      aportes={{
        mes: MESES[mes - 1],
        guardou: guardouNoMes,
        planejado: contexto.plannedAmount,
        pendente: aporteDoMes.pending + aporteDoMesPassado.pending,
        sugestao,
        regra: regra?.faixa ?? null,
        registrar,
      }}
      proventosDoAtivo={proventos.porTicker}
      caiuHoje={proventos.caiuHoje}
      titulos={titulos}
      cdi={taxas.cdi}
      novoAtivo={{ titulos: titulosDoTesouro, cdi: taxas.cdi, cdiFracao: taxas.cdiFracao, ipca: taxas.ipca, ipcaFracao: taxas.ipcaFracao }}
      // "Não quero ver ofertas da assessoria" (Configurações) também esconde o convite.
      assessoria={empresa || user.assessoriaConviteOculto || user.ofertasDesligadas ? null : estadoDaAssessoria(user.assessoriaEstado)}
    />
  );
}
