import type { ParentCategory } from "@prisma/client";
import { comFiltro, donoDoOrcamento, lancamentosDosTotais } from "@/lib/casa/regras";
import type { AuthContext } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { categoryLabel } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { contarGastosReaisDoMes, getUltimoGastoAte, listEntriesForMonths, somarGastosPreCriados } from "@/lib/repositories/monthly-entry.repo";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { prisma } from "@/lib/db/prisma";
import { carregarRevisaoAntigos } from "./revisar/dados";
import { lerFechamento } from "@/lib/repositories/fechamento.repo";
import { existeDecisao, lerDecisao, listarAvisosDispensados, listarCancelamentosPraConfirmar, listarCompraAmanhaPendentes, listarDecisoesRaioX, listarTetosDoMes } from "@/lib/repositories/decisao.repo";
import { computeGoalPlan } from "@/lib/planning/goal";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { gastoDepoisDoCombinado, montarFoco } from "@/lib/decisoes/foco";
import { diaDaSemana } from "@/lib/decisoes/foco-semana";
import { CATEGORIAS_FIXAS, lancamentoDaConta, type ContaPendente, type GastoDoDiaADia } from "@/lib/decisoes/semana-fixa";
import { parcelaDaDescricao } from "@/lib/decisoes/compra-guiada";
import { ehDoAno, pagaNoMes } from "@/lib/contas/recorrentes";
import { ehDoCartao } from "@/lib/cartao/limite";
import { doDono } from "@/lib/auth/session";
import { acharRecorrentes } from "@/lib/decisoes/raio-x";
import { chaveDaSemana, chaveDoMes, lerRitmo } from "./ritmo";

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIA_MS = 86_400_000;
/** Quantos gastos a lista de um aviso tem ao todo, e quanto somam (ela mostra só os maiores). */
export type ResumoDaLista = { n: number; total: number };

