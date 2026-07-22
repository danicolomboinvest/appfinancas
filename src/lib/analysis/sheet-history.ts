export type SheetHistoryEntry = { id: string; analysisDate: Date; totalScore: number | null };

export type ScoreTrend = {
  latestScore: number | null;
  previousScore: number | null;
  /** latestScore - previousScore, null quando não há duas análises com nota para comparar. */
  deltaAbsolute: number | null;
};

/**
 * Compara a nota da análise mais recente com a anterior do mesmo ticker.
 * `sheetsAscending` deve vir ordenado da mais antiga para a mais recente (mesma ordem de listSheetsByTicker).
 */
export function computeScoreTrend(sheetsAscending: SheetHistoryEntry[]): ScoreTrend {
  const withScore = sheetsAscending.filter((s) => s.totalScore !== null);
  if (withScore.length === 0) {
    return { latestScore: null, previousScore: null, deltaAbsolute: null };
  }
  if (withScore.length === 1) {
    return { latestScore: withScore[0].totalScore, previousScore: null, deltaAbsolute: null };
  }
  const latest = withScore[withScore.length - 1];
  const previous = withScore[withScore.length - 2];
  return {
    latestScore: latest.totalScore,
    previousScore: previous.totalScore,
    deltaAbsolute: (latest.totalScore as number) - (previous.totalScore as number),
  };
}

export type GroupedLatestSheet<T> = { latest: T; previousCount: number };

/**
 * Agrupa uma lista de fichas (ordenada por analysisDate desc, como listSheets devolve) por ticker,
 * mantendo só a mais recente de cada ticker + quantas análises anteriores existem, usado na lista
 * /fichas/acoes para não mostrar reanálises do mesmo ticker como linhas soltas e repetidas.
 */
export function groupLatestSheetPerTicker<T extends { ticker: string }>(
  sheetsDescending: T[],
): GroupedLatestSheet<T>[] {
  const byTicker = new Map<string, GroupedLatestSheet<T>>();
  for (const sheet of sheetsDescending) {
    const existing = byTicker.get(sheet.ticker);
    if (existing) {
      existing.previousCount += 1;
    } else {
      byTicker.set(sheet.ticker, { latest: sheet, previousCount: 0 });
    }
  }
  return Array.from(byTicker.values());
}
