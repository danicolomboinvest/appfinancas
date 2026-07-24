/**
 * Overview educativo do ETF: mesmo espírito de stock-overview.ts, adaptado aos indicadores que
 * o investidor10 disponibiliza pra ETF (rentabilidade, DY, patrimônio) em vez dos indicadores
 * de ação individual.
 */
import { type OverviewSignal, type OverviewItem, OVERVIEW_DISCLAIMER, parseIndicatorNumber } from "./stock-overview";

export type { OverviewSignal, OverviewItem };
export { OVERVIEW_DISCLAIMER };

/** "R$ 14,58 M" / "R$ 7,60 Bilhões" / "R$ 900 mil" → valor cheio em reais. null se não der. */
function parseMagnitudeBRL(raw: string): number | null {
  const m = raw.match(/([\d.,]+)\s*(mil|m|milh[oõ]es|bi|bilh[oõ]es)?/i);
  if (!m) return null;
  const base = parseIndicatorNumber(m[1]);
  if (base === null) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("mil")) return base * 1_000;
  if (unit === "m" || unit.startsWith("milh")) return base * 1_000_000;
  if (unit.startsWith("bi")) return base * 1_000_000_000;
  return base;
}

type Rule = { label: string; evaluate: (n: number) => { signal: OverviewSignal; reference: string } };

const RULES: Record<string, Rule> = {
  dividend_yield_etf: {
    label: "Dividend Yield",
    // DY baixo não é defeito de ETF de crescimento, nunca marca "atenção" (mesma régua de ações).
    evaluate: (n) => ({
      signal: n >= 5 ? "favoravel" : "neutro",
      reference: "acima de ~5% é um DY alto; confirme se é consistente nos últimos anos",
    }),
  },
  rentabilidade_12m: {
    label: "Rentabilidade 12 Meses",
    evaluate: (n) => ({
      signal: n > 0 ? "favoravel" : "atencao",
      reference: "só indica se rendeu ou perdeu no período — compare sempre com o índice de referência, não é um veredito isolado",
    }),
  },
  rentabilidade_5anos: {
    label: "Rentabilidade 5 Anos",
    evaluate: (n) => ({
      signal: n > 0 ? "favoravel" : "atencao",
      reference: "só indica se rendeu ou perdeu no período — compare sempre com o índice de referência, não é um veredito isolado",
    }),
  },
};

const PATRIMONIO_LABEL = "Patrimônio Líquido";
function evaluatePatrimonio(raw: string): { signal: OverviewSignal; reference: string } | null {
  const n = parseMagnitudeBRL(raw);
  if (n === null) return null;
  return {
    signal: n >= 500_000_000 ? "favoravel" : n < 50_000_000 ? "atencao" : "neutro",
    reference: "fundos maiores (acima de R$ 500 milhões) tendem a ter mais liquidez e menor risco de fechamento; abaixo de R$ 50 milhões, ponto de atenção",
  };
}

const ORDER = ["patrimonio_liquido_etf", "dividend_yield_etf", "rentabilidade_12m", "rentabilidade_5anos"];

/** Monta o overview do ETF a partir do mapa { key → valor } raspado (mesmo formato do de ações). */
export function buildEtfOverview(indicators: Record<string, string>): {
  items: OverviewItem[];
  counts: Record<OverviewSignal, number>;
} {
  const items: OverviewItem[] = [];
  for (const key of ORDER) {
    const raw = indicators[key];
    if (!raw) continue;
    if (key === "patrimonio_liquido_etf") {
      const evaluated = evaluatePatrimonio(raw);
      if (evaluated) items.push({ key, label: PATRIMONIO_LABEL, value: raw, ...evaluated });
      continue;
    }
    const rule = RULES[key];
    if (!rule) continue;
    const n = parseIndicatorNumber(raw);
    if (n === null) continue;
    const { signal, reference } = rule.evaluate(n);
    items.push({ key, label: rule.label, value: raw, signal, reference });
  }
  const counts: Record<OverviewSignal, number> = { favoravel: 0, neutro: 0, atencao: 0 };
  for (const it of items) counts[it.signal] += 1;
  return { items, counts };
}
