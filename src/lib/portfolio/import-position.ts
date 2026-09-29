/**
 * Como a posição que veio do extrato da corretora entra nos ativos que já existem.
 *
 * Duas armadilhas que moravam na reimportação:
 *
 * 1. Extrato sem coluna de valor (só Código e Quantidade), ou linha em que o valor não foi lido:
 *    o parser devolve valor 0. Gravar esse 0 fazia um ativo de R$ 40.000 passar a valer R$ 0,00
 *    e sumir do patrimônio, da estratégia e das metas. Sem valor no arquivo, o valor é estimado
 *    pela quantidade nova × o preço de hoje (a cotação salva, ou valor ÷ quantidade de antes);
 *    sem como estimar, o valor salvo fica como está.
 *
 * 2. O mesmo papel em duas linhas (PETR4 com 50 na meta da Casa e 50 na liberdade financeira).
 *    A corretora manda a posição INTEIRA (100). Comparar com uma linha só mostrava "50 → 100",
 *    e gravar os 100 numa linha deixava a outra com 50: 150 PETR4 na carteira. Aqui a revisão
 *    compara com a SOMA das linhas, e a posição nova é repartida entre elas na proporção de
 *    antes — cada objetivo continua com a sua fatia.
 */

export type ExistingPositionRow = {
  id: string;
  quantity: number | null;
  currentValue: number;
  currentUnitPrice: number | null;
};

export type ImportedPosition = {
  quantity: number;
  /** 0 (ou menos) = o extrato não trouxe o valor. */
  value: number;
  investedValue: number | null;
};

export type PositionRowUpdate = {
  id: string;
  quantity?: number;
  currentValue?: number;
  investedValue?: number;
};

const round = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Peso de cada linha na posição: pela quantidade quando todas têm, senão pelo valor, senão
 * partes iguais. Soma 1.
 */
function weightsOf(rows: ExistingPositionRow[]): number[] {
  if (rows.length === 1) return [1];
  const qtds = rows.map((r) => r.quantity ?? 0);
  const totalQtd = qtds.reduce((s, q) => s + q, 0);
  if (qtds.every((q) => q > 0) && totalQtd > 0) return qtds.map((q) => q / totalQtd);
  const totalValor = rows.reduce((s, r) => s + Math.max(0, r.currentValue), 0);
  if (totalValor > 0) return rows.map((r) => Math.max(0, r.currentValue) / totalValor);
  return rows.map(() => 1 / rows.length);
}

/** Reparte `total` pelos pesos, com a sobra do arredondamento na última linha (a soma bate). */
function split(total: number, weights: number[], casas: number): number[] {
  const partes = weights.map((w) => round(total * w, casas));
  const soma = partes.slice(0, -1).reduce((s, p) => s + p, 0);
  partes[partes.length - 1] = round(total - soma, casas);
  return partes;
}

/** Preço de uma unidade hoje: a cotação salva, ou valor ÷ quantidade. */
function unitPrice(row: ExistingPositionRow): number | null {
  if (row.currentUnitPrice !== null && row.currentUnitPrice > 0) return row.currentUnitPrice;
  if (row.quantity !== null && row.quantity > 0 && row.currentValue > 0) return row.currentValue / row.quantity;
  return null;
}

/** O que gravar em cada linha. Campo ausente = não mexe. */
export function planPositionUpdate(rows: ExistingPositionRow[], pos: ImportedPosition): PositionRowUpdate[] {
  if (rows.length === 0) return [];
  const weights = weightsOf(rows);
  // Quantidade tem 6 casas (Decimal 18,6); dinheiro, 2.
  const quantidades = pos.quantity > 0 ? split(pos.quantity, weights, 6) : null;
  const valores = pos.value > 0 ? split(pos.value, weights, 2) : null;
  const investidos = pos.investedValue !== null ? split(pos.investedValue, weights, 2) : null;

  return rows.map((row, i) => {
    const update: PositionRowUpdate = { id: row.id };
    if (quantidades) update.quantity = quantidades[i];
    if (valores) {
      update.currentValue = valores[i];
    } else if (quantidades) {
      // Sem valor no extrato: quantidade nova × preço de hoje. Sem preço, o valor fica.
      const preco = unitPrice(row);
      if (preco !== null) update.currentValue = round(quantidades[i] * preco, 2);
    }
    if (investidos) update.investedValue = investidos[i];
    return update;
  });
}

/** A posição de hoje somando as linhas do mesmo papel — o "antes" da revisão. */
export function summarizeRows(rows: ExistingPositionRow[]): { quantity: number | null; value: number } {
  const comQtd = rows.filter((r) => r.quantity !== null);
  return {
    quantity: comQtd.length > 0 ? round(comQtd.reduce((s, r) => s + (r.quantity ?? 0), 0), 6) : null,
    value: round(rows.reduce((s, r) => s + r.currentValue, 0), 2),
  };
}

/**
 * O valor que a posição vai ter depois de aplicar o extrato — o "depois" da revisão. Quando o
 * extrato não trouxe valor, é a estimativa (ou o valor de hoje, que não muda); nunca R$ 0.
 */
export function valueAfterImport(rows: ExistingPositionRow[], pos: ImportedPosition): number {
  if (pos.value > 0) return pos.value;
  const plano = planPositionUpdate(rows, pos);
  return round(
    rows.reduce((s, row, i) => s + (plano[i]?.currentValue ?? row.currentValue), 0),
    2,
  );
}
