/**
 * Overview educativo do FII: mesmo espírito de stock-overview.ts (selo Favorável/Na média/
 * Atenção por indicador, com a régua explicada), adaptado aos indicadores que fazem sentido
 * pra fundo imobiliário (P/VP, vacância, liquidez, taxa de administração) em vez dos
 * indicadores de ação (P/L, ROE...).
 */
import { type OverviewSignal, type OverviewItem, OVERVIEW_DISCLAIMER, parseIndicatorNumber } from "./stock-overview";

export type { OverviewSignal, OverviewItem };
export { OVERVIEW_DISCLAIMER };

/** "R$ 14,58 M" / "R$ 6,34 B" / "R$ 7,60 Bilhões" / "R$ 900 mil" → valor cheio em reais. null se
 * não der. Ordem das alternativas importa: "bilh[oõ]es"/"milh[oõ]es" precisam vir ANTES de "mil"
 * na regex, senão "milhões" batia só o prefixo "mil" e virava 1000x menor do que o valor real. */
function parseMagnitudeBRL(raw: string): number | null {
  const m = raw.match(/([\d.,]+)\s*(bilh[oõ]es|milh[oõ]es|mil|bi|b|m)?/i);
  if (!m) return null;
  const base = parseIndicatorNumber(m[1]);
  if (base === null) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "bi" || unit === "b" || unit.startsWith("bilh")) return base * 1_000_000_000;
  if (unit === "m" || unit.startsWith("milh")) return base * 1_000_000;
  if (unit.startsWith("mil")) return base * 1_000;
  return base;
}

type Rule = { label: string; evaluate: (n: number) => { signal: OverviewSignal; reference: string } };

const RULES: Record<string, Rule> = {
  p_vp: {
    label: "P/VP (Preço/Valor Patrimonial)",
    evaluate: (n) => ({
      signal: n <= 0.95 ? "favoravel" : n > 1.15 ? "atencao" : "neutro",
      reference: "abaixo de 0,95 sugere desconto sobre o patrimônio; acima de 1,15, ágio alto — ponto de atenção",
    }),
  },
  vacancia_atual: {
    label: "Vacância Atual",
    evaluate: (n) => ({
      signal: n <= 5 ? "favoravel" : n > 15 ? "atencao" : "neutro",
      reference: "abaixo de 5% é vacância baixa (favorável); acima de 15%, ponto de atenção",
    }),
  },
  taxa_administracao: {
    label: "Taxa de Administração",
    evaluate: (n) => ({
      signal: n <= 1 ? "favoravel" : n > 1.5 ? "atencao" : "neutro",
      reference: "abaixo de 1% a.a. é uma taxa baixa; acima de 1,5% a.a., ponto de atenção",
    }),
  },
};

/** Liquidez usa magnitude (R$ mil/M/Bilhões), não o parser simples de %/decimal das outras regras. */
const LIQUIDEZ_LABEL = "Liquidez Diária";
function evaluateLiquidez(raw: string): { signal: OverviewSignal; reference: string } | null {
  const n = parseMagnitudeBRL(raw);
  if (n === null) return null;
  return {
    signal: n >= 1_000_000 ? "favoravel" : n < 100_000 ? "atencao" : "neutro",
    reference: "acima de R$ 1 milhão/dia costuma facilitar comprar e vender; abaixo de R$ 100 mil/dia, ponto de atenção",
  };
}

const ORDER = ["p_vp", "vacancia_atual", "liquidez_fii", "taxa_administracao"];

/** Monta o overview do FII a partir do mapa { key → valor } raspado (mesmo formato do de ações). */
export function buildFiiOverview(indicators: Record<string, string>): {
  items: OverviewItem[];
  counts: Record<OverviewSignal, number>;
} {
  const items: OverviewItem[] = [];
  for (const key of ORDER) {
    const raw = indicators[key];
    if (!raw) continue;
    if (key === "liquidez_fii") {
      const evaluated = evaluateLiquidez(raw);
      if (evaluated) items.push({ key, label: LIQUIDEZ_LABEL, value: raw, ...evaluated });
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
