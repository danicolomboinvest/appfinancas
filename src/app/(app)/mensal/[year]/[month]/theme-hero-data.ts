import type { AuthContext } from "@/lib/auth/session";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { listEntriesForMonths } from "@/lib/repositories/monthly-entry.repo";
import { categoryLabel, isParentCategoryKey } from "@/lib/categories";
import type { MonthlySummary } from "@/lib/consolidation/monthly";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { profileTheme, type ProfileThemeKey } from "@/lib/profiles/themes";
import { estadoDoMes, type Estado, type Money } from "@/lib/profiles/voice";
import { recadoDeHoje, type Recado } from "@/lib/profiles/recado";
import { comboFeito, conquistas, divisao, pontosDaTemporada, sequenciaDeTemporadas, type Conquista, type Divisao } from "@/lib/profiles/game-score";

/**
 * O que o card de cada tema precisa saber, já calculado.
 *
 * Fica separado da página porque cada tema pede números diferentes — o Game quer seis meses
 * de registros pra pontuar, o Disciplina quer orçamento por categoria e meses seguidos
 * guardando, o Manifestação quer metas com progresso — e a página do mês já é longa o bastante.
 * Só consulta o que o tema ativo usa: o Padrão não paga nenhuma ida ao banco a mais.
 */
export type DadosDoTema = {
  tema: ProfileThemeKey;
  estado: Estado;
  /** Disciplina: o recado disparado por uma condição real. */
  recado: Recado | null;
  /** Disciplina e Manifestação: a próxima meta, com quanto já tem. */
  metaEmAndamento: { id: string; nome: string; pct: number; alvo: number; prazo: string | null } | null;
  /** A meta mais recente que chegou a 100%. */
  metaBatida: { nome: string } | null;
  /** Game: divisão, sequência, pontos da temporada, o histórico das últimas seis e as conquistas. */
  game: {
    divisao: Divisao;
    sequencia: number;
    pontosDoMes: number;
    diasParaFechar: number;
    recorde: boolean;
    /** O combo do mês aberto: lançou? aportou? Os dois fecham a temporada. */
    combo: { registrou: boolean; aportou: boolean };
    /** As últimas seis temporadas, da mais antiga pra atual: o "histórico de partidas". */
    historico: { mes: string; pontos: number; combo: boolean; atual: boolean }[];
    conquistas: Conquista[];
  } | null;
  /** Manifestação: o mural, uma meta por sonho. */
  sonhos: { nome: string; pct: number }[];
  /** Manifestação: quanto entrou este mês pra meta em andamento. */
  maisPerto: number;
  /** Sem filtro: a categoria que mais levou dinheiro. */
  campeao: { key: string; label: string; count: number; amount: number; diasDecorridos: number } | null;
};

type Entrada = {
  year: number;
  month: number;
  category: string;
  amount: { toString(): string } | number;
  entryDate: Date | null;
};

type Agregado = { income: number; expense: number; investment: number; registros: number; dias: Set<string> };

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function agregarPorMes(entradas: Entrada[]): Map<string, Agregado> {
  const porMes = new Map<string, Agregado>();
  for (const e of entradas) {
    const chave = `${e.year}-${e.month}`;
    const a = porMes.get(chave) ?? { income: 0, expense: 0, investment: 0, registros: 0, dias: new Set<string>() };
    const valor = Number(e.amount);
    a.registros += 1;
    if (e.category === "INCOME") a.income += valor;
    else if (e.category === "EXPENSE") a.expense += valor;
    else if (e.category === "INVESTMENT_CONTRIBUTION") a.investment += valor;
    if (e.entryDate) a.dias.add(e.entryDate.toISOString().slice(0, 10));
    porMes.set(chave, a);
  }
  return porMes;
}

