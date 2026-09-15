import { STRATEGY_ASSET_CLASS_LABEL, STRATEGY_ASSET_CLASS_COLOR, type StrategyClassPosition } from "./strategy";

export type StrategyBulletRow = {
  key: string;
  label: string;
  color: string;
  fillPercent: number;
  targetPercent: number | null;
  rightLabel: string;
};

/**
 * "Onde a carteira está × onde deveria estar", uma linha por classe de ativo — o que antes
 * eram duas roscas lado a lado.
 *
 * Duas roscas obrigam a medir ângulo de cabeça: a pessoa olha 46% num círculo, guarda, olha
 * 40% no outro e tenta sentir a diferença. Com o alvo virando um tracinho na mesma barra, quem
 * está atrás do traço é literalmente o que falta comprar no próximo aporte.
 *
 * As duas escalas têm que caber na MESMA régua, senão a comparação mente. A régua vai de zero
 * até o maior valor entre todos os atuais e todos os alvos, com 25% de folga — a barra mais
 * cheia não encosta na borda e ainda sobra espaço pra passar do alvo sem estourar o desenho.
 *
 * Nenhuma linha fica vermelha: estar acima do alvo não é erro, é desequilíbrio. O tracinho já
 * mostra a distância, e quem decide se ela importa é a pessoa.
 */
export function buildStrategyBullets(positions: StrategyClassPosition[]): StrategyBulletRow[] {
  const rows = positions.filter((p) => p.targetPercent > 0 || p.currentPercent > 0);
  if (rows.length === 0) return [];

  const maxPercent = Math.max(...rows.map((p) => Math.max(p.currentPercent, p.targetPercent)));
  const axisMax = Math.max(maxPercent, 0.01) * 1.25;
  const pct = (value: number) => Math.round(value * 100);

  return [...rows]
    .sort((a, b) => b.currentPercent - a.currentPercent)
    .map((p) => ({
      key: p.assetClass,
      label: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
      color: STRATEGY_ASSET_CLASS_COLOR[p.assetClass],
      fillPercent: (p.currentPercent / axisMax) * 100,
      targetPercent: p.targetPercent > 0 ? (p.targetPercent / axisMax) * 100 : null,
      rightLabel:
        p.targetPercent > 0
          ? `${pct(p.currentPercent)}% · alvo ${pct(p.targetPercent)}%`
          : `${pct(p.currentPercent)}% · sem alvo`,
    }));
}
