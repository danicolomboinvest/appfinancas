import { prisma } from "@/lib/db/prisma";

/**
 * Leitura do rastreio de uso pro /admin/relatorio. Só agregados — o relatório mostra "quais
 * telas" e "quantas pessoas", não a trilha de navegação de uma cliente específica.
 */

/** Nome amigável das rotas no relatório (fallback: a própria rota). */
const PATH_LABELS: Record<string, string> = {
  "/mensal": "Fluxo do mês",
  "/mensal/[ano]/[mes]": "Fluxo do mês",
  "/mensal/[ano]": "Fluxo anual",
  "/mensal/gastos": "Só gastos",
  "/dashboard": "Visão Geral",
  "/orcamento": "Orçamento",
  "/orcamento/[ano]": "Orçamento",
  "/planejamento/metas": "Metas",
  "/planejamento/metas/[id]": "Detalhe de meta",
  "/planejamento/reserva-emergencia": "Reserva de emergência",
  "/planejamento/acumulo": "Aposentadoria",
  "/viagem": "Planejar viagem",
  "/carteira": "Carteira",
  "/carteira/por-objetivo": "Carteira por objetivo",
  "/carteira/estrategia": "Estratégia da carteira",
  "/simuladores": "Simuladores (lista)",
  "/fichas": "Análises (insights)",
  "/resumo-mensal": "Resumo mensal",
  "/configuracoes/perfil": "Perfil",
};

function labelFor(path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  if (path.startsWith("/simuladores/")) return `Simulador: ${path.slice("/simuladores/".length).replace(/-/g, " ")}`;
  if (path.startsWith("/fichas/")) return `Fichas: ${path.slice("/fichas/".length).replace("/[id]", " (detalhe)")}`;
  return path;
}

export type PageUsage = { path: string; label: string; views: number; uniqueUsers: number };

export type UsageReport = {
  /** Telas mais visitadas nos últimos N dias. */
  topPages: PageUsage[];
  totalViews: number;
  uniqueVisitors: number;
  /** Quantas pessoas usaram pelo app INSTALADO (tela de início) no período. */
  standaloneUsers: number;
  /** Visitantes únicos por dia (mais antigo → mais recente), pro gráfico de barras. */
  visitorsByDay: { dayLabel: string; count: number }[];
  days: number;
};

export async function getUsageReport(days = 30): Promise<UsageReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await prisma.usageEvent.findMany({
    where: { createdAt: { gte: since }, name: "pageview" },
    select: { userId: true, path: true, standalone: true, createdAt: true },
  });

  const byPath = new Map<string, { views: number; users: Set<string> }>();
  const visitors = new Set<string>();
  const standalone = new Set<string>();
  const byDay = new Map<string, Set<string>>();

  for (const event of events) {
    visitors.add(event.userId);
    if (event.standalone) standalone.add(event.userId);
    const page = byPath.get(event.path) ?? { views: 0, users: new Set<string>() };
    page.views += 1;
    page.users.add(event.userId);
    byPath.set(event.path, page);
    const day = event.createdAt.toISOString().slice(0, 10);
    (byDay.get(day) ?? byDay.set(day, new Set()).get(day)!).add(event.userId);
  }

  // Agrega por RÓTULO, não por rota: "/mensal" e "/mensal/[ano]/[mes]" são a mesma experiência
  // ("Fluxo do mês") e apareceriam como duas linhas duplicadas.
  const byLabel = new Map<string, { path: string; views: number; users: Set<string> }>();
  for (const [path, page] of byPath) {
    const label = labelFor(path);
    const existing = byLabel.get(label) ?? { path, views: 0, users: new Set<string>() };
    existing.views += page.views;
    for (const user of page.users) existing.users.add(user);
    byLabel.set(label, existing);
  }
  const topPages: PageUsage[] = [...byLabel.entries()]
    .map(([label, page]) => ({ path: page.path, label, views: page.views, uniqueUsers: page.users.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  // Últimos 14 dias, dia a dia, incluindo os zerados (senão o gráfico "pula" dias sem visita).
  const visitorsByDay: { dayLabel: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    visitorsByDay.push({ dayLabel: `${key.slice(8, 10)}/${key.slice(5, 7)}`, count: byDay.get(key)?.size ?? 0 });
  }

  return {
    topPages,
    totalViews: events.length,
    uniqueVisitors: visitors.size,
    standaloneUsers: standalone.size,
    visitorsByDay,
    days,
  };
}
