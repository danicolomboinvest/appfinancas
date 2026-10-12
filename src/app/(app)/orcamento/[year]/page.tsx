import { nowInBrazil } from "@/lib/date/brazil-now";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { lerIntervalo, periodoDaRota } from "@/lib/visao-geral/periodo";
import { OrcamentoDoPeriodo } from "./OrcamentoDoPeriodo";
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

import { elapsedRatioOfMonth } from "@/lib/planning/budget-bullets";
import { serverMoney } from "@/lib/money-server";
import { Section } from "@/components/ui/Section";
import { resumoDoMes } from "@/lib/planning/month-budget-summary";
import { EditarPlano } from "@/components/budget/EditarPlano";
import { ajustesDoPadrao } from "@/lib/planning/padrao-orcamento";
import { CategoriasDoMes, type LinhaDaCategoria } from "@/components/budget/CategoriasDoMes";
import { carregarDetalheDoOrcamento } from "@/lib/repositories/orcamento-detalhe.repo";
import { categoriaDoMes, ordenarCategorias } from "@/lib/planning/orcamento-categorias";
import { revisaoDoPlano } from "@/lib/planning/remanejo";
import { categoriasEssenciais } from "@/lib/categories";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { AlertaDoOrcamento } from "@/components/budget/AlertaDoOrcamento";
import { SeuPlano } from "@/components/budget/SeuPlano";
import { vozDoTema } from "@/lib/profiles/voice";
import { getUltimoGastoAte } from "@/lib/repositories/monthly-entry.repo";

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
  // O link do e-mail do "passou" (?resolver=SAUDE) abre a folha "O que fazer?" da categoria.
  const busca = await props.searchParams;
  const resolverParam = busca.resolver;
  const resolver = typeof resolverParam === "string" ? resolverParam : undefined;
  const year = Number(yearParam);
  // URL editada à mão ("/orcamento/abc") viraria NaN direto no Prisma → erro 500. Fora da
  // faixa válida é simplesmente uma página que não existe (mesmo guard do fluxo mensal).
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    notFound();
  }
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const agora = nowInBrazil();
  // "Ver o período" com um período que não é um mês (trimestre, 7 dias, personalizado).
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const intervalo = lerIntervalo({ periodo: um(busca.periodo), de: um(busca.de), ate: um(busca.ate) }, agora);
  if (intervalo) return <OrcamentoDoPeriodo ctx={ctx} intervalo={intervalo} agora={agora} />;
  // Uma consulta a mais na página já custou caro antes: vai junto das outras, não em fila.
  const [comparison, customCategories, plan, annualPlan, hints, savingsTargets] = await Promise.all([
    getAnnualPlannedVsActual(ctx, year),
    listCustomCategories(ctx),
    getAnnualBudgetPlan(ctx, year),
    getAnnualMonthlyPlan(ctx, year),
    getBudgetHints(ctx, year, agora),
    getSavingsTargets(ctx, agora),
  ]);
  // Contas a pagar e o limite do cartão moram na aba Recorrentes desde a versão nova.
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
  // O mês do seletor da Visão geral (?mes=2026-09); sem ele, o mês de agora (ou dezembro, num ano
  // que já passou). É o mês do herói, do "Seu plano" e das categorias.
  const escolhido = periodoDaRota(`/orcamento/${year}`, typeof busca.mes === "string" ? busca.mes : null, now)?.mes;
  const mesEscolhido = escolhido && escolhido.ano === year ? escolhido.mes : isCurrentYear ? now.getMonth() + 1 : 12;
  const eMesDeAgora = isCurrentYear && mesEscolhido === now.getMonth() + 1;
  const currentMonthData = comparison.months.find((m) => m.month === mesEscolhido);

  // O resumo que abre a página. Só do mês corrente: "quanto posso gastar por dia" não existe
  // pra um mês que já acabou, e é justamente essa conta que faz o cartão valer a tela.
  const ultimoGasto =
    // A mesma "última data de gasto" do Foco: conta fixa pré-lançada (o aluguel do dia 25) não
    // conta como dado novo, senão uma tela dizia "atualizado" e a outra "dados velhos".
    currentMonthData && eMesDeAgora ? await getUltimoGastoAte(ctx, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) : null;
  const resumoMes =
    currentMonthData
      ? resumoDoMes({
          planejado: currentMonthData.totalPlanned,
          gasto: currentMonthData.totalSpent,
          hoje: now,
          ano: year,
          mes: currentMonthData.month,
          ultimoGasto,
        })
      : null;

  // As categorias do mês no jeito do Copilot (ver CategoriasDoMes): previsão, a vencer, Cobrir.
  const detalhe = currentMonthData ? await carregarDetalheDoOrcamento(ctx, year, currentMonthData.month, now) : null;
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
      // "Rever o plano" só depois de 3 meses seguidos acima de 110% (regra 18), com a mediana.
      sugestao: (() => {
        const r = revisaoDoPlano(historico.slice(0, -1));
        return r && r.mediana > c.planejado ? { passou: 3, meses: 3, sugerido: r.mediana } : null;
      })(),
    };
  });
  const essenciais = [...categoriasEssenciais(ctx.categorias?.prefs)];
  const livreDoMes = resumoMes ? resumoMes.restante : null;
  const diasRestantes = resumoMes ? Math.max(1, resumoMes.diasRestantes) : 1;

  // "Seu plano" (o resumo que o Editar meu plano abre primeiro): as categorias com plano e as que
  // fogem do padrão dos últimos 3 meses (ver lib/planning/padrao-orcamento.ts).
  const planoTodo: Record<string, number> = { ...plan, ...customPlan };
  const ignorarNoPadrao = new Set<string>(Object.keys(hints.padraoByCategory).filter((k) => !isParentCategoryKey(k) && !customCategoryLabels.has(k)));
  const resumoDoPlano = {
    mes: MONTH_LABELS[agora.getMonth()].toLowerCase(),
    itens: (currentMonthData ? currentMonthData.categories.map((c) => [c.categoryKey, c.planned] as const) : Object.entries(planoTodo))
      .filter(([, v]) => v > 0)
      .map(([key, planejado]) => ({ key, label: categoryLabel(key), cor: categoryColor(key), planejado, iconeProprio: customCategories.find((c) => c.id === key)?.icon })),
    ajustes: isCurrentYear ? ajustesDoPadrao({ meses: hints.porMes, plano: planoTodo, ignorar: ignorarNoPadrao }).map((a) => ({ ...a, label: categoryLabel(a.chave) })) : [],
  };

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

  return (
    <div className="flex flex-col gap-6 lg:gap-5">
      {/* Subtítulo curto de propósito: o cartão logo abaixo diz a mesma coisa com os números
          DELA, e no celular cada linha aqui empurra pra fora da tela o número que ela veio ver. */}
      {/* Sem título nem setas de ano (protótipo aprovado): o mês vem do seletor da Visão geral. */}
      <h1 className="sr-only">{voz.titulos.orcamento}</h1>

      {/* Primeira coisa da página, de propósito: é o número que a pessoa veio ver. Tudo o que
          vem depois (categorias, ano, tabela) explica ESTE número. */}
      {/* No computador o número fica à esquerda e o alerta, o plano e os dois quadrados à direita
          (07/10/2026): com a curva dentro do cartão, na largura toda ela ficava do tamanho da tela. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        {resumoMes && currentMonthData && (
          // O herói do Orçamento (protótipo aprovado): o plano do mês, o livre grande e uma barra.
          <HeroiDoTema>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] text-heroi-suave">Plano de {MONTH_LABELS[currentMonthData.month - 1].toLowerCase()}</p>
              <p className="text-[15px] tabular-nums text-heroi-tinta">{money(resumoMes.planejado, { round: true })}</p>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <ValorDestaque texto={money(Math.abs(resumoMes.restante), { round: true })} />
              <span className="text-[17px] text-heroi-suave">{resumoMes.restante >= 0 ? "livres" : "acima do plano"}</span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]">
              <div className={`h-full rounded-full ${resumoMes.restante >= 0 ? "bg-[var(--color-heroi-tinta)]" : "bg-danger"}`} style={{ width: `${Math.min(100, (resumoMes.gasto / Math.max(1, resumoMes.planejado)) * 100)}%` }} />
            </div>
            <div className="flex items-baseline justify-between gap-3 text-sm text-heroi-suave">
              <span className="tabular-nums">Gastou {money(resumoMes.gasto, { round: true })}</span>
              <span className="tabular-nums">{Math.round((resumoMes.gasto / Math.max(1, resumoMes.planejado)) * 100)}%</span>
            </div>
          </HeroiDoTema>
        )}
        <div className="flex min-w-0 flex-col gap-6 lg:gap-4">
          {linhasDoMes.length > 0 && <AlertaDoOrcamento mes={MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()} linhas={linhasDoMes} essenciais={essenciais} livre={livreDoMes} diasRestantes={diasRestantes} />}
          {linhasDoMes.length > 0 && <SeuPlano itens={linhasDoMes.map((l) => ({ key: l.key, label: l.label, cor: l.cor, planejado: l.planejado, gasto: l.gasto + l.aVencer }))} />}


        </div>
      </div>

      {linhasDoMes.length > 0 && (
        <Section title="Categorias" hint="A barra vai do verde ao vermelho conforme a categoria se aproxima do plano. Toque numa categoria para ver o histórico; na que passou, para ver o que fazer.">
          <CategoriasDoMes hrefTransacoes={`/mensal/${year}/${currentMonthData?.month ?? 1}`} mes={MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()} linhas={linhasDoMes} essenciais={essenciais} livre={livreDoMes} diasRestantes={diasRestantes} abrirResolvendo={resolver} />
        </Section>
      )}

      {/* "Editar meu plano" no fim, largo, como no protótipo. O ano inteiro saiu daqui. */}
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
        <EditarPlano rotulo="Editar meu plano" titulo={voz.titulos.formOrcEditarCurto(year)} largo resumo={resumoDoPlano}>
          {assistente}
        </EditarPlano>
      ) : (
        <Section title={`Vamos montar seu orçamento de ${year}`}>{assistente}</Section>
      )}
    </div>
  );
}
