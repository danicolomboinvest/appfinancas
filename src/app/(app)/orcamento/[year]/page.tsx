import { nowInBrazil } from "@/lib/date/brazil-now";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getAnnualPlannedVsActual } from "@/lib/planning/budget-comparison";
import { getAnnualBudgetPlan, getAnnualBudgetPlanForCustomCategories } from "@/lib/repositories/budget.repo";
import { getAnnualMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getBudgetHints } from "@/lib/planning/budget-hints";
import { anoFechado, mesDeReferenciaDoPlano } from "@/lib/planning/plano-anual";
import { getSavingsTargets } from "@/lib/planning/savings-targets";
import { BudgetWizard } from "../BudgetWizard";
import {
  PARENT_CATEGORIES,
  categoryLabel as parentCategoryLabel,
  categoryDescription,
  isParentCategoryKey,
  colorForCategorySlice,
} from "@/lib/categories";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { PageHeader } from "@/components/ui/PageHeader";

import { elapsedRatioOfMonth } from "@/lib/planning/budget-bullets";
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";
import { resumoDoMes } from "@/lib/planning/month-budget-summary";
import { ResumoDoMesCard } from "@/components/budget/ResumoDoMesCard";
import { EditarPlano } from "@/components/budget/EditarPlano";
import { CategoriasDoMes, type LinhaDaCategoria } from "@/components/budget/CategoriasDoMes";
import { CurvaDoMes } from "@/components/budget/CurvaDoMes";
import { ResumoDoAno, type MesDoResumo } from "@/components/budget/ResumoDoAno";
import { carregarDetalheDoOrcamento } from "@/lib/repositories/orcamento-detalhe.repo";
import { categoriaDoMes, ordenarCategorias, planoMaisRealista, sugestaoDeCobrir } from "@/lib/planning/orcamento-categorias";
import { MapaDoAno, type LinhaDoMapa } from "@/components/budget/MapaDoAno";
import { vozDoTema } from "@/lib/profiles/voice";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { contasDoFoco, hojeEmBrasilia } from "@/lib/contas/contas";
import { situacaoDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { AtualizarMesButton } from "@/components/budget/AtualizarMesButton";
import { getUltimoGastoAte } from "@/lib/repositories/monthly-entry.repo";
import { ajustesDoPadrao } from "@/lib/planning/padrao-orcamento";
import { categoriaOculta } from "@/lib/categories";
import { SugestoesDoPadrao, type AjusteComRotulo } from "@/components/budget/SugestoesDoPadrao";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];


