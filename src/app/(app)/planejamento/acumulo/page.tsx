import { ChevronDown } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct, usufructRateAboveAccumulation } from "@/lib/planning/usufruct";
import { computeYearByYearProjection, type ProjectionYear } from "@/lib/consolidation/projection";
import { PatrimonyProjectionChart } from "@/components/charts/PatrimonyProjectionChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatRows } from "@/components/ui/StatRows";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { Explica } from "@/components/ui/Explica";
import { EditarNoCanto } from "@/components/ui/EditarNoCanto";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { Section } from "@/components/ui/Section";
import { PlanningParamsForm } from "./PlanningParamsForm";
import { PlanningWizard } from "./PlanningWizard";
import { formatPercentNumber } from "@/lib/format";
import { serverMoney } from "@/lib/money-server";
import type { MoneyFormatter } from "@/lib/money";
import type { Voz } from "@/lib/profiles/voice";


function formatPercent(value: number) {
  return formatPercentNumber(value * 100, 2);
}

// Fase e colunas pela voz do tema: "Acúmulo" e "Patrimônio" fixos aqui apareciam no Girly,
// que proíbe esse jargão (lá é "Guardando" e "Em dinheiro de hoje").
const projectionColumns = (money: MoneyFormatter, voz: Voz): ResponsiveColumn<ProjectionYear>[] => [
  { key: "age", label: "Idade", render: (y) => y.age },
  {
    key: "phase",
    label: "Fase",
    render: (y) => (
      <Badge tone={y.phase === "ACCUMULATION" ? "accent" : "info"}>{y.phase === "ACCUMULATION" ? voz.titulos.apAcumulo : voz.titulos.apUsufruto}</Badge>
    ),
  },
  { key: "invested", label: "Investido", render: (y) => money(y.totalInvested ?? 0, { round: true }) },
  // Juros em dinheiro de hoje: Investido + Juros fecha com o Patrimônio (real) e com o
  // "Os juros põem" da barra acima. O nominal aqui dava um terceiro número sem dizer de onde.
  { key: "interest", label: "Juros (real)", render: (y) => money(y.cumulativeInterestReal ?? 0, { round: true }) },
  { key: "nominal", label: voz.titulos.apNominal, render: (y) => money(y.balanceNominal ?? 0, { round: true }) },
  { key: "real", label: voz.titulos.apReal, render: (y) => money(y.balanceReal ?? 0, { round: true }) },
];