/** Os N meses até este, do mais antigo pro atual. */
function ultimosMeses(year: number, month: number, n: number): { year: number; month: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(year, month - 1 - (n - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export async function montarDadosDoTema(
  ctx: AuthContext,
  a: {
    year: number;
    month: number;
    now: Date;
    isCurrentMonth: boolean;
    daysInMonth: number;
    mesFechado: boolean;
    summary: MonthlySummary;
    previousSummary: MonthlySummary;
    monthBudgets: { parentCategory: string | null; plannedAmount: { toString(): string } | number }[];
    spentByParent: { parentCategory: string; spent: number }[];
    categorySpending: CategorySpending[];
    entriesDoMes: { category: string; amount: number; goalId: string | null }[];
    money: Money;
  },
): Promise<DadosDoTema> {
  const tema = profileTheme(ctx.profileTheme).key;
  const mesAtual = { income: a.summary.totalIncome, expense: a.summary.totalExpense, investment: a.summary.totalInvestment };
  const estado = estadoDoMes(mesAtual);
  const vazio: DadosDoTema = { tema, estado, recado: null, metaEmAndamento: null, metaBatida: null, game: null, sonhos: [], maisPerto: 0, campeao: null };

  if (tema === "padrao" || tema === "minimalista" || tema === "girly") return vazio;

  if (tema === "semfiltro") {
    const campeao = [...a.categorySpending].sort((x, y) => y.amount - x.amount)[0];
    return {
      ...vazio,
      campeao: campeao && campeao.amount > 0
        ? { key: campeao.key, label: campeao.label, count: campeao.count, amount: campeao.amount, diasDecorridos: a.isCurrentMonth ? a.now.getDate() : a.daysInMonth }
        : null,
    };
  }

  // Daqui pra baixo os três temas que olham pra frente: metas e histórico.
  const precisaHistorico = tema === "game" || tema === "disciplina";
  const [goals, historico] = await Promise.all([
    listGoalsWithProgress(ctx),
    precisaHistorico ? listEntriesForMonths(ctx, ultimosMeses(a.year, a.month, 6)) : Promise.resolve([]),
  ]);

  const comProgresso = goals.map((g) => {
    const alvo = Number(g.targetAmount);
    const pct = alvo > 0 ? Math.min(100, Math.round((g.computedCurrentAmount / alvo) * 100)) : 0;
    return { id: g.id, nome: g.name, alvo, pct, faltam: Math.max(0, alvo - g.computedCurrentAmount), prazo: g.targetDate };
  });
  const emAndamento = comProgresso.find((g) => g.pct < 100) ?? null;
  const batida = comProgresso.find((g) => g.pct >= 100) ?? null;
  const metaEmAndamento = emAndamento
    ? {
        id: emAndamento.id,
        nome: emAndamento.nome,
        pct: emAndamento.pct,
        alvo: emAndamento.alvo,
        prazo: emAndamento.prazo ? emAndamento.prazo.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) : null,
      }
    : null;
  const metaBatida = batida ? { nome: batida.nome } : null;

  if (tema === "manifestacao") {
    const maisPerto = emAndamento
      ? a.entriesDoMes.filter((e) => e.category === "INVESTMENT_CONTRIBUTION" && e.goalId === emAndamento.id).reduce((s, e) => s + e.amount, 0)
      : 0;
    return { ...vazio, metaEmAndamento, metaBatida, sonhos: comProgresso.slice(0, 3).map((g) => ({ nome: g.nome, pct: g.pct })), maisPerto };
  }

  const porMes = agregarPorMes(historico as Entrada[]);
  const meses = ultimosMeses(a.year, a.month, 6);
  const agregados = meses.map((m) => porMes.get(`${m.year}-${m.month}`) ?? { income: 0, expense: 0, investment: 0, registros: 0, dias: new Set<string>() });
  const anteriores = agregados.slice(0, -1);

  if (tema === "game") {
    const metasConcluidas = comProgresso.filter((g) => g.pct >= 100).length;
    // O combo de cada temporada: lançou alguma coisa E aportou. Ninguém precisa registrar todo
    // dia — quem lança uma vez por mês e faz o aporte fecha a temporada igual.
    const temporadas = agregados.map((m, i) => ({
      registrou: m.registros > 0,
      aportou: m.investment > 0,
      guardouBem: estadoDoMes(m) === "bom",
      metasConcluidas: i === agregados.length - 1 ? metasConcluidas : 0,
    }));
    const pontos = temporadas.map(pontosDaTemporada);
    const combos = temporadas.map(comboFeito);
    const saldo = (m: { income: number; expense: number; investment: number }) => m.income - m.expense - m.investment;
    const recorde = anteriores.some((m) => m.income > 0) && saldo(mesAtual) > Math.max(...anteriores.map(saldo));
    const sequencia = sequenciaDeTemporadas(combos);
    const esteMes = temporadas[temporadas.length - 1];
    // Temporada limpa: existe limite e nenhuma categoria passou dele. Sem limite não conta —
    // seria conquista de graça.
    const gastoPorCategoria = new Map(a.spentByParent.map((s) => [s.parentCategory, s.spent]));
    const limites = a.monthBudgets.filter((b) => b.parentCategory && Number(b.plannedAmount) > 0);
    const temporadaLimpa = limites.length > 0 && limites.every((b) => (gastoPorCategoria.get(b.parentCategory!) ?? 0) <= Number(b.plannedAmount));
    return {
      ...vazio,
      metaEmAndamento,
      metaBatida,
      game: {
        divisao: divisao(pontos),
        sequencia,
        pontosDoMes: pontos[pontos.length - 1],
        diasParaFechar: a.isCurrentMonth ? a.daysInMonth - a.now.getDate() : 0,
        recorde,
        combo: { registrou: esteMes.registrou, aportou: esteMes.aportou },
        historico: meses.map((m, i) => ({ mes: MES_CURTO[m.month - 1], pontos: pontos[i], combo: combos[i], atual: i === meses.length - 1 })),
        conquistas: conquistas({
          sequencia,
          comboNoMes: combos[combos.length - 1],
          guardouBemNoMes: estado === "bom",
          metasConcluidas,
          temporadaLimpa,
          temporadasComCombo: combos.filter(Boolean).length,
        }),
      },
    };
  }

  // Disciplina.
  let mesesSeguidosGuardando = 0;
  for (let i = anteriores.length - 1; i >= 0; i--) {
    const m = anteriores[i];
    if (m.income > 0 && m.income - m.expense > 0) mesesSeguidosGuardando += 1;
    else break;
  }
  const gastoPorCategoria = new Map(a.spentByParent.map((s) => [s.parentCategory, s.spent]));
  const categorias = a.monthBudgets.flatMap((b) =>
    b.parentCategory && isParentCategoryKey(b.parentCategory)
      ? [{ label: categoryLabel(ctx.profileKind, b.parentCategory), planejado: Number(b.plannedAmount), gasto: gastoPorCategoria.get(b.parentCategory) ?? 0 }]
      : [],
  );
  const recado = recadoDeHoje({
    categorias,
    mesDecorrido: a.isCurrentMonth ? a.now.getDate() / a.daysInMonth : 1,
    diasRestantes: a.isCurrentMonth ? a.daysInMonth - a.now.getDate() : 0,
    mesesSeguidosGuardando,
    metas: comProgresso.filter((g) => g.pct < 100 && g.prazo).map((g) => ({ nome: g.nome, faltam: g.faltam })),
    gastoDoMes: a.summary.totalExpense,
    gastoDoMesAnterior: a.previousSummary.totalExpense,
    rendaDoMes: a.summary.totalIncome,
    rendaDoMesAnterior: a.previousSummary.totalIncome,
    planejadoDoMes: categorias.reduce((s, c) => s + c.planejado, 0),
    mesFechado: a.mesFechado,
    money: a.money,
  });
  return { ...vazio, recado, metaEmAndamento, metaBatida };
}
