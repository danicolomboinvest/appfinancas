/**
 * Overview educativo da ação: pega os indicadores raspados e devolve um "selo" por indicador
 * (Favorável / Na média / Atenção) comparado a uma REFERÊNCIA GERAL e transparente.
 *
 * IMPORTANTE: é material educativo, NÃO recomendação. Os limites são regras de bolso de mercado
 * que variam MUITO por setor e momento da empresa — por isso cada selo mostra o porquê, e há um
 * aviso fixo. Nunca produz um veredito de compra/venda nem uma nota final da empresa.
 */

export type OverviewSignal = "favoravel" | "neutro" | "atencao";

export type OverviewItem = {
  key: string;
  label: string;
  /** Valor exibido, do jeito que veio da fonte (ex.: "4,86", "26%"). */
  value: string;
  signal: OverviewSignal;
  /** Explicação transparente do porquê do selo (a régua usada). */
  reference: string;
};

export const OVERVIEW_DISCLAIMER =
  "Referências gerais e educativas — os limites variam muito conforme o setor e o momento da empresa. " +
  "Isto não é recomendação de compra ou venda; use como ponto de partida da sua própria análise.";

/** Número em formato BR ("4,86", "26%", "R$ 40,59", "-0,54") → número. null se não der. */
export function parseIndicatorNumber(raw: string): number | null {
  const t = raw.replace(/[R$%\s]/gi, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === "–") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Rule = { label: string; evaluate: (n: number) => { signal: OverviewSignal; reference: string } };

/** Faixa de 3 níveis: favorável se cruzar `good`, atenção se cruzar `bad`, senão neutro.
 * `dir: "low"` = quanto MENOR melhor; `dir: "high"` = quanto MAIOR melhor. */
function band(dir: "high" | "low", good: number, bad: number, unit: string): Rule["evaluate"] {
  return (n) => {
    const favorable = dir === "high" ? n >= good : n <= good;
    const attention = dir === "high" ? n < bad : n > bad;
    const ref =
      dir === "high"
        ? `acima de ${good}${unit} costuma ser favorável; abaixo de ${bad}${unit}, ponto de atenção`
        : `abaixo de ${good}${unit} costuma ser confortável; acima de ${bad}${unit}, ponto de atenção`;
    return { signal: favorable ? "favoravel" : attention ? "atencao" : "neutro", reference: ref };
  };
}

/** Réguas por indicador — todas de conhecimento geral de mercado, exibidas junto do selo. */
const RULES: Record<string, Rule> = {
  p_l: {
    label: "P/L (Preço/Lucro)",
    evaluate: (n) =>
      n < 0
        ? { signal: "atencao", reference: "P/L negativo = a empresa teve prejuízo no período" }
        : band("low", 15, 25, "")(n),
  },
  p_vp: { label: "P/VP (Preço/Valor Patrimonial)", evaluate: band("low", 1, 2.5, "") },
  ev_ebitda: { label: "EV/EBITDA", evaluate: band("low", 6, 12, "") },
  dividend_yield: {
    label: "Dividend Yield",
    // DY baixo NÃO é defeito (ações de crescimento pagam pouco) — nunca marcamos "atenção".
    evaluate: (n) => ({
      signal: n >= 5 ? "favoravel" : "neutro",
      reference: "acima de ~5% é um DY alto (bom pra renda; confirme se é sustentável)",
    }),
  },
  roe: { label: "ROE (Retorno sobre Patrimônio)", evaluate: band("high", 15, 10, "%") },
  roic: { label: "ROIC (Retorno sobre Capital)", evaluate: band("high", 10, 6, "%") },
  margem_liquida: { label: "Margem Líquida", evaluate: band("high", 10, 3, "%") },
  margem_ebit: { label: "Margem EBIT", evaluate: band("high", 15, 5, "%") },
  divida_liquida_ebitda: {
    label: "Dívida Líquida / EBITDA",
    evaluate: (n) =>
      n < 0
        ? { signal: "favoravel", reference: "negativo = a empresa tem mais caixa do que dívida" }
        : band("low", 2, 3.5, "x")(n),
  },
  divida_liquida_patrimonio: {
    label: "Dívida Líquida / Patrimônio",
    evaluate: (n) =>
      n < 0
        ? { signal: "favoravel", reference: "negativo = mais caixa do que dívida" }
        : band("low", 0.5, 1, "")(n),
  },
  liquidez_corrente: {
    label: "Liquidez Corrente",
    evaluate: (n) =>
      n < 1
        ? { signal: "atencao", reference: "abaixo de 1 = o caixa de curto prazo não cobre as dívidas de curto prazo" }
        : band("high", 1.5, 1, "")(n),
  },
  evolucao_receita: {
    label: "Crescimento de Receita (5 anos)",
    evaluate: (n) => ({
      signal: n > 0 ? "favoravel" : "atencao",
      reference: "receita crescendo no período é favorável; caindo, ponto de atenção",
    }),
  },
  evolucao_lucro: {
    label: "Crescimento de Lucro (5 anos)",
    evaluate: (n) => ({
      signal: n > 0 ? "favoravel" : "atencao",
      reference: "lucro crescendo no período é favorável; caindo, ponto de atenção",
    }),
  },
};

/** Ordem de exibição (valuation → rentabilidade → endividamento → crescimento). */
const ORDER = [
  "p_l",
  "p_vp",
  "ev_ebitda",
  "dividend_yield",
  "roe",
  "roic",
  "margem_liquida",
  "margem_ebit",
  "divida_liquida_ebitda",
  "divida_liquida_patrimonio",
  "liquidez_corrente",
  "evolucao_receita",
  "evolucao_lucro",
];

/**
 * Monta o overview a partir do mapa { key → valor } raspado. Só inclui indicadores que temos
 * régua e valor numérico válido. Devolve também a contagem por selo (pra um resuminho).
 */
export function buildStockOverview(indicators: Record<string, string>): {
  items: OverviewItem[];
  counts: Record<OverviewSignal, number>;
} {
  const items: OverviewItem[] = [];
  for (const key of ORDER) {
    const raw = indicators[key];
    const rule = RULES[key];
    if (!raw || !rule) continue;
    const n = parseIndicatorNumber(raw);
    if (n === null) continue;
    const { signal, reference } = rule.evaluate(n);
    items.push({ key, label: rule.label, value: raw, signal, reference });
  }
  const counts: Record<OverviewSignal, number> = { favoravel: 0, neutro: 0, atencao: 0 };
  for (const it of items) counts[it.signal] += 1;
  return { items, counts };
}