export default async function OrcamentoPage(props: PageProps<"/orcamento/[year]">) {
  const money = await serverMoney();
  const { year: yearParam } = await props.params;
  const year = Number(yearParam);
  // URL editada à mão ("/orcamento/abc") viraria NaN direto no Prisma → erro 500. Fora da
  // faixa válida é simplesmente uma página que não existe (mesmo guard do fluxo mensal).
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    notFound();
  }
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const agora = nowInBrazil();
  // Uma consulta a mais na página já custou caro antes: vai junto das outras, não em fila.
  const [comparison, customCategories, plan, annualPlan, hints, savingsTargets, contas, cartao] = await Promise.all([
    getAnnualPlannedVsActual(ctx, year),
    listCustomCategories(ctx),
    getAnnualBudgetPlan(ctx, year),
    getAnnualMonthlyPlan(ctx, year),
    getBudgetHints(ctx, year, agora),
    getSavingsTargets(ctx, agora),
    listarContasAPagar(ctx),
    year === agora.getFullYear() ? situacaoDoCartao(ctx, year, agora.getMonth() + 1) : null,
  ]);
  // Contas a pagar moram aqui (05/10/2026, pedido da Dani): o atalho diz o que vence na semana.
  const contasDaSemana = contasDoFoco(contas, hojeEmBrasilia());
  const contasAtrasadas = contasDaSemana.filter((c) => c.situacao === "atrasada").length;
  const totalDasContas = contasDaSemana.reduce((s, c) => s + (c.valor ?? 0), 0);
  // O mês de referência, o mesmo das categorias (o mês corrente no ano corrente): o salvar grava
  // dele em diante, então é ele que responde "o que eu tenho planejado?". Janeiro já não serve:
  // depois de salvar em setembro, janeiro continua com o valor antigo e a tela "desfazia" a
  // mudança (e a barra de "não salvas" nunca sumia).
  const monthPlan = annualPlan.get(mesDeReferenciaDoPlano(year, agora)) ?? annualPlan.get(1) ?? [...annualPlan.values()][0] ?? null;
  // Ano que já acabou: o plano dele é história. O salvar não grava nada nele, então nem oferece.
  const planoFechado = anoFechado(year, agora);
  const hasPlan = Object.values(plan).some((v) => v > 0) || (monthPlan?.plannedIncome ?? 0) > 0;
  const customPlan = await getAnnualBudgetPlanForCustomCategories(
    ctx,
    year,
    customCategories.map((c) => c.id),
  );
  const customCategoryLabels = new Map(customCategories.map((c) => [c.id, c.name]));
  // O nome de cada categoria-mãe vem do tipo do perfil (Empresa fala "Estrutura", não "Moradia").
  function categoryLabel(categoryKey: string): string {
    return isParentCategoryKey(categoryKey)
      ? parentCategoryLabel(ctx.categorias ?? ctx.profileKind, categoryKey)
      : (customCategoryLabels.get(categoryKey) ?? "Categoria personalizada");
  }
  const allCategoryKeys: string[] = [...PARENT_CATEGORIES, ...customCategories.map((c) => c.id)];
  function categoryColor(categoryKey: string): string {
    return colorForCategorySlice(
      isParentCategoryKey(categoryKey)
        ? { kind: "parent", value: categoryKey }
        : { kind: "custom", value: categoryKey },
      ctx.categorias,
    );
  }

  // Relógio de Brasília, igual ao Foco e ao /mensal: às 22h do dia 30 o mês ainda é este.
  const now = nowInBrazil();
  const isCurrentYear = year === now.getFullYear();
  const currentMonthData = isCurrentYear ? comparison.months.find((m) => m.month === now.getMonth() + 1) : undefined;

  // O resumo que abre a página. Só do mês corrente: "quanto posso gastar por dia" não existe
  // pra um mês que já acabou, e é justamente essa conta que faz o cartão valer a tela.
  const ultimoGasto =
    // A mesma "última data de gasto" do Foco: conta fixa pré-lançada (o aluguel do dia 25) não
    // conta como dado novo, senão uma tela dizia "atualizado" e a outra "dados velhos".
    currentMonthData && isCurrentYear ? await getUltimoGastoAte(ctx, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) : null;
  const resumoMes =
    currentMonthData && isCurrentYear
      ? resumoDoMes({
          planejado: currentMonthData.totalPlanned,
          gasto: currentMonthData.totalSpent,
          hoje: now,
          ano: year,
          mes: currentMonthData.month,
          ultimoGasto,
        })
      : null;
  const ultimoDiaDoMes = currentMonthData ? new Date(year, currentMonthData.month, 0).getDate() : 0;

  // As categorias do mês no jeito do Copilot (ver CategoriasDoMes): previsão, a vencer, Cobrir.
  const detalhe = currentMonthData && isCurrentYear ? await carregarDetalheDoOrcamento(ctx, year, currentMonthData.month, now) : null;
  const decorrido = currentMonthData ? elapsedRatioOfMonth(now, year, currentMonthData.month) : 0;
  const ROTULO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const categoriasDoMes = currentMonthData && detalhe
    ? ordenarCategorias(
        currentMonthData.categories
          .filter((c) => c.planned > 0 || (detalhe.porCategoria[c.categoryKey]?.gasto ?? 0) + (detalhe.porCategoria[c.categoryKey]?.aVencer ?? 0) > 0)
          .map((c) =>
            categoriaDoMes(
              { key: c.categoryKey, label: categoryLabel(c.categoryKey), planejado: c.planned, gasto: detalhe.porCategoria[c.categoryKey]?.gasto ?? 0, aVencer: detalhe.porCategoria[c.categoryKey]?.aVencer ?? 0 },
              decorrido,
            ),
          ),
      )
    : [];
  const linhasDoMes: LinhaDaCategoria[] = categoriasDoMes.map((c) => {
    const historico = (detalhe?.historico ?? []).map((h, i, arr) => ({
      rotulo: ROTULO_MES[h.mes - 1],
      gasto: i === arr.length - 1 ? c.gasto + c.aVencer : (h.porCategoria[c.key]?.gasto ?? 0),
      planejado: h.porCategoria[c.key]?.planejado ?? 0,
      atual: i === arr.length - 1,
    }));
    const fechados = historico.slice(0, -1).filter((h) => h.gasto > 0 || h.planejado > 0);
    return {
      ...c,
      cor: categoryColor(c.key),
      iconeProprio: customCategories.find((cc) => cc.id === c.key)?.icon,
      maiores: detalhe?.porCategoria[c.key]?.maiores ?? [],
      historico,
      media: fechados.length > 0 ? fechados.reduce((s, h) => s + h.gasto, 0) / fechados.length : c.gasto + c.aVencer,
      sugestao: planoMaisRealista(historico.slice(0, -1), c.planejado),
    };
  });
  /*
   * "Seu padrão dos últimos 3 meses" (pedido de 03/10/2026): onde o plano não bate com o que ela
   * gasta de verdade nos últimos meses fechados. Só no ano corrente, porque aplicar vale deste mês
   * até dezembro. Categoria escondida e personalizada que não existe mais ficam de fora.
   */
  const ignorarNoPadrao = new Set<string>([
    ...(ctx.categorias ? PARENT_CATEGORIES.filter((k) => categoriaOculta(ctx.categorias!, k)) : []),
    ...Object.keys(hints.padraoByCategory).filter((k) => !isParentCategoryKey(k) && !customCategoryLabels.has(k)),
  ]);
  const ajustesPadrao: AjusteComRotulo[] = isCurrentYear
    ? ajustesDoPadrao({ meses: hints.porMes, plano: { ...plan, ...customPlan }, ignorar: ignorarNoPadrao }).map((a) => ({ ...a, label: categoryLabel(a.chave) }))
    : [];
  const sugestaoCobrir = sugestaoDeCobrir(categoriasDoMes);
  const cobrir = sugestaoCobrir ? { de: sugestaoCobrir.de.key, deLabel: sugestaoCobrir.de.label, para: sugestaoCobrir.para.key, paraLabel: sugestaoCobrir.para.label, valor: sugestaoCobrir.valor } : null;
  // A previsão do mês é a soma das previsões das categorias (as fixas não são projetadas pelo
  // ritmo), e só depois de 15% do mês, como no Foco.
  const previsaoDoMesTotal = categoriasDoMes.length > 0 && decorrido >= 0.15 && decorrido < 1 ? Math.round(categoriasDoMes.reduce((s, c) => s + c.previsto, 0)) : null;

  // "Seu ano até agora" (ver ResumoDoAno), no lugar da tabela de 12 cartões.
  const mesesDoResumo: MesDoResumo[] = comparison.months.map((mm) => ({
    rotulo: ROTULO_MES[mm.month - 1].charAt(0).toUpperCase(),
    nome: MONTH_LABELS[mm.month - 1],
    planejado: mm.totalPlanned,
    gasto: mm.totalSpent,
    // Só mês FECHADO: o mês em andamento entrava com o gasto pela metade (no dia 1, R$ 0) e virava
    // "melhor mês", inflando a economia do ano.
    realizado: mm.isRealized && mm.month >= comparison.startMonth && (!isCurrentYear || mm.month < now.getMonth() + 1),
    pesaram: mm.categories
      .filter((c) => c.planned > 0 && c.spent > c.planned)
      .sort((a, b) => b.spent - b.planned - (a.spent - a.planned))
      .slice(0, 2)
      .map((c) => ({ label: categoryLabel(c.categoryKey), valor: Math.round(c.spent - c.planned) })),
  }));

  const assistente = (
    <BudgetWizard
      year={year}
      profileId={ctx.profileId}
      hasPlan={hasPlan}
      hints={hints}
      savingsTargets={savingsTargets}
      plan={{
        plannedIncome: monthPlan?.plannedIncome ?? 0,
        plannedInvestment: monthPlan?.plannedInvestment ?? 0,
      }}
      parentCategories={PARENT_CATEGORIES.map((parentCategory) => ({
        key: parentCategory,
        label: parentCategoryLabel(ctx.profileKind, parentCategory),
        description: categoryDescription(ctx.profileKind, parentCategory),
        defaultValue: plan[parentCategory],
      }))}
      customCategories={customCategories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        defaultValue: customPlan[category.id] ?? 0,
      }))}
    />
  );

  // O mapa do ano: por categoria com plano no ano, o estado de cada mês (ver MapaDoAno).
  const mesAtual = isCurrentYear ? now.getMonth() + 1 : 13;
  const linhasDoAno: LinhaDoMapa[] = allCategoryKeys
    .filter((key) => comparison.months.some((m) => (m.categories.find((c) => c.categoryKey === key)?.planned ?? 0) > 0))
    .map((key) => ({
      key,
      label: categoryLabel(key),
      meses: Array.from({ length: 12 }, (_, i) => {
        const mes = comparison.months.find((m) => m.month === i + 1);
        const cat = mes?.categories.find((c) => c.categoryKey === key);
        if (i + 1 === mesAtual) return "agora" as const;
        if (!mes || !mes.isRealized) return "futuro" as const;
        if (!cat || cat.planned <= 0) return "sem-plano" as const;
        return cat.spent > cat.planned ? ("passou" as const) : ("dentro" as const);
      }),
    }));

  return (
    <div className="flex flex-col gap-6 lg:gap-5">
      {/* Subtítulo curto de propósito: o cartão logo abaixo diz a mesma coisa com os números
          DELA, e no celular cada linha aqui empurra pra fora da tela o número que ela veio ver. */}
      <PageHeader
        title={voz.titulos.orcamento}
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/orcamento/${year - 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={16} /> {year - 1}
            </Link>
            <Link
              href={`/orcamento/${year + 1}`}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              {year + 1} <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      {/* Primeira coisa da página, de propósito: é o número que a pessoa veio ver. Tudo o que
          vem depois (categorias, ano, tabela) explica ESTE número. */}
      {/* No computador o número fica à esquerda e o alerta, o plano e os dois quadrados à direita
          (07/10/2026): com a curva dentro do cartão, na largura toda ela ficava do tamanho da tela. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        {resumoMes && (
          <ResumoDoMesCard
            resumo={resumoMes}
            mesLabel={MONTH_LABELS[currentMonthData!.month - 1]}
            ultimoDia={ultimoDiaDoMes}
            money={money}
            onAtualizar={<AtualizarMesButton />}
            voz={voz}
            grafico={
              detalhe && currentMonthData ? (
                <CurvaDoMes
                  compacta
                  acumulado={detalhe.acumulado}
                  acumuladoAnterior={detalhe.acumuladoAnterior}
                  planejado={currentMonthData.totalPlanned}
                  diasNoMes={ultimoDiaDoMes}
                  previsao={previsaoDoMesTotal}
                  marco={null}
                  cor={resumoMes.situacao === "estourou" ? "var(--color-danger)" : "var(--color-heroi-destaque)"}
                  money={(v) => money(v, { round: true })}
                />
              ) : undefined
            }
            previsao={previsaoDoMesTotal}
          />
        )}
        <div className="flex min-w-0 flex-col gap-6 lg:gap-4">
          {/* O alerta do mês, um só e numa linha (07/10/2026): logo abaixo da resposta, antes das ações. */}
          {ajustesPadrao.length > 0 && (
            <SugestoesDoPadrao ajustes={ajustesPadrao} mes={MONTH_LABELS[agora.getMonth()].toLowerCase()} meses={hints.mesesComDado} />
          )}

          {planoFechado ? (
            <p className="text-sm text-ink-muted">
              {year} já fechou: o plano dele fica como estava, pra comparação.{" "}
              <Link href={`/orcamento/${agora.getFullYear()}`} className="font-semibold text-accent-strong hover:underline">
                Planejar {agora.getFullYear()}
              </Link>
            </p>
          ) : hasPlan ? (
            // Com plano: um botão que abre o assistente por cima (ver EditarPlano). Sem plano, ele é
            // a própria página e continua aberto aqui.
            <EditarPlano rotulo={voz.titulos.formOrcEditarCurto(year)} titulo={voz.titulos.formOrcEditarCurto(year)}>
              {assistente}
            </EditarPlano>
          ) : (
            <Section title={`Vamos montar seu orçamento de ${year}`}>{assistente}</Section>
          )}

          {/* Contas a pagar e Limite do cartão em dois quadrados lado a lado (07/10/2026, "mesma cara,
              menos texto"): eram um cartão comprido com frase e um link solto. O limite é opcional (a
              Dani: "não é todo mundo que vai usar dessa forma"), então sem ele o quadrado só convida. */}
          {isCurrentYear && (
            <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
              <Link
                href={contas.length > 0 ? "/orcamento/contas" : "/orcamento/contas?nova=1"}
                className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-center justify-between">
                  <CalendarClock size={20} className={contasAtrasadas > 0 ? "text-danger" : "text-accent-strong"} aria-hidden />
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </span>
                <span className="mt-2.5 text-caption text-ink-muted">{voz.titulos.contasTitulo}</span>
                <span className={`truncate text-[17px] font-semibold tabular-nums ${contasAtrasadas > 0 ? "text-danger" : contas.length === 0 ? "text-accent-strong" : "text-ink"}`}>
                  {contas.length === 0
                    ? "Anotar"
                    : contasDaSemana.length === 0
                      ? "Em dia"
                      : totalDasContas > 0
                        ? money(totalDasContas, { round: true })
                        : `${contasDaSemana.length} na semana`}
                </span>
                {contasDaSemana.length > 0 && (
                  <span className={`mt-0.5 text-caption ${contasAtrasadas > 0 ? "font-semibold text-danger" : "text-ink-muted"}`}>
                    {voz.titulos.contasFocoTitulo(contasAtrasadas, contasDaSemana.length - contasAtrasadas)}
                  </span>
                )}
              </Link>
              <Link href="/orcamento/cartao" className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:bg-surface-hover">
                <span className="flex items-center justify-between">
                  <CreditCard size={20} className={cartao && (cartao.nivel === "passou" || cartao.nivel === "perto") ? "text-danger" : "text-accent-strong"} aria-hidden />
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </span>
                <span className="mt-2.5 text-caption text-ink-muted">{voz.titulos.limTitulo}</span>
                {cartao ? (
                  <>
                    <span className={`text-[17px] font-semibold tabular-nums ${cartao.nivel === "passou" ? "text-danger" : "text-ink"}`}>{Math.round(cartao.pct)}%</span>
                    <span className={`mt-0.5 text-caption ${cartao.nivel === "passou" ? "font-semibold text-danger" : "text-ink-muted"}`}>
                      {cartao.falta >= 0 ? voz.titulos.limAtalhoFalta(money(cartao.falta, { round: true })) : voz.titulos.limAtalhoPassou(money(-cartao.falta, { round: true }))}
                    </span>
                  </>
                ) : (
                  <span className="text-[17px] font-semibold text-accent-strong">Montar</span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>

      {linhasDoMes.length > 0 && (
        <Section
          title={`Categorias de ${MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()}`}
          hint="Verde vai fechar dentro do plano, amarelo vai passar, vermelho já passou. O tracejado é o que ainda vai vencer."
        >
          <CategoriasDoMes mes={MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()} linhas={linhasDoMes} cobrir={cobrir} />
        </Section>
      )}

      {/* O ano inteiro fica fechado (07/10/2026): a página responde "quanto ainda posso gastar este
          mês?"; o mapa, a tabela e o como ler são para quem toca. */}
      {(linhasDoAno.length > 0 || mesesDoResumo.some((x) => x.realizado && x.planejado > 0)) && (
        <details className="group rounded-2xl border border-border bg-surface">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Ver {year} inteiro
            <ChevronDown size={18} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-6 border-t border-border px-4 pb-5 pt-4 sm:px-5">
            {linhasDoAno.length > 0 && (
              <Section title="Mês a mês">
                <MapaDoAno linhas={linhasDoAno} />
              </Section>
            )}
            {mesesDoResumo.some((x) => x.realizado && x.planejado > 0) && (
              <Section title="Até agora">
                <ResumoDoAno ano={year} meses={mesesDoResumo} />
              </Section>
            )}
            {/* As explicações de cada desenho, num lugar só (antes, uma frase por bloco). */}
            <details>
              <summary className="cursor-pointer text-caption font-medium text-ink-muted hover:text-ink">Como ler esta página</summary>
              <ul className="mt-2 flex flex-col gap-1.5 text-caption text-ink-muted">
                <li>Curva: o quanto do orçamento do mês já saiu. O tracejado é o ritmo de quem fecha certinho; acima dele, está gastando adiantado.</li>
                <li>Anéis: cada categoria no mês. Verde está dentro, amarelo está perto do limite, vermelho passou.</li>
                <li>Mapa do ano: um quadrado por mês. Verde ficou dentro do planejado, vermelho passou.</li>
                <li>Categoria sem plano fica cinza: não dá para estourar um limite que não existe.</li>
              </ul>
            </details>
          </div>
        </details>
      )}
    </div>
  );
}
