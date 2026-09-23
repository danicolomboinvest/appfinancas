import Link from "next/link";
import type { ParentCategory } from "@prisma/client";
import type { MonthlyBreakdown } from "@/lib/consolidation/yearly";
import type { Money } from "@/lib/profiles/voice";
import type { DadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { CATEGORIAS_EMPRESA, MESES_DE_CAIXA_RECOMENDADOS } from "@/lib/profiles/empresa";
import { PARENT_CATEGORIES, colorForCategorySlice, customCategoryColor } from "@/lib/categories";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { ReceitaDespesaLucroChart } from "@/components/charts/ReceitaDespesaLucroChart";
import { CaixaAcumuladoChart } from "@/components/charts/CaixaAcumuladoChart";
import { AnelPercentual } from "@/components/ui/AnelPercentual";
import { FitText } from "@/components/ui/FitText";
import { DreEmpresa } from "@/app/(app)/mensal/[year]/[month]/DreEmpresa";

/**
 * O painel do perfil Empresa: a Visão geral lida como um dashboard de negócio, no desenho
 * dos painéis de gestão que a Dani mostrou (indicadores no topo com variação contra o mês
 * anterior, receita × despesas mês a mês com o lucro por cima, caixa ao longo do ano, DRE com
 * percentuais, orçamento usado e a divisão por frente e por tipo de receita).
 *
 * Tudo vem do que a pessoa já lançou. Não existe cadastro novo pra alimentar este painel:
 * é a mesma tabela de lançamentos, lida com a conta de uma empresa (ver empresa.ts).
 */
export type IndicadorMensal = { atual: number; anterior: number };

export function PainelEmpresa({
  money,
  year,
  mesLabel,
  mesAnteriorLabel,
  isCurrentYear,
  months,
  mes,
  ano,
  receita,
  despesas,
  lucro,
  gastoPorFrenteMes,
  gastoPorFrenteMesAnterior,
  orcamentoPorFrente,
  gastoPersonalizadoMes,
  receitaPorTipoAno,
  receitaPorTipoMes,
  orcamentoDoMes,
  receitaPlanejadaDoMes,
}: {
  money: Money;
  year: number;
  mesLabel: string;
  mesAnteriorLabel: string;
  isCurrentYear: boolean;
  months: MonthlyBreakdown[];
  /** DRE e caixa do mês corrente. */
  mes: DadosDaEmpresa;
  /** DRE e caixa do ano. */
  ano: DadosDaEmpresa;
  receita: IndicadorMensal;
  despesas: IndicadorMensal;
  lucro: IndicadorMensal;
  gastoPorFrenteMes: { parentCategory: string; spent: number }[];
  gastoPorFrenteMesAnterior: { parentCategory: string; spent: number }[];
  orcamentoPorFrente: Partial<Record<ParentCategory, number>>;
  gastoPersonalizadoMes: { name: string; spent: number; id: string }[];
  receitaPorTipoAno: { subcategory: string; amount: number }[];
  receitaPorTipoMes: { subcategory: string; amount: number }[];
  /** Soma do orçamento do mês (todas as frentes). */
  orcamentoDoMes: number;
  /** Faturamento planejado pro mês, do plano anual. `null` sem plano. */
  receitaPlanejadaDoMes: number | null;
}) {
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const variacao = (i: IndicadorMensal) => (i.anterior > 0 ? (i.atual - i.anterior) / i.anterior : null);
  const receitaDoMes = mes.dre.receitaBruta;
  const gastoDoMes = gastoPorFrenteMes.reduce((s, g) => s + g.spent, 0) + gastoPersonalizadoMes.reduce((s, g) => s + g.spent, 0);
  const anteriorPorFrente = new Map(gastoPorFrenteMesAnterior.map((g) => [g.parentCategory, g.spent]));
  const gastoPorFrente = new Map(gastoPorFrenteMes.map((g) => [g.parentCategory, g.spent]));
  const meses = mes.caixa.mesesDeCaixa;
  const caixaTexto = meses === null ? "—" : meses >= 12 ? "12+ meses" : `${meses.toFixed(1).replace(".", ",")} ${meses >= 1.95 ? "meses" : "mês"}`;
  const caixaTom = mes.caixa.situacao === "curto" ? "danger" : mes.caixa.situacao === "folgado" ? "success" : "neutral";

  const fatiasFrentes: DonutSlice[] = [
    ...PARENT_CATEGORIES.filter((k) => (gastoPorFrente.get(k) ?? 0) > 0).map((k) => ({
      name: CATEGORIAS_EMPRESA[k].label,
      value: gastoPorFrente.get(k) ?? 0,
      color: colorForCategorySlice({ kind: "parent", value: k }),
    })),
    ...gastoPersonalizadoMes.map((g, i) => ({ name: g.name, value: g.spent, color: customCategoryColor(i) })),
  ];
  const tiposDeReceita = receitaPorTipoMes.length > 0 ? receitaPorTipoMes : receitaPorTipoAno;
  const CORES_RECEITA = ["var(--color-success)", "var(--color-accent)", "var(--color-info)", "var(--color-chart-5)", "var(--color-chart-6)", "var(--color-chart-7)"];
  const fatiasReceita: DonutSlice[] = tiposDeReceita.map((r, i) => ({ name: r.subcategory, value: r.amount, color: CORES_RECEITA[i % CORES_RECEITA.length] }));

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Linha 1: os seis números que um dono olha todo dia. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
        <Indicador rotulo={`Receita · ${mesLabel}`} valor={money(receita.atual, { round: true })} tom="success" variacao={variacao(receita)} periodo={mesAnteriorLabel} money={money} />
        <Indicador rotulo={`Custos e despesas · ${mesLabel}`} valor={money(despesas.atual, { round: true })} tom="danger" variacao={variacao(despesas)} periodo={mesAnteriorLabel} bomQuandoCai money={money} />
        <Indicador rotulo={`Lucro · ${mesLabel}`} valor={money(lucro.atual, { round: true })} tom={lucro.atual >= 0 ? "success" : "danger"} variacao={lucro.anterior !== 0 ? (lucro.atual - lucro.anterior) / Math.abs(lucro.anterior) : null} periodo={mesAnteriorLabel} money={money} />
        <Indicador rotulo="Margem líquida" valor={pct(mes.dre.margemLiquidaPct)} tom={mes.dre.margemLiquidaPct !== null && mes.dre.margemLiquidaPct < 0 ? "danger" : "neutral"} nota="lucro ÷ receita" money={money} />
        <Indicador rotulo="Margem de contribuição" valor={pct(mes.dre.margemContribuicaoPct)} tom="neutral" nota="o que sobra da venda pra pagar o fixo" money={money} />
        <Indicador rotulo="Caixa de segurança" valor={caixaTexto} tom={caixaTom} nota={mes.caixa.situacao === "sem-dado" ? "marque o caixa como reserva" : `${money(mes.caixa.caixa, { round: true })} · Sebrae: ${MESES_DE_CAIXA_RECOMENDADOS.minimo} a ${MESES_DE_CAIXA_RECOMENDADOS.confortavel}`} money={money} href="/planejamento/reserva-emergencia" />
      </div>

      {/* Linha 2: receita × despesas × lucro no ano, e o orçamento do mês em anéis. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
        <Bloco titulo={`Receita, despesas e lucro em ${year}`} nota="barras: receita e despesas · linha: lucro · apagado: previsto">
          <ReceitaDespesaLucroChart months={months} />
        </Bloco>
        <Bloco titulo={`Orçamento de ${mesLabel}`} nota={orcamentoDoMes > 0 || receitaPlanejadaDoMes ? "quanto do planejado já aconteceu" : "monte o orçamento da empresa pra acompanhar"}>
          <div className="flex items-center justify-around gap-3 py-2">
            {receitaPlanejadaDoMes ? (
              <AnelPercentual pct={receitaDoMes / receitaPlanejadaDoMes} tom="success" rotulo={`receita · meta ${money(receitaPlanejadaDoMes, { round: true })}`} />
            ) : (
              <Link href="/orcamento" className="text-center text-caption text-ink-faint hover:text-ink">
                Sem meta de<br />receita
              </Link>
            )}
            {orcamentoDoMes > 0 ? (
              <AnelPercentual pct={gastoDoMes / orcamentoDoMes} tom="danger" rotulo={`despesas · teto ${money(orcamentoDoMes, { round: true })}`} />
            ) : (
              <Link href="/orcamento" className="text-center text-caption text-ink-faint hover:text-ink">
                Sem teto de<br />despesas
              </Link>
            )}
          </div>
        </Bloco>
      </div>

      {/* Linha 3: caixa ao longo do ano e a DRE do mês. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco titulo={`Caixa no fim de cada mês · ${year}`} nota={isCurrentYear ? "parte do caixa de hoje e refaz o caminho com o resultado de cada mês" : "resultado acumulado, mês a mês"}>
          <CaixaAcumuladoChart months={months} caixaInicial={mes.caixa.caixa} />
        </Bloco>
        <DreEmpresa dados={mes} money={money} periodo={mesLabel.toLowerCase()} compacto />
      </div>

      {/* Linha 4: por frente (centro de custo) e por tipo de receita. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-5">
        <Bloco titulo={`Resultado por frente · ${mesLabel}`} nota="o centro de custo de cada área: gasto, teto e o peso no faturamento">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-caption text-ink-faint">
                <th className="pb-2 text-left font-medium">Frente</th>
                <th className="pb-2 text-right font-medium">Gasto</th>
                <th className="hidden pb-2 text-right font-medium sm:table-cell">Teto</th>
                <th className="pb-2 text-right font-medium">% receita</th>
                <th className="hidden pb-2 text-right font-medium sm:table-cell">vs. {mesAnteriorLabel}</th>
              </tr>
            </thead>
            <tbody>
              {PARENT_CATEGORIES.filter((k) => (gastoPorFrente.get(k) ?? 0) > 0 || (orcamentoPorFrente[k] ?? 0) > 0).map((k) => {
                const gasto = gastoPorFrente.get(k) ?? 0;
                const teto = orcamentoPorFrente[k] ?? 0;
                const antes = anteriorPorFrente.get(k) ?? 0;
                const delta = antes > 0 ? (gasto - antes) / antes : null;
                const estourou = teto > 0 && gasto > teto;
                return (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-2 pr-2">
                      <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: colorForCategorySlice({ kind: "parent", value: k }) }} />
                      {CATEGORIAS_EMPRESA[k].label}
                      <span className="ml-1 text-caption text-ink-faint">{CATEGORIAS_EMPRESA[k].natureza === "variavel" ? "variável" : CATEGORIAS_EMPRESA[k].natureza === "imposto" ? "imposto" : "fixa"}</span>
                    </td>
                    <td className={`py-2 text-right tabular-nums ${estourou ? "text-danger" : "text-ink"}`}>{money(gasto, { round: true })}</td>
                    <td className="hidden py-2 text-right tabular-nums text-ink-muted sm:table-cell">{teto > 0 ? money(teto, { round: true }) : "—"}</td>
                    <td className="py-2 text-right tabular-nums text-ink-muted">{receitaDoMes > 0 ? `${Math.round((gasto / receitaDoMes) * 100)}%` : "—"}</td>
                    <td className={`hidden py-2 text-right tabular-nums sm:table-cell ${delta === null ? "text-ink-faint" : delta > 0 ? "text-danger" : "text-success"}`}>
                      {delta === null ? "—" : `${delta > 0 ? "↑" : "↓"} ${Math.abs(Math.round(delta * 100))}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Bloco>
        <Bloco titulo={`Despesas por frente · ${mesLabel}`}>
          <Donut slices={fatiasFrentes} centerLabel="Gastos" size={150} emptyMessage="Nenhum gasto no mês ainda." />
        </Bloco>
        <Bloco titulo={receitaPorTipoMes.length > 0 ? `Receita por tipo · ${mesLabel}` : `Receita por tipo · ${year}`} nota="Vendas, serviços, assinaturas: o tipo que você marca ao registrar">
          <Donut slices={fatiasReceita} centerLabel="Receita" size={150} emptyMessage="Registre uma entrada com o tipo (Vendas, Serviços…)." />
        </Bloco>
      </div>

      {/* Linha 5: a DRE do ano inteiro e a porta pro simulador de investimento. */}
      <DreEmpresa dados={ano} money={money} periodo={String(year)} />
      <Link href="/investir" className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft/30 px-4 py-3 transition-colors hover:border-accent">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">Pensando em investir na empresa?</span>
          <span className="block text-caption text-ink-muted">Máquina, reforma, contratação: em quanto tempo se paga, e se rende mais que a aplicação.</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-accent-strong">Simular →</span>
      </Link>
    </div>
  );
}

