import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Compass } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { getPortfolioByObjective } from "@/lib/consolidation/portfolio";
import { getPortfolioStrategyComparison, STRATEGY_ASSET_CLASS_COLOR, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import { ReservaDivergente } from "@/components/decisoes/ReservaDivergente";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";

/** "38%" sem casa decimal: a tela compara ordens de grandeza, não décimos. */
const pct = (fracao: number) => formatPercentNumber(fracao * 100, 0);

/**
 * Por objetivo / "Por sonho" no Girly (06/10/2026, refeita). A Dani achou textão e confusa: eram
 * quatro seções com tabela de três linhas por meta, a mesma régua de estratégia da tela Meus
 * Ativos, um cartão por tipo de investimento com "Você tem / Você quer" e um gráfico de barras
 * repetindo a rosca. Agora são três blocos curtos, uma linha por coisa:
 *
 * 1. Onde está seu dinheiro: uma barra dividida (reserva, liberdade, metas, sem objetivo).
 * 2. Seus sonhos: cada meta com a barra de quanto já chegou.
 * 3. Para chegar na sua estratégia: cada tipo, "38% hoje · alvo 40%" e quanto pôr ou tirar. Sem
 *    estratégia, o convite para o jogo de três perguntas.
 */
export default async function CarteiraPorObjetivoPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  // Empresa não monta estratégia de carteira: só o caixa e os ativos.
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const t = voz.titulos;
  const [byObjective, strategyComparison, fund] = await Promise.all([
    getPortfolioByObjective(ctx),
    getPortfolioStrategyComparison(ctx),
    getEmergencyFund(ctx),
  ]);
  const hasStrategy = strategyComparison.positions.some((p) => p.targetPercent > 0);
  const total = byObjective.totalPortfolio;
  const semNenhumObjetivo = total > 0 && byObjective.outro.currentValue >= total - 0.005;

  // O que está nos ativos ligados a metas é o que sobra do total depois dos outros três objetivos.
  const emMetas = Math.max(0, total - byObjective.reserva.currentValue - byObjective.liberdade.currentValue - byObjective.outro.currentValue);
  const partes = [
    {
      id: "reserva",
      nome: t.objReserva,
      valor: byObjective.reserva.currentValue,
      cor: "var(--color-success)",
      detalhe:
        byObjective.reserva.targetAmount !== null && byObjective.reserva.achievementPercent !== null
          ? t.cartDaMeta(pct(byObjective.reserva.achievementPercent), money(byObjective.reserva.targetAmount, { round: true }))
          : null,
    },
    { id: "liberdade", nome: t.objLiberdade, valor: byObjective.liberdade.currentValue, cor: "var(--color-accent)", detalhe: null },
    { id: "metas", nome: t.secaoMetas, valor: emMetas, cor: "var(--color-cat-lazer)", detalhe: null },
    { id: "sem", nome: t.objSem, valor: byObjective.outro.currentValue, cor: "var(--color-ink-faint)", detalhe: null },
  ].filter((p) => p.valor > 0.005);

  const posicoes = strategyComparison.positions.filter((p) => p.targetPercent > 0 || p.currentValue > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.porObjetivo} />

      {fund && (
        <ReservaDivergente
          naTelaDaReserva={Number(fund.currentAmount)}
          naCarteira={byObjective.reserva.currentValue}
          temInvestimentos={total > 0}
          nomeDaReserva={t.reserva}
          onde="carteira"
          money={(v) => money(v)}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-5">
        {/* 1. Onde está seu dinheiro */}
        {total > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">{t.posicaoPorObjetivo}</h2>
            {semNenhumObjetivo ? (
              <Card className="flex flex-col items-start gap-3 p-5">
                <p className="text-[15px] font-semibold text-ink">{t.objNenhumTitulo}</p>
                <Link href="/carteira" className="inline-flex min-h-10 items-center rounded-full bg-pill px-4 text-sm font-semibold text-on-pill">
                  {t.objNenhumLink.replace(/\s*→$/, "")}
                </Link>
              </Card>
            ) : (
              <Card className="flex flex-col gap-4 p-5">
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={partes.map((p) => `${p.nome} ${pct(p.valor / total)}`).join(", ")}>
                  {partes.map((p) => (
                    <span key={p.id} className="h-full" style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {partes.map((p) => (
                    <li key={p.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: p.cor }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">{p.nome}</span>
                        {p.detalhe && <span className="block text-caption text-ink-muted">{p.detalhe}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-ink">{money(p.valor, { round: true })}</span>
                        <span className="block text-caption tabular-nums text-ink-muted">{pct(p.valor / total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        )}

        {/* 2. Seus sonhos */}
        {byObjective.metas.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">{t.secaoMetas}</h2>
            <Card className="flex flex-col divide-y divide-border p-0">
              {byObjective.metas.map((m) => {
                const feito = Math.max(0, Math.min(1, m.achievementPercent));
                return (
                  <Link key={m.goalId} href={`/planejamento/metas/${m.goalId}`} className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-surface-hover">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{m.goalName}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{pct(feito)}</span>
                      <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(feito > 0 ? 2 : 0, feito * 100)}%` }} />
                    </span>
                    <span className="text-caption tabular-nums text-ink-muted">
                      {money(m.currentValue, { round: true })} de {money(m.targetAmount, { round: true })}
                    </span>
                  </Link>
                );
              })}
            </Card>
          </section>
        )}
      </div>

      {/* 3. Para chegar na sua estratégia */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{t.estrategiaVsAlvo}</h2>
          {hasStrategy && (
            <Link href="/carteira/estrategia" className="shrink-0 text-caption font-medium text-accent-strong hover:underline">
              {t.cartEditarEstrategia}
            </Link>
          )}
        </div>
        {!hasStrategy ? (
          // Sem estratégia: o convite do jogo de três perguntas, igual ao da tela Estratégia.
          <Link href="/carteira/estrategia" className="glass flex items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-surface-hover">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-on-accent shadow-premium-sm">
              <Compass size={22} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{t.formEstJogoTitulo}</span>
              <span className="block text-caption text-ink-muted">{t.formEstJogoSub}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
          </Link>
        ) : (
          <>
            <Card className="grid min-w-0 grid-cols-1 divide-y divide-border p-0 lg:grid-cols-2 lg:divide-y-0">
              {posicoes.map((p) => {
                // Pelo status (a mesma folga do selo e das sugestões da Carteira), não pelo sinal.
                const colocar = p.status === "ABAIXO";
                const noAlvo = p.status === "DENTRO";
                return (
                  <div key={p.assetClass} className="flex items-center gap-3 px-5 py-3.5 lg:border-b lg:border-border">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[p.assetClass] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{STRATEGY_ASSET_CLASS_LABEL[p.assetClass]}</span>
                      <span className="block text-caption tabular-nums text-ink-muted">{t.compHojeAlvo(pct(p.currentPercent), pct(p.targetPercent))}</span>
                    </span>
                    {noAlvo ? (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-caption font-medium text-ink-muted">{t.compNoAlvo}</span>
                    ) : (
                      // Só o sinal e o valor (verde põe, vermelho tira): com a palavra, a pílula espremia o
                      // nome do tipo ("Renda Fixa pó…"). A frase inteira fica para o leitor de tela.
                      <span
                        aria-label={`${colocar ? t.compAportar : t.compReduzir} ${money(Math.abs(p.rebalanceAmount), { round: true })}`}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold tabular-nums ${colocar ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
                      >
                        {colocar ? "+" : "−"} {money(Math.abs(p.rebalanceAmount), { round: true })}
                      </span>
                    )}
                  </div>
                );
              })}
            </Card>
            <p className="text-caption text-ink-faint">{t.cartReferenciaMatematica}</p>
          </>
        )}
      </section>
    </div>
  );
}
