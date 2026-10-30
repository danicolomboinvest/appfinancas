import { nowInBrazil } from "@/lib/date/brazil-now";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { lerIntervalo, mesDeAgora, periodoDaRota } from "@/lib/visao-geral/periodo";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
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
import { Explica } from "@/components/ui/Explica";
import { resumoDoMes } from "@/lib/planning/month-budget-summary";
import { avisoDaRenda } from "@/lib/planning/livre-do-mes";
import { carregarLivreDoMes } from "@/lib/repositories/livre-do-mes.repo";
import { EditarPlano } from "@/components/budget/EditarPlano";
import { ComecarOrcamento } from "@/components/budget/ComecarOrcamento";
import { ajustesDoPadrao } from "@/lib/planning/padrao-orcamento";
import { CategoriasDoMes, type LinhaDaCategoria } from "@/components/budget/CategoriasDoMes";
import { carregarDetalheDoOrcamento } from "@/lib/repositories/orcamento-detalhe.repo";
import { categoriaDoMes } from "@/lib/planning/orcamento-categorias";

const porPlano = <T extends { planejado: number; gasto: number; aVencer: number }>(l: T[]): T[] => [...l].sort((a, b) => b.planejado - a.planejado || b.gasto + b.aVencer - (a.gasto + a.aVencer));
import { revisaoDoPlano } from "@/lib/planning/remanejo";
import { categoriasEssenciais } from "@/lib/categories";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { AlertaDoOrcamento } from "@/components/budget/AlertaDoOrcamento";
import { carregarRespostasDoMes, categoriaResolvida } from "@/lib/avisos/respostas";
import { SeuPlano } from "@/components/budget/SeuPlano";
import { vozDoTema } from "@/lib/profiles/voice";
import { getUltimoGastoAte } from "@/lib/repositories/monthly-entry.repo";
import { rotulosDasPersonalizadas } from "@/lib/repositories/casa.repo";

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
  // Plano = categorias com valor (12/10/2026). Só a renda (a do começo, ou a de Meus dados) não é
  // plano: o Orçamento continua no "Montar para mim", com a renda já preenchida para confirmar.
  const customPlan = await getAnnualBudgetPlanForCustomCategories(
    ctx,
    year,
    customCategories.map((c) => c.id),
  );
  const hasPlan = Object.values(plan).some((v) => v > 0) || Object.values(customPlan).some((v) => v > 0);
  // Casal simples: a categoria que o par criou aparece com o nome e o ícone dele (só leitura).
  const personalizadas = await rotulosDasPersonalizadas(
    ctx,
    customCategories,
    comparison.months.flatMap((m) => m.categories.map((c) => c.categoryKey)),
  );
  const customCategoryLabels = new Map([...personalizadas].map(([id, c]) => [id, c.name]));
  const minhasPersonalizadas = new Set(customCategories.map((c) => c.id));
  // O nome de cada categoria-mãe vem do tipo do perfil (Empresa fala "Estrutura", não "Moradia").
  function categoryLabel(categoryKey: string): string {
    if (categoryKey === "SEM") return "Sem categoria";
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
  // O mês de agora é o da pessoa (30/10/2026): com o mês começando dia 15, em 05/11 ainda é outubro.
  const diaInicio = await getDiaInicioMes(ctx);
  const deAgora = mesDeAgora(now, diaInicio);
  const isCurrentYear = year === deAgora.ano;
  // O mês do seletor da Visão geral (?mes=2026-09); sem ele, o mês de agora (ou dezembro, num ano
  // que já passou). É o mês do herói, do "Seu plano" e das categorias.
  const escolhido = periodoDaRota(`/orcamento/${year}`, typeof busca.mes === "string" ? busca.mes : null, now, diaInicio)?.mes;
  const mesEscolhido = escolhido && escolhido.ano === year ? escolhido.mes : isCurrentYear ? deAgora.mes : 12;
  const eMesDeAgora = isCurrentYear && mesEscolhido === deAgora.mes;
  const currentMonthData = comparison.months.find((m) => m.month === mesEscolhido);

  // O resumo que abre a página. Só do mês corrente: "quanto posso gastar por dia" não existe
  // pra um mês que já acabou, e é justamente essa conta que faz o cartão valer a tela.
  const ultimoGasto =
    // A mesma "última data de gasto" do Foco: conta fixa pré-lançada (o aluguel do dia 25) não
    // conta como dado novo, senão uma tela dizia "atualizado" e a outra "dados velhos".
    currentMonthData && eMesDeAgora ? await getUltimoGastoAte(ctx, new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) : null;
  // As categorias do mês no jeito do Copilot (ver CategoriasDoMes): previsão, a vencer, Cobrir.
  // As respostas dela no mês, de qualquer tela (o "O que fazer?" daqui, o Decidir, o Resumo): a
  // categoria que ela já respondeu sai do aviso, e só volta pela regra única (lib/avisos).
  // O livre do mês vem da fonte única (lib/planning/livre-do-mes): o mesmo número do Decidir, do
  // Posso comprar, dos Recorrentes e do widget.
  const [detalhe, respostasDoMes, livre] = currentMonthData
    ? await Promise.all([carregarDetalheDoOrcamento(ctx, year, currentMonthData.month, now), carregarRespostasDoMes(ctx, { ano: year, mes: mesEscolhido }, now), carregarLivreDoMes(ctx, { ano: year, mes: currentMonthData.month })])
    : [null, null, null];
  const aVencerNoMes = detalhe ? Object.values(detalhe.porCategoria).reduce((s, c) => s + c.aVencer, 0) : 0;
  // Gasto sem categoria (importado e ainda sem resposta): entra no Resumo e na semana, então entra
  // aqui também, numa linha própria. Antes o Orçamento dizia "Gastou R$ 4.432" e o Resumo R$ 8.000.
  const semCategoria = detalhe?.porCategoria.SEM ?? null;
  const gastoSemCategoria = semCategoria ? semCategoria.gasto + semCategoria.aVencer : 0;
  const resumoMes =
    currentMonthData
      ? resumoDoMes({
          planejado: livre?.tipo === "plano" ? livre.planejado : currentMonthData.totalPlanned,
          gasto: livre?.tipo === "plano" ? livre.gasto : currentMonthData.totalSpent + gastoSemCategoria,
          hoje: now,
          ano: year,
          mes: currentMonthData.month,
          ultimoGasto,
          // O mês da pessoa (30/10/2026): com dia de início, a régua e os dias restantes são do período dela.
          diaInicio,
        })
      : null;

  const decorrido = currentMonthData ? elapsedRatioOfMonth(now, year, currentMonthData.month, diaInicio) : 0;
  const ROTULO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  // Na ordem do plano, do maior para o menor (protótipo); a que passou é marcada, não sobe.
  const categoriasDoMes = currentMonthData && detalhe
    ? porPlano(
        currentMonthData.categories
          .filter((c) => c.planned > 0 || (detalhe.porCategoria[c.categoryKey]?.gasto ?? 0) + (detalhe.porCategoria[c.categoryKey]?.aVencer ?? 0) > 0)
          .map((c) =>
            categoriaDoMes(
              { key: c.categoryKey, label: categoryLabel(c.categoryKey), planejado: c.planned, gasto: detalhe.porCategoria[c.categoryKey]?.gasto ?? 0, aVencer: detalhe.porCategoria[c.categoryKey]?.aVencer ?? 0 },
              decorrido,
            ),
          ),
      ).concat(
        semCategoria && Math.abs(gastoSemCategoria) >= 1
          ? [categoriaDoMes({ key: "SEM", label: "Sem categoria", planejado: 0, gasto: semCategoria.gasto, aVencer: semCategoria.aVencer }, decorrido)]
          : [],
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
      iconeProprio: personalizadas.get(c.key)?.icon ?? undefined,
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
  const respondidas = respostasDoMes ? linhasDoMes.filter((l) => l.estado === "passou" && categoriaResolvida(respostasDoMes, "estouro", l.key)).map((l) => l.key) : [];
  const essenciais = [...categoriasEssenciais(ctx.categorias?.prefs)];
  const livreDoMes = livre?.tipo === "plano" ? livre.valor : null;
  const avisoRenda = livre ? avisoDaRenda(livre, (v) => money(v, { round: true })) : null;
  const diasRestantes = resumoMes ? Math.max(1, resumoMes.diasRestantes) : 1;

  // "Seu plano" (o resumo que o Editar meu plano abre primeiro): as categorias com plano e as que
  // fogem do padrão dos últimos 3 meses (ver lib/planning/padrao-orcamento.ts).
  const planoTodo: Record<string, number> = { ...plan, ...customPlan };
  // O padrão sugere plano só pras minhas categorias: a do par não é minha pra planejar.
  const ignorarNoPadrao = new Set<string>(Object.keys(hints.padraoByCategory).filter((k) => !isParentCategoryKey(k) && !minhasPersonalizadas.has(k)));
  const resumoDoPlano = {
    // O mês do seletor, o mesmo dos valores (abrindo setembro, era "Seu plano de outubro").
    mes: MONTH_LABELS[mesEscolhido - 1].toLowerCase(),
    itens: (currentMonthData ? currentMonthData.categories.map((c) => [c.categoryKey, c.planned] as const) : Object.entries(planoTodo))
      .filter(([, v]) => v > 0)
      .map(([key, planejado]) => ({ key, label: categoryLabel(key), cor: categoryColor(key), planejado, iconeProprio: personalizadas.get(key)?.icon ?? undefined })),
    ajustes: isCurrentYear ? ajustesDoPadrao({ meses: hints.porMes, plano: planoTodo, ignorar: ignorarNoPadrao }).map((a) => ({ ...a, label: categoryLabel(a.chave) })) : [],
  };

  const assistente = (
    <BudgetWizard
      year={year}
      profileId={ctx.profileId}
      hasPlan={hasPlan}
      hints={hints}
      savingsTargets={savingsTargets}
      mesDeAgora={year === deAgora.ano ? deAgora.mes : undefined}
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
          DELA, e no celular cada linha aqui empurra para fora da tela o número que ela veio ver. */}
      {/* Sem título nem setas de ano (protótipo aprovado): o mês vem do seletor da Visão geral. */}
      <h1 className="sr-only">{voz.titulos.orcamento}</h1>

      {/* Primeira coisa da página, de propósito: é o número que a pessoa veio ver. Tudo o que
          vem depois (categorias, ano, tabela) explica ESTE número. */}
      {/* No computador o número fica à esquerda e o alerta, o plano e os dois quadrados à direita
          (07/10/2026): com a curva dentro do cartão, na largura toda ela ficava do tamanho da tela. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        {/* Mês sem plano (novembro antes de planejar): nada de "R$ 1.800 acima do plano" e "180000%". */}
        {hasPlan && resumoMes && livre?.tipo === "plano" && currentMonthData && (
          // O herói do Orçamento (protótipo aprovado): o plano do mês, o livre grande e uma barra.
          <HeroiDoTema>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] text-heroi-suave">Plano de {MONTH_LABELS[currentMonthData.month - 1].toLowerCase()}</p>
              <p className="text-[15px] tabular-nums text-heroi-tinta">{money(resumoMes.planejado, { round: true })}</p>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <ValorDestaque texto={money(Math.abs(livre.valor), { round: true })} />
              <span className="text-[17px] text-heroi-suave">{livre.valor >= 0 ? "livres" : "acima do plano"}</span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]">
              <div className={`h-full rounded-full ${livre.valor >= 0 ? "bg-[var(--color-heroi-tinta)]" : "bg-danger"}`} style={{ width: `${Math.min(100, (resumoMes.gasto / Math.max(1, resumoMes.planejado)) * 100)}%` }} />
            </div>
            <div className="flex items-baseline justify-between gap-3 text-sm text-heroi-suave">
              {/* O que ainda vai vencer (o curso do dia 25) já pesa no plano, mas não saiu: o "Gastou"
                  é só o que saiu, o mesmo número do Resumo (14/10/2026). */}
              <span className="tabular-nums">
                Gastou {money(resumoMes.gasto - aVencerNoMes, { round: true })}
                {aVencerNoMes >= 1 && ` · ${money(aVencerNoMes, { round: true })} a vencer`}
              </span>
              <span className="tabular-nums">{Math.round((resumoMes.gasto / Math.max(1, resumoMes.planejado)) * 100)}%</span>
            </div>
            {avisoRenda && <p className="text-[13px] text-heroi-suave" data-aviso-renda>{avisoRenda}</p>}
          </HeroiDoTema>
        )}
        <div className="flex min-w-0 flex-col gap-6 lg:gap-4">
          {linhasDoMes.length > 0 && <AlertaDoOrcamento respondidas={respondidas} mes={MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()} linhas={linhasDoMes} essenciais={essenciais} livre={livreDoMes} diasRestantes={diasRestantes} />}
          {linhasDoMes.length > 0 && <SeuPlano itens={linhasDoMes.map((l) => ({ key: l.key, label: l.label, cor: l.cor, planejado: l.planejado, gasto: l.gasto + l.aVencer }))} />}


        </div>
      </div>

      {linhasDoMes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-medium text-ink">Categorias</h2>
            <Explica>A barra fica vermelha perto do plano. Toque numa categoria para ver mais.</Explica>
          </div>
          <CategoriasDoMes hrefTransacoes={`/mensal/${year}/${currentMonthData?.month ?? 1}`} mes={MONTH_LABELS[(currentMonthData?.month ?? 1) - 1].toLowerCase()} linhas={linhasDoMes} essenciais={essenciais} livre={livreDoMes} diasRestantes={diasRestantes} abrirResolvendo={resolver} />
        </section>
      )}

      {/* "Editar meu plano" no fim, largo, como no protótipo. O ano inteiro saiu daqui. */}
      {planoFechado ? (
        <p className="text-sm text-ink-muted">
          {year} já fechou: o plano dele fica como estava, para comparação.{" "}
          <Link href={`/orcamento/${agora.getFullYear()}`} className="font-semibold text-accent-strong hover:underline">
            Planejar {agora.getFullYear()}
          </Link>
        </p>
      ) : hasPlan ? (
        // Com plano: um botão que abre o assistente por cima (ver EditarPlano). Sem plano, ele é
        // a própria página e continua aberto aqui.
        <EditarPlano rotulo="Editar meu plano" titulo={voz.titulos.formOrcMontar} largo resumo={resumoDoPlano}>
          {assistente}
        </EditarPlano>
      ) : (
        <ComecarOrcamento titulo={voz.titulos.formOrcVazioTitulo} sub={voz.titulos.formOrcVazioSub} botao={voz.titulos.formOrcVazioBotao} tituloDaFolha={voz.titulos.formOrcMontar}>
          {assistente}
        </ComecarOrcamento>
      )}
    </div>
  );
}
