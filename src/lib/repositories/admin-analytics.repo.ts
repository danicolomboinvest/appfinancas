import { prisma } from "@/lib/db/prisma";
import { getAdminOverview } from "@/lib/repositories/admin-metrics.repo";
import { PROFILE_KIND_LABEL } from "@/lib/repositories/profile.repo";
import { PROFILE_THEMES } from "@/lib/profiles/themes";

/**
 * Relatório da plataforma para o admin: engajamento (quanto usam), adoção por funcionalidade
 * (o que usam e o que ninguém usa) e resultado financeiro agregado da base. Visão global —
 * só chamar de páginas protegidas por requireAdmin(). Como o app não tem tracking de eventos,
 * a "adoção" é inferida pelos DADOS que a pessoa cria em cada área (proxy honesto de uso), e o
 * engajamento vem do lastSeenAt (atualizado no layout a cada visita).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SIMULATOR_LABEL: Record<string, string> = {
  FINANCIAR_VS_ALUGAR: "Financiar vs. alugar",
  AMORTIZAR_VS_INVESTIR: "Amortizar vs. investir",
  CONSORCIO_VS_FINANCIAMENTO: "Consórcio vs. financiamento",
  MARCACAO_MERCADO: "Marcação a mercado",
  CARRO: "Vale a pena (carro)",
};

const SHEET_LABEL: Record<string, string> = { STOCK: "Ações", FII: "FIIs", STOCK_INTL: "Stocks", ETF: "ETFs" };

export type FeatureAdoption = { key: string; label: string; users: number; percent: number };

/**
 * Ranking de "o que a galera usa": % de usuários com ao menos um registro em cada área, do
 * mais adotado pro menos. Existe separado de `getPlatformReport` porque o painel de Usuários
 * (/admin/usuarios) também mostra esse ranking, e ali não vale pagar as outras ~20 queries do
 * relatório completo (funil, telas visitadas, financeiro) só pra exibir uma lista.
 */
export async function getFeatureAdoption(): Promise<{ totalUsers: number; features: FeatureAdoption[] }> {
  const [
    totalUsers,
    fluxo,
    orcamento,
    metas,
    carteira,
    estrategia,
    reserva,
    planejamento,
    simuladores,
    fichas,
    categorias,
    patrimonio,
  ] = await Promise.all([
    prisma.user.count(),
    countUsers(prisma.monthlyEntry.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.budget.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.goal.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.asset.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.portfolioStrategy.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.emergencyFund.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.planningParams.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.simulation.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.analysisSheet.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.customCategory.findMany({ distinct: ["userId"], select: { userId: true } })),
    countUsers(prisma.patrimonySnapshot.findMany({ distinct: ["userId"], select: { userId: true } })),
  ]);

  const pct = (n: number) => (totalUsers > 0 ? Math.round((n / totalUsers) * 1000) / 10 : 0);
  const features: FeatureAdoption[] = [
    { key: "fluxo", label: "Fluxo (lançamentos)", users: fluxo },
    { key: "orcamento", label: "Orçamento", users: orcamento },
    { key: "metas", label: "Metas", users: metas },
    { key: "carteira", label: "Carteira de investimentos", users: carteira },
    { key: "estrategia", label: "Estratégia da carteira", users: estrategia },
    { key: "reserva", label: "Reserva de emergência", users: reserva },
    { key: "planejamento", label: "Planejamento", users: planejamento },
    { key: "simuladores", label: "Simuladores", users: simuladores },
    { key: "fichas", label: "Fichas de análise", users: fichas },
    { key: "categorias", label: "Categorias personalizadas", users: categorias },
    { key: "patrimonio", label: "Evolução de patrimônio", users: patrimonio },
  ]
    .map((f) => ({ ...f, percent: pct(f.users) }))
    .sort((a, b) => b.users - a.users);

  return { totalUsers, features };
}

export type ProfileAdoptionRow = { key: string; label: string; perfis: number; percent: number };

/**
 * Quais TEMAS de personalidade (Girly, Game, Disciplina…) e quais TIPOS de perfil
 * (Pessoal, Empresa, Casal…) estão em uso, pela contagem de `FinancialProfile`.
 *
 * A unidade é o PERFIL, não o usuário: cada pessoa tem 1+ perfis, e cada perfil carrega um
 * tema e um tipo próprios (ver prisma/schema.prisma, FinancialProfile.theme/.kind). Conta
 * TODO perfil, inclusive os "Pessoal"/"padrao" que o backfill de perfis criou sozinho pra
 * quem já usava o app antes de set/2026 — é dado real: mostra que a maioria ainda está no
 * Padrão porque nunca escolheu outro, não porque o app esconde a opção.
 */