function Bloco({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{titulo}</h2>
      {nota && <p className="mt-0.5 text-caption text-ink-faint">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Indicador({
  rotulo,
  valor,
  tom,
  variacao,
  periodo,
  bomQuandoCai = false,
  nota,
  href,
}: {
  rotulo: string;
  valor: string;
  tom: "success" | "danger" | "neutral";
  variacao?: number | null;
  periodo?: string;
  bomQuandoCai?: boolean;
  nota?: string;
  href?: string;
  money: Money;
}) {
  const cor = tom === "success" ? "text-success" : tom === "danger" ? "text-danger" : "text-ink";
  const subiu = variacao !== undefined && variacao !== null && variacao >= 0;
  const bom = variacao !== undefined && variacao !== null && (bomQuandoCai ? !subiu : subiu);
  const conteudo = (
    <>
      <p className="text-caption text-ink-muted">{rotulo}</p>
      <div className="mt-1">
        <FitText className={`text-[22px] font-semibold tracking-tight tabular-nums ${cor}`}>{valor}</FitText>
      </div>
      {variacao !== undefined && variacao !== null && (
        <p className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${bom ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {subiu ? "↑" : "↓"} {Math.abs(Math.round(variacao * 100))}% vs. {periodo}
        </p>
      )}
      {variacao === null && periodo && <p className="mt-1.5 text-[11px] text-ink-faint">sem {periodo} pra comparar</p>}
      {nota && <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{nota}</p>}
    </>
  );
  const classe = "rounded-2xl border border-border bg-surface p-3.5 sm:p-4";
  return href ? (
    <Link href={href} className={`${classe} transition-colors hover:border-border-strong`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