export default async function IndependenciaFinanceiraPage() {
  const money = await serverMoney();
  const ctx = await getRequiredSession();
  // Empresa não se aposenta: a rota some do menu e, se alguém chegar por link, cai nas metas.
  if (ehEmpresa(ctx.profileKind)) redirect("/planejamento/metas");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);

  // Aposentadoria é conteúdo do curso (construir patrimônio) — diferente de Metas/Reserva,
  // que ficam de graça mesmo dentro do mesmo grupo "Planejamento Financeiro" no menu.
  if (!(await hasPremiumAccess(ctx.userId))) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={voz.titulos.aposentadoria} subtitle={voz.titulos.aposentadoriaSub} />
        <PaywallCard feature="Aposentadoria" />
      </div>
    );
  }

  const params = await getPlanningParams(ctx);

  const defaults = params
    ? {
        currentAge: params.currentAge,
        retirementAge: params.retirementAge,
        lifeExpectancyAge: params.lifeExpectancyAge,
        currentPatrimony: Number(params.currentPatrimony),
        monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
        accumulationAnnualRate: Number(params.accumulationAnnualRate),
        inflationAnnualRate: Number(params.inflationAnnualRate),
        usufructAnnualRate: Number(params.usufructAnnualRate),
        desiredPassiveIncome: Number(params.desiredPassiveIncome),
        otherPassiveIncome: Number(params.otherPassiveIncome),
      }
    : {};

  // Primeira vez (sem parâmetros): wizard guiado "Quanto custa a vida que você quer?", uma
  // pergunta por tela. Só depois de concluir é que a pessoa cai no dashboard abaixo (item 4).
  if (!params) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={voz.titulos.aposentadoria}
          subtitle={voz.titulos.aposentadoriaWizardSub}
        />
        <PlanningWizard />
      </div>
    );
  }

  const accumulation = computeAccumulation({
    currentAge: params.currentAge,
    retirementAge: params.retirementAge,
    currentPatrimony: Number(params.currentPatrimony),
    monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
    accumulationAnnualRate: Number(params.accumulationAnnualRate),
    inflationAnnualRate: Number(params.inflationAnnualRate),
  });

  const years = computeYearByYearProjection({
    currentAge: params.currentAge,
    retirementAge: params.retirementAge,
    lifeExpectancyAge: params.lifeExpectancyAge,
    currentPatrimony: Number(params.currentPatrimony),
    monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
    accumulationAnnualRate: Number(params.accumulationAnnualRate),
    inflationAnnualRate: Number(params.inflationAnnualRate),
    usufructAnnualRate: Number(params.usufructAnnualRate),
    desiredPassiveIncome: Number(params.desiredPassiveIncome),
    otherPassiveIncome: Number(params.otherPassiveIncome),
  });

  const usufruct = computeUsufruct({
    finalValueReal: accumulation.finalValueReal,
    usufructAnnualRate: Number(params.usufructAnnualRate),
    otherPassiveIncome: Number(params.otherPassiveIncome),
    desiredPassiveIncome: Number(params.desiredPassiveIncome),
  });
  const isSurplus = usufruct.surplusOrDeficit >= 0;

  // A resposta primeiro (07/10/2026): quanto ela chega a ter, quanto isso paga por mês e se dá a
  // vida que ela quer, num bloco só. De onde vem o dinheiro fica logo abaixo (é a única conta que
  // muda comportamento: o juro faz a maior parte); premissas, gráfico e ano a ano ficam no toque.
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={voz.titulos.aposentadoria} />

      {/* O id da antiga seção "Renda na aposentadoria": os links do dashboard e o redirect de
          /planejamento/usufruto apontam pra cá e caem direto na resposta. */}
      <section id="liberdade-financeira" className="flex scroll-mt-24 flex-col gap-3">
        <HeroiDoTema>
          {/* O lápis no canto edita os dados (07/10/2026): era o link "Editar meus dados ▾" embaixo. */}
          <div className="-my-1 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-heroi-suave">{voz.titulos.apSeNadaMudar(params.retirementAge)}</p>
            <EditarNoCanto titulo={voz.titulos.aposentadoria}>
              <PlanningParamsForm defaults={defaults} />
            </EditarNoCanto>
          </div>
          <div>
            <p className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums">{money(accumulation.finalValueReal, { round: true })}</p>
            <p className="mt-1.5 text-sm text-heroi-suave">{voz.titulos.apHoje}</p>
          </div>
          <div className="heroi-fio flex flex-col gap-1.5 border-t pt-3">
            {/* O veredito num selo (07/10/2026), como no Foco e no Orçamento; embaixo, a conta em uma linha. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                {money(usufruct.totalPassiveIncome, { round: true })} por mês
                <Explica noHeroi>{voz.titulos.apRendaExplica}</Explica>
              </p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${isSurplus ? "bg-success" : "bg-danger"}`}>
                {isSurplus ? voz.titulos.apDaPe : voz.titulos.apNaoDaPe}
              </span>
            </div>
            {/* O que ela quer e o que sobra (ou falta) em dois quadradinhos (07/10/2026, "mesma cara,
                menos texto"); era a frase "Você quer 12 mil e sobram 2.640 todo mês". */}
            <div className="heroi-fio grid grid-cols-2 border-t pt-3">
              <div className="min-w-0">
                <p className="text-caption text-heroi-suave">{voz.titulos.apVoceQuer}</p>
                <p className="text-lg font-bold tabular-nums">{money(Number(params.desiredPassiveIncome), { round: true })}</p>
              </div>
              <div className="heroi-fio min-w-0 border-l pl-4">
                <p className="text-caption text-heroi-suave">{isSurplus ? voz.titulos.apSobraPorMes : voz.titulos.apFaltaPorMes}</p>
                <p className={`text-lg font-bold tabular-nums ${isSurplus ? "" : "text-danger"}`}>
                  {isSurplus ? "+" : "−"}
                  {money(Math.abs(usufruct.surplusOrDeficit), { round: true })}
                </p>
              </div>
            </div>
          </div>
        </HeroiDoTema>
      </section>

      {/* Tudo em dinheiro de hoje, a mesma moeda do número de cima. Somar o que saiu do bolso com
          os juros NOMINAIS ao lado de um valor final REAL não fecha: são cenários diferentes (ver
          o comentário em computeAccumulation). */}
      <Section title={voz.titulos.apDeOndeVem} hint={voz.titulos.apDeOndeVemHint}>
        {/* Dois quadrados e a barra (07/10/2026): quanto sai do bolso e quanto os juros põem, lado a
            lado. Eram uma lista com frases ("Você põe do bolso em 38 anos"). */}
        <div className="flex flex-col gap-3">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="h-full bg-accent" style={{ width: `${(accumulation.totalInvested / Math.max(1, accumulation.totalInvested + accumulation.totalReturnReal)) * 100}%` }} />
            <span className="h-full bg-success" style={{ width: `${(accumulation.totalReturnReal / Math.max(1, accumulation.totalInvested + accumulation.totalReturnReal)) * 100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-2xl border border-border bg-surface p-3.5">
              <p className="flex items-center gap-1.5 text-caption text-ink-muted">
                <span className="size-2.5 shrink-0 rounded-[3px] bg-accent" aria-hidden />
                {voz.titulos.apDoBolso}
              </p>
              <p className="mt-1 truncate text-[17px] font-bold tabular-nums text-ink">{money(accumulation.totalInvested, { round: true })}</p>
              <p className="text-caption text-ink-muted">em {accumulation.years} anos</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-border bg-surface p-3.5">
              <p className="flex items-center gap-1.5 text-caption text-ink-muted">
                <span className="size-2.5 shrink-0 rounded-[3px] bg-success" aria-hidden />
                {voz.titulos.apDosJuros}
                {accumulation.totalInvested > 0 && accumulation.totalReturnReal > 0 && (
                  <Explica>{voz.titulos.apJurosNota(money(1, { round: true }), money(accumulation.totalReturnReal / accumulation.totalInvested))}</Explica>
                )}
              </p>
              <p className="mt-1 truncate text-[17px] font-bold tabular-nums text-ink">{money(accumulation.totalReturnReal, { round: true })}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* O cálculo inteiro, fechado: premissas, o cenário sem reajuste, o gráfico e o ano a ano. O
          id "projecao" é para o redirect de /planejamento/projecao. */}
      <details id="projecao" className="group scroll-mt-24 rounded-2xl border border-border bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Ver o cálculo completo
          <ChevronDown size={18} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="flex flex-col gap-6 border-t border-border px-4 pb-5 pt-4 sm:px-5">
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-ink">O que a conta assume</h2>
            <StatRows
              items={[
                { label: voz.titulos.apTempoGuardando, value: `${accumulation.years} anos` },
                { label: "Rendimento ao ano", value: formatPercent(accumulation.nominalAnnualRate) },
                { label: "Inflação assumida", value: formatPercent(Number(params.inflationAnnualRate)) },
                { label: "Rendimento acima da inflação", value: formatPercent(accumulation.realAnnualRate) },
                { label: "Vivendo de renda (acima da inflação)", value: formatPercent(Number(params.usufructAnnualRate)) },
                ...(Number(params.otherPassiveIncome) > 0
                  ? [{ label: "Outras rendas, já contadas", value: money(Number(params.otherPassiveIncome), { round: true }) }]
                  : []),
              ]}
            />

            {/* A renda de cima usa essa taxa já acima da inflação. Se ela passa do que o acúmulo
                rende acima da inflação, a renda sai otimista demais. */}
            {usufructRateAboveAccumulation(Number(params.usufructAnnualRate), accumulation.realAnnualRate) && (
              <p className="text-sm leading-relaxed text-ink-muted">
                O rendimento vivendo de renda ({formatPercent(Number(params.usufructAnnualRate))} acima da inflação) está maior que o da fase
                de acumular ({formatPercent(accumulation.realAnnualRate)}). Na aposentadoria o normal é ser mais conservador, então a renda
                acima pode estar otimista.
              </p>
            )}

            {/* O número grande e empolgante que NÃO é o mesmo cenário de cima. Fica aqui, dito por
                extenso, em vez de disputar a tela. */}
            <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">{voz.titulos.apSemReajuste}</p>
              <p className="text-sm leading-relaxed text-ink-muted">
                O plano assume que você acompanha a inflação: guardar {money(Number(params.monthlyContributionAccumulation), { round: true })}{" "}
                hoje e ir corrigindo esse valor com o tempo. Se em vez disso você guardar sempre o mesmo valor de face, o saldo chega a{" "}
                <span className="font-semibold text-ink">{money(accumulation.finalValueNominal, { round: true })}</span>, só que em dinheiro de{" "}
                {new Date().getFullYear() + accumulation.years}, que compra bem menos.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink">{voz.titulos.apProjecao}</h2>
            <p className="-mt-1 text-sm text-ink-muted">{voz.titulos.apProjecaoSub(params.retirementAge, params.lifeExpectancyAge ?? null)}</p>

            {years.length === 0 ? (
              <p className="text-sm text-ink-muted">Idade objetivo já atingida, nada para projetar.</p>
            ) : (
              <>
                <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <Badge tone="accent">{voz.titulos.apAcumulo}</Badge> {voz.titulos.apAcumuloDesc}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge tone="info">{voz.titulos.apUsufruto}</Badge> {voz.titulos.apUsufrutoDesc}
                  </span>
                </div>
                <PatrimonyProjectionChart years={years} nomes={{ nominal: voz.titulos.apNominal, real: voz.titulos.apReal }} />

                <CollapsibleSection label={voz.titulos.apAnoAAno}>
                  <ResponsiveTable
                    columns={projectionColumns(money, voz)}
                    rows={years}
                    rowKey={(y) => String(y.year)}
                    maxHeightClassName="max-h-[520px] overflow-y-auto"
                    compactoNoCelular
                  />
                </CollapsibleSection>
              </>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