export async function getProfileAdoption(): Promise<{ totalPerfis: number; temas: ProfileAdoptionRow[]; tipos: ProfileAdoptionRow[] }> {
  const [porTema, porTipo] = await Promise.all([
    prisma.financialProfile.groupBy({ by: ["theme"], _count: { _all: true } }),
    prisma.financialProfile.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);

  const totalPerfis = porTema.reduce((s, r) => s + r._count._all, 0);
  const pctPerfis = (n: number) => (totalPerfis > 0 ? Math.round((n / totalPerfis) * 1000) / 10 : 0);

  // `theme` é coluna livre (String) no banco, não o enum ProfileThemeKey — um valor gravado por
  // uma versão antiga do app, ou por engano, não pode quebrar esta consulta; cai no próprio
  // valor bruto como rótulo (Map<string,string> em vez de Map<ProfileThemeKey,string>).
  const labelDoTema = new Map<string, string>(PROFILE_THEMES.map((t) => [t.key, t.label]));
  const temas = porTema
    .map((r) => ({ key: r.theme, label: labelDoTema.get(r.theme) ?? r.theme, perfis: r._count._all, percent: pctPerfis(r._count._all) }))
    .sort((a, b) => b.perfis - a.perfis);

  const tipos = porTipo
    .map((r) => ({ key: r.kind, label: PROFILE_KIND_LABEL[r.kind] ?? r.kind, perfis: r._count._all, percent: pctPerfis(r._count._all) }))
    .sort((a, b) => b.perfis - a.perfis);

  return { totalPerfis, temas, tipos };
}

export type PlatformReport = {
  engagement: {
    totalUsers: number;
    active24h: number;
    active7d: number;
    active30d: number;
    newUsers7d: number;
    newUsers30d: number;
    nuncaVoltou: number;
    signupsByWeek: { weekLabel: string; count: number }[];
  };
  featureAdoption: FeatureAdoption[];
  simulators: { label: string; count: number }[];
  sheets: { label: string; count: number }[];
  financial: {
    poupando: number;
    noVermelho: number;
    semDados: number;
    poupancaMediana: number;
    taxaPoupancaMedia: number | null;
    patrimonioTotal: number;
  };
};

/** Nº de usuários DISTINTOS com ao menos um registro (proxy de "usa a funcionalidade"): recebe
 * um findMany distinct por userId e devolve a contagem. */
const countUsers = (rows: Promise<{ userId: string }[]>): Promise<number> => rows.then((r) => r.length);

export async function getPlatformReport(): Promise<PlatformReport> {
  const now = Date.now();
  const since = (days: number) => new Date(now - days * DAY_MS);

  const [
    totalUsers,
    active24h,
    active7d,
    active30d,
    newUsers7d,
    newUsers30d,
    nuncaVoltou,
    signupUsers,
    adoption,
    simByType,
    sheetByType,
    overview,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: since(1) } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: since(7) } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: since(30) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
    // Cadastrou mas nunca abriu depois: lastSeenAt nulo (o layout só grava quando a pessoa entra).
    prisma.user.count({ where: { lastSeenAt: null } }),
    prisma.user.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    getFeatureAdoption(),
    prisma.simulation.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.analysisSheet.groupBy({ by: ["sheetType"], _count: { _all: true } }),
    getAdminOverview("patrimonio"),
  ]);

  const featureAdoption = adoption.features;

  const simulators = simByType
    .map((s) => ({ label: SIMULATOR_LABEL[s.type] ?? s.type, count: s._count._all }))
    .sort((a, b) => b.count - a.count);
  const sheets = sheetByType
    .map((s) => ({ label: SHEET_LABEL[s.sheetType] ?? s.sheetType, count: s._count._all }))
    .sort((a, b) => b.count - a.count);

  // Resultado financeiro a partir da mesma base do /admin/usuarios.
  const comDados = overview.users.filter((u) => u.mesesAtivos > 0);
  const poupancas = comDados.map((u) => u.poupancaMediaMensal).sort((a, b) => a - b);
  const median =
    poupancas.length === 0
      ? 0
      : poupancas.length % 2 === 1
        ? poupancas[(poupancas.length - 1) / 2]
        : (poupancas[poupancas.length / 2 - 1] + poupancas[poupancas.length / 2]) / 2;
  const taxas = comDados.map((u) => u.taxaPoupanca).filter((t): t is number => t != null);
  const taxaMedia = taxas.length > 0 ? taxas.reduce((s, t) => s + t, 0) / taxas.length : null;

  // Cadastros por semana (últimas 8), rótulo dd/mm do início da semana (segunda-feira).
  const signupsByWeek = bucketByWeek(signupUsers.map((u) => u.createdAt), 8);

  return {
    engagement: {
      totalUsers,
      active24h,
      active7d,
      active30d,
      newUsers7d,
      newUsers30d,
      nuncaVoltou,
      signupsByWeek,
    },
    featureAdoption,
    simulators,
    sheets,
    financial: {
      poupando: comDados.filter((u) => u.poupancaMediaMensal > 0).length,
      noVermelho: comDados.filter((u) => u.poupancaMediaMensal < 0).length,
      semDados: overview.users.length - comDados.length,
      poupancaMediana: median,
      taxaPoupancaMedia: taxaMedia,
      patrimonioTotal: overview.totals.patrimonioTotal,
    },
  };
}

/** Agrupa datas de cadastro nas últimas `weeks` semanas (segunda a domingo). */
function bucketByWeek(dates: Date[], weeks: number): { weekLabel: string; count: number }[] {
  const now = new Date();
  // Início da semana atual (segunda-feira 00:00, horário local do servidor).
  const day = now.getDay(); // 0=domingo
  const diffToMonday = (day + 6) % 7;
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

  const buckets: { start: number; end: number; weekLabel: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(startOfThisWeek.getTime() - i * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    buckets.push({
      start: start.getTime(),
      end: end.getTime(),
      weekLabel: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }
  for (const d of dates) {
    const t = d.getTime();
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) b.count += 1;
  }
  return buckets.map(({ weekLabel, count }) => ({ weekLabel, count }));
}