/** Os últimos N meses antes do atual (pra achar o que se repete). */
function mesesAnteriores(ano: number, mes: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ano, mes - 2 - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

/**
 * Tudo que o Raio-X precisa: os gastos recorrentes e o que a pessoa já decidiu sobre cada um.
 * Só meses fechados: o mês corrente pela metade puxaria a média dos hábitos pra baixo.
 */
export async function carregarRaioX(ctx: AuthContext, ano: number, mes: number) {
  const meses = mesesAnteriores(ano, mes, 5);
  const [entradas, decididos] = await Promise.all([listEntriesForMonths(ctx, meses), listarDecisoesRaioX(ctx)]);
  const itens = acharRecorrentes(
    entradas
      .filter((e) => e.category === "EXPENSE")
      .map((e) => ({ description: e.description, amount: Number(e.amount), year: e.year, month: e.month, parentCategory: e.parentCategory, subcategory: e.subcategory })),
  );
  // Só as assinaturas (protótipo, "Que pequenos gastos posso cortar?": Netflix, Spotify, iCloud).
  // Uber e iFood são hábitos de vários valores, não uma cobrança fixa para cancelar, e somados
  // inflavam o "por ano" do Decidir (auditoria de 11/10/2026).
  return { itens: itens.filter((i) => i.tipo === "assinatura"), decididos };
}

/**
 * Carrega o mês da pessoa uma vez e monta tudo que as telas de decisão usam: a aba Foco, o
 * ritual da semana e o fechamento do mês leem daqui, pra nunca mostrarem números diferentes.
 */
export async function carregarFoco(ctx: AuthContext) {
  const money = await serverMoney();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const t = voz.titulos;
  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dia = now.getDate();
  const diasNoMes = new Date(year, month, 0).getDate();
  const anterior = new Date(year, month - 2, 1);
  const mesAnterior = { year: anterior.getFullYear(), month: anterior.getMonth() + 1, label: MESES[anterior.getMonth()] };
  const semana = chaveDaSemana(now);

  const inicioDoMes = new Date(Date.UTC(year, month - 1, 1, 3));
  const [user, budgets, spentByParent, spentByCustom, customCategories, summary, plan, goals, fund, lastExpense, tetos, pendentes, ritualFeito, fechamentoDoMesAnterior, raiox, gastosReais, preCriados, cancelamentos, viradaFeita, lancamentosAnoPassado, paraRevisar, dispensados, gastosDoMes, orcamentoMesAnterior, linhasDoMes, contasDaLista, ultimoCartao, rendaConta] =
    await Promise.all([
      getOwnUser(ctx),
      listBudgets(ctx, year, month),
      sumExpensesByParentCategory(ctx, year, month),
      sumExpensesByCustomCategory(ctx, year, month),
      listCustomCategories(ctx),
      getMonthlySummary(ctx, year, month),
      getMonthlyPlan(ctx, year, month),
      listGoalsWithProgress(ctx),
      getEmergencyFund(ctx),
      getUltimoGastoAte(ctx, new Date(Date.UTC(year, month - 1, dia))),
      listarTetosDoMes(ctx, chaveDoMes(year, month)),
      listarCompraAmanhaPendentes(ctx),
      existeDecisao(ctx, "ritual", semana),
      lerFechamento(ctx, mesAnterior.year, mesAnterior.month),
      // O Raio-X é da pessoa: a empresa nem busca os 5 meses de extrato.
      ehEmpresa(ctx.profileKind) ? { itens: [], decididos: new Set<string>() } : carregarRaioX(ctx, year, month),
      contarGastosReaisDoMes(ctx, year, month),
      somarGastosPreCriados(ctx, year, month),
      listarCancelamentosPraConfirmar(ctx, new Date(Date.UTC(year, month - 1, 1, 3)), `${year}-${String(month).padStart(2, "0")}`),
      // Virada do ano: só nos 3 primeiros meses, e só pra quem usou o app no ano passado.
      month <= 3 ? existeDecisao(ctx, "virada_ano", String(year)) : Promise.resolve(true),
      month <= 3 ? prisma.monthlyEntry.count({ where: { userId: ctx.userId, profileId: ctx.profileId, year: year - 1 } }) : Promise.resolve(0),
      carregarRevisaoAntigos(ctx),
      listarAvisosDispensados(ctx, chaveDoMes(year, month), semana),
      // Cada gasto do mês: é o que a janela de um aviso mostra ("onde foi o dinheiro") e deixa
      // classificar ali mesmo.
      prisma.monthlyEntry.findMany({
        // Casal simples: os gastos dos dois que eu enxergo, os mesmos dos totais.
        where: comFiltro(lancamentosDosTotais(ctx), { year, month, category: "EXPENSE" }),
        select: { id: true, description: true, subcategory: true, amount: true, entryDate: true, parentCategory: true, customCategoryId: true, recurrenceId: true, createdAt: true },
        orderBy: { amount: "desc" },
        take: 400,
      }),
      // Orçamento do mês passado montado ANTES de ele acabar (07/10/2026): quem chegou agora e
      // importou o extrato de setembro tem lançamento lá, mas nunca planejou setembro. O "Fechar
      // setembro" no 1º dia comparava com um plano que não existia, e virava "o número está errado".
      prisma.budget.count({
        where: { ...donoDoOrcamento(ctx), year: mesAnterior.year, month: mesAnterior.month, plannedAmount: { gt: 0 }, createdAt: { lt: new Date(Date.UTC(year, month - 1, 1, 3)) } },
        take: 1,
      }),
      // A semana fixa (regra A, 13/10/2026): cada gasto do mês, leve, para separar conta de dia a
      // dia e saber quando cada um aconteceu e quando entrou no app.
      prisma.monthlyEntry.findMany({
        where: comFiltro(lancamentosDosTotais(ctx), { year, month, category: "EXPENSE" }),
        select: { amount: true, entryDate: true, createdAt: true, parentCategory: true, customCategoryId: true, recurrenceId: true, description: true, subcategory: true, importBatchId: true, externalId: true },
        take: 5000,
      }),
      // As contas da lista (Recorrentes): as em aberto e as pagas neste mês, para reservar a que
      // ainda não saiu e reconhecer a que já apareceu nos lançamentos.
      prisma.contaAPagar.findMany({
        where: { ...doDono(ctx), OR: [{ quitada: false }, { pagaEm: { gte: inicioDoMes } }] },
        select: { nome: true, valor: true, vencimento: true, pagaEm: true, repete: true, intervalo: true, unidade: true, mesesEscolhidos: true, parcelas: true, categoria: true, quitada: true },
        take: 300,
      }),
      // O último gasto no cartão (marcado ou de fatura) nos últimos 75 dias: o aviso "falta o cartão".
      prisma.monthlyEntry.findMany({
        where: comFiltro(lancamentosDosTotais(ctx), {
          category: "EXPENSE",
          createdAt: { gte: new Date(Date.UTC(year, month - 1, dia - 75)) },
          OR: [{ noCartao: true }, { noCartao: null, importBatch: { is: { docType: "fatura" } } }],
        }),
        select: { entryDate: true, createdAt: true, noCartao: true, importBatch: { select: { docType: true } } },
        orderBy: [{ entryDate: { sort: "desc", nulls: "last" } }],
        take: 40,
      }),
      // "Minha renda varia: conto só o que já entrou" (regra A): a escolha dela, por perfil.
      lerDecisao(ctx, "renda_da_semana", "renda"),
    ]);
  const fechamento = fechamentoDoMesAnterior;
  const ritmo = lerRitmo(user.ritmoAcompanhamento);

  // Os combinados contam só o que aconteceu DEPOIS deles (ver gastoDepoisDoCombinado): basta o
  // que entrou no app desde o primeiro combinado do mês. E a lista de um aviso mostra só os
  // maiores gastos: a contagem e o total de verdade vêm à parte, pra os números baterem.
  const desdeOPrimeiroCombinado = tetos.length > 0 ? new Date(Math.min(...tetos.map((x) => x.combinadoEm.getTime()))) : null;
  const [gastosDesdeOCombinado, resumoDosGastos] = await Promise.all([
    desdeOPrimeiroCombinado
      ? prisma.monthlyEntry.findMany({
          where: comFiltro(lancamentosDosTotais(ctx), { year, month, category: "EXPENSE", createdAt: { gte: desdeOPrimeiroCombinado } }),
          select: { amount: true, entryDate: true, createdAt: true, importBatchId: true, externalId: true, parentCategory: true, customCategoryId: true },
        })
      : Promise.resolve([]),
    prisma.monthlyEntry.groupBy({
      by: ["parentCategory", "customCategoryId"],
      where: comFiltro(lancamentosDosTotais(ctx), { year, month, category: "EXPENSE" }),
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  // O dia do combinado no calendário do Brasil ("2026-09-12"), no formato da data do gasto.
  const diaNoBrasil = (instante: Date) => {
    const b = nowInBrazil(instante);
    return `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}`;
  };
  const tetosDoFoco = tetos.map((x) => ({
    ...x,
    gastoDepois: gastoDepoisDoCombinado(
      gastosDesdeOCombinado
        .filter((g) => (g.customCategoryId ?? g.parentCategory) === x.categoria)
        .map((g) => ({ valor: Number(g.amount), dia: g.entryDate ? g.entryDate.toISOString().slice(0, 10) : null, criadoEm: g.createdAt, importado: g.importBatchId !== null || g.externalId !== null })),
      x.combinadoEm,
      diaNoBrasil(x.combinadoEm),
    ),
  }));

  const nomePersonalizada = new Map(customCategories.map((c) => [c.id, c.name]));
  const gastoPorMae = new Map(spentByParent.map((s) => [s.parentCategory as string, s.spent]));
  const gastoPorPersonalizada = new Map(spentByCustom.map((s) => [s.customCategoryId, s.spent]));
  const rotulosDasMaes = new Set(budgets.filter((b) => b.parentCategory).map((b) => categoryLabel(ctx.categorias ?? ctx.profileKind, b.parentCategory as ParentCategory)));
  const categorias = budgets
    .filter((b) => Number(b.plannedAmount) > 0)
    .map((b) => {
      if (b.parentCategory) {
        const key = b.parentCategory as string;
        return { key, label: categoryLabel(ctx.categorias ?? ctx.profileKind, b.parentCategory as ParentCategory), planejado: Number(b.plannedAmount), gasto: Math.max(0, gastoPorMae.get(key) ?? 0), fixa: CATEGORIAS_FIXAS.has(key), fixoAutomatico: preCriados.porMae.get(key) ?? 0 };
      }
      const nome = nomePersonalizada.get(b.customCategoryId ?? "") ?? "Personalizada";
      // Personalizada com o mesmo nome de uma categoria-mãe: sem diferenciar, a tela dizia
      // "Alimentação estourou" e "Alimentação dentro do ritmo" ao mesmo tempo.
      const label = rotulosDasMaes.has(nome) ? `${nome} (personalizada)` : nome;
      return { key: b.customCategoryId ?? b.id, label, planejado: Number(b.plannedAmount), gasto: Math.max(0, gastoPorPersonalizada.get(b.customCategoryId ?? "") ?? 0), fixa: false, fixoAutomatico: preCriados.porPersonalizada.get(b.customCategoryId ?? "") ?? 0 };
    });

  const hoje = new Date(Date.UTC(year, month - 1, dia));
  const metas = goals
    .map((g) => {
      const atingida = g.computedCurrentAmount >= Number(g.targetAmount);
      // Meta sem data não tem "atrasada": não há prazo pra cobrar. Entra só no fio, por último.
      if (!g.targetDate) {
        return { id: g.id, nome: g.name, status: atingida ? ("ACHIEVED" as const) : ("NOT_STARTED" as const), quando: "sem data definida", porMes: 0, semData: true };
      }
      const p = computeGoalPlan({ targetAmount: Number(g.targetAmount), currentAmount: g.computedCurrentAmount, targetDate: g.targetDate, annualRate: Number(g.annualRate ?? 0), startedAt: g.createdAt });
      // Vencida só depois que o MÊS do prazo acabou: a meta de viagem guarda o dia 1 como prazo, e
      // "até setembro" não pode virar "o prazo já passou" no dia 2 de setembro.
      const fimDoMesDoPrazo = Date.UTC(g.targetDate.getUTCFullYear(), g.targetDate.getUTCMonth() + 1, 0);
      const vencida = !atingida && fimDoMesDoPrazo < hoje.getTime();
      const ultimoMes = !atingida && !vencida && p.monthsRemaining === 0;
      return { id: g.id, nome: g.name, status: vencida ? ("BEHIND" as const) : p.status, quando: `${MESES[g.targetDate.getUTCMonth()]} de ${g.targetDate.getUTCFullYear()}`, porMes: p.requiredMonthlyContribution, vencida, ultimoMes, semData: false };
    })
    .sort((a, b) => Number(a.semData) - Number(b.semData));

  const m = (v: number) => money(v, { round: true });
  const hrefMes = `/mensal/${year}/${month}`;
  const aportePlanejado = plan && plan.plannedInvestment > 0 ? plan.plannedInvestment : null;
  const empresa = ehEmpresa(ctx.profileKind);
  // O Raio-X é dos "pequenos gastos" de uma pessoa; a empresa não tem Decidir.
  const naoDecididos = empresa ? [] : raiox.itens.filter((i) => !raiox.decididos.has(i.chave));

  // A semana fixa (regra A): cada gasto do mês é conta (sai inteira desde o dia 1) ou dia a dia.
  // Conta: categoria fixa com orçamento, lançada antes do mês (recorrente, parcela futura da
  // fatura), marcada para repetir, parcela ("LOJA 03/10") ou o pagamento de uma conta da lista.
  const hojeIso = `${year}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const lista = contasDaLista.map((c) => ({
    id: "",
    nome: c.nome,
    valor: c.valor === null ? null : Number(c.valor),
    vencimento: c.vencimento.toISOString().slice(0, 10),
    pagaEm: c.pagaEm ? diaNoBrasil(c.pagaEm) : null,
    diaDoMes: null,
    parcelaAtual: null,
    aproximado: false,
    repete: c.repete,
    intervalo: c.intervalo,
    unidade: c.unidade,
    mesesEscolhidos: c.mesesEscolhidos ?? [],
    parcelas: c.parcelas,
    categoria: (c.categoria as string | null) ?? null,
    quitada: c.quitada,
  }));
  const fixasComOrcamento = new Set(categorias.filter((c) => c.fixa).map((c) => c.key));
  const contaPaga = new Set<number>();
  const gastosDoDiaADia: GastoDoDiaADia[] = [];
  let contasLancadas = 0;
  for (const g of linhasDoMes) {
    const valor = Number(g.amount);
    const chave = g.customCategoryId ?? (g.parentCategory as string | null);
    if (chave && fixasComOrcamento.has(chave)) continue; // já está no planejado inteiro da fixa
    const doLancamento = { descricao: g.description, subcategoria: g.subcategory, valor, categoria: (g.parentCategory as string | null) ?? null };
    const daLista = lista.findIndex((c) => lancamentoDaConta(doLancamento, c));
    if (daLista >= 0) contaPaga.add(daLista);
    const ehConta =
      daLista >= 0 ||
      g.createdAt < inicioDoMes ||
      g.recurrenceId !== null ||
      CATEGORIAS_FIXAS.has(g.parentCategory ?? "") ||
      parcelaDaDescricao(g.description ?? "") !== null;
    if (ehConta) {
      contasLancadas += valor;
      continue;
    }
    const entrou = nowInBrazil(g.createdAt);
    gastosDoDiaADia.push({
      valor,
      dia: g.entryDate && g.entryDate.getUTCFullYear() === year && g.entryDate.getUTCMonth() + 1 === month ? g.entryDate.getUTCDate() : g.entryDate && g.entryDate.toISOString().slice(0, 10) < hojeIso ? 0 : null,
      entrouNoDia: entrou.getFullYear() === year && entrou.getMonth() + 1 === month ? entrou.getDate() : 0,
      importado: g.importBatchId !== null || g.externalId !== null,
    });
  }
  // A conta da lista que ainda não apareceu nos lançamentos e vence até o fim do mês (ou já venceu).
  const fimDoMesIso = `${year}-${String(month).padStart(2, "0")}-${String(diasNoMes).padStart(2, "0")}`;
  const hojeUtc = new Date(Date.UTC(year, month - 1, dia));
  const contasPendentes: ContaPendente[] = lista
    .filter((c, i) => !c.quitada && !contaPaga.has(i) && !ehDoAno(c) && !pagaNoMes(c, hojeUtc) && c.vencimento <= fimDoMesIso && (c.valor ?? 0) > 0)
    .map((c) => ({ valor: c.valor ?? 0, categoria: c.categoria }));

  // "Conto só o que já entrou": a renda é o que entrou no mês até agora. Senão, a planejada.
  const rendaSoOQueEntrou = rendaConta === "entrou";
  const rendaPlanejada = plan && plan.plannedIncome > 0 ? plan.plannedIncome : null;
  const renda = rendaSoOQueEntrou ? summary.totalIncome : rendaPlanejada;

  // Falta o cartão: ela usa cartão (gasto no cartão nos últimos 75 dias) e o último é de mais de
  // 7 dias atrás. Fatura sem dia por compra vale pelo dia em que foi importada.
  const datasDoCartao = ultimoCartao
    .filter((g) => ehDoCartao(g))
    .map((g) => (g.entryDate ? g.entryDate.getTime() : Date.UTC(nowInBrazil(g.createdAt).getFullYear(), nowInBrazil(g.createdAt).getMonth(), nowInBrazil(g.createdAt).getDate())));
  const ultimoDoCartao = datasDoCartao.length > 0 ? new Date(Math.min(hojeUtc.getTime(), Math.max(...datasDoCartao))) : null;
  const diasSemCartao = ultimoDoCartao ? Math.round((hojeUtc.getTime() - ultimoDoCartao.getTime()) / DIA_MS) : null;
  const faltaOCartao = ultimoDoCartao && diasSemCartao !== null && diasSemCartao > 7 ? { dia: ultimoDoCartao.getUTCDate(), mes: ultimoDoCartao.getUTCMonth() + 1, dias: diasSemCartao } : null;

  const foco = montarFoco({
    ritmo: ritmo ?? "semanal",
    dia,
    diasAteDomingo: diaDaSemana(now).diasAteDomingo,
    diasNoMes,
    categorias,
    gastoDoMes: summary.totalExpense,
    // Avulso: sem "repetir", lançado no próprio mês e fora das contas fixas (essas já não correm).
    gastosAvulsos: gastosDoMes
      .filter((g) => !g.recurrenceId && g.createdAt >= inicioDoMes && !CATEGORIAS_FIXAS.has(g.parentCategory ?? ""))
      .map((g) => Number(g.amount)),
    lancouGastoNoMes: gastosReais > 0,
    aportadoNoMes: summary.totalInvestment,
    aportePlanejado,
    diasDesdeUltimoGasto: lastExpense ? Math.max(0, Math.round((hoje.getTime() - lastExpense.getTime()) / DIA_MS)) : null,
    metas,
    reserva: fund && Number(fund.monthlyExpenseBase) > 0 ? { atual: Number(fund.currentAmount), custoMensal: Number(fund.monthlyExpenseBase) } : null,
    // A meta de meses que ELA escolheu na tela da reserva (a mesma que o Painel usa pra dizer
    // "100% concluída"); sem reserva montada, a referência da aula (6) ou do Sebrae (3).
    reservaMinimaMeses: fund && fund.targetMonths > 0 ? fund.targetMonths : empresa ? 3 : 6,
    hrefMes,
    tetos: tetosDoFoco,
    dispensados,
    diaADia: { gastos: gastosDoDiaADia, contasLancadas, pendentes: contasPendentes },
    renda,
    rendaFonte: renda === null ? null : rendaSoOQueEntrou ? "entrou" : "plano",
    raiox: naoDecididos.length > 0 ? { n: naoDecididos.length, anual: naoDecididos.reduce((s, i) => s + i.anual, 0) } : null,
    money: m,
    t,
  });

  // Gastos do mês por categoria do orçamento, e os que estão FORA dele (sem categoria, ou numa
  // categoria sem valor planejado). A janela do aviso lista e deixa classificar na hora.
  const chaveDoGasto = (g: (typeof gastosDoMes)[number]) => g.customCategoryId ?? (g.parentCategory as string | null);
  const noOrcamento = new Set(categorias.map((c) => c.key));
  const rotuloDe = (g: (typeof gastosDoMes)[number]) =>
    g.parentCategory ? categoryLabel(ctx.categorias ?? ctx.profileKind, g.parentCategory) : g.customCategoryId ? (nomePersonalizada.get(g.customCategoryId) ?? "Personalizada") : null;
  const paraLista = (g: (typeof gastosDoMes)[number]) => ({
    id: g.id,
    descricao: g.description ?? g.subcategory ?? "Sem descrição",
    dia: g.entryDate ? g.entryDate.getUTCDate() : null,
    valor: Number(g.amount),
    categoria: rotuloDe(g),
  });
  const gastosFora = gastosDoMes.filter((g) => { const k = chaveDoGasto(g); return !k || !noOrcamento.has(k); }).slice(0, 60).map(paraLista);
  const gastosPorCategoria: Record<string, ReturnType<typeof paraLista>[]> = {};
  for (const g of gastosDoMes) {
    const k = chaveDoGasto(g);
    if (!k || !noOrcamento.has(k)) continue;
    const lista = (gastosPorCategoria[k] ??= []);
    if (lista.length < 15) lista.push(paraLista(g));
  }
  // Quantos gastos e quanto somam de verdade, por categoria e fora do orçamento: a lista acima
  // para em 15 (ou 60), e sem isso dizia "15 gastos · R$ 620" do lado de "Gasto R$ 1.140".
  const resumoPorCategoria: Record<string, ResumoDaLista> = {};
  const resumoFora: ResumoDaLista = { n: 0, total: 0 };
  for (const r of resumoDosGastos) {
    const k = r.customCategoryId ?? (r.parentCategory as string | null);
    const alvo = k && noOrcamento.has(k) ? (resumoPorCategoria[k] ??= { n: 0, total: 0 }) : resumoFora;
    alvo.n += r._count._all;
    alvo.total += Number(r._sum.amount ?? 0);
  }
  const opcoesDeCategoria = categorias.map((c) => ({ key: c.key, label: c.label }));
  const maioresGastos = gastosDoMes.slice(0, 5).map(paraLista);
  const raioxAnual = naoDecididos.reduce((s, i) => s + i.anual, 0);

  return {
    t,
    m,
    gastosFora,
    maioresGastos,
    raioxAnual,

    gastosPorCategoria,
    resumoPorCategoria,
    resumoFora,
    opcoesDeCategoria,
    empresa,
    ritmo,
    now,
    year,
    month,
    dia,
    diasNoMes,
    mesLabel: MESES[month - 1],
    mesAnterior,
    semana,
    hrefMes,
    categorias,
    tetos,
    summary,
    aportePlanejado,
    rendaSoOQueEntrou,
    faltaOCartao,
    // Só a renda PLANEJADA (sem cair no que entrou): é o que o "Fim do mês" pelo plano usa.
    rendaPlanejada: plan && plan.plannedIncome > 0 ? plan.plannedIncome : null,
    // A renda do mês para o "plano apertado": a planejada, ou o que já entrou.
    rendaDoMes: plan && plan.plannedIncome > 0 ? plan.plannedIncome : summary.totalIncome,
    fund,
    // createdAt é um instante real; nowInBrazil() é um relógio deslocado. A conta é com Date.now().
    cancelamentos,
    viradaPendente: !viradaFeita && lancamentosAnoPassado > 0,
    // Fechar um mês em que ela nem usava o app (conta criada agora) só elogiava um plano que não
    // existia: só oferece quando o mês passado teve orçamento montado enquanto ainda corria.
    mesAnteriorTinhaPlano: orcamentoMesAnterior > 0,
    lancamentosParaRevisar: paraRevisar.length,
    pendentes: pendentes.filter((p) => Date.now() - p.createdAt.getTime() > 20 * 3_600_000),
    ritualFeito,
    fechamentoFeito: fechamento.estado === "fechado",
    fechamento,
    foco,
  };
}
