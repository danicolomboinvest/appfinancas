/**
 * Os números do formulário de ativo cotado (ação, FII, ETF): quantidade digitada e valor
 * investido que vai pro servidor. Fica puro e separado porque cliente e servidor precisam
 * ler a quantidade do MESMO jeito.
 */

/**
 * Quantidade digitada do jeito brasileiro.
 *
 * `Number("1.000".replace(",", "."))` dá 1: quem tinha mil cotas de MXRF11 e digitava "1.000"
 * salvava 1 cota, sem erro nenhum — a posição ficava mil vezes menor. Aqui:
 * - vírgula é sempre o decimal ("2,5" = 2,5; "1.000,5" = 1000,5);
 * - ponto seguido de grupos de 3 dígitos é milhar ("1.000" = 1000; "12.500" = 12500);
 * - qualquer outro ponto é decimal ("0.005" de cripto, "133.333333" que o próprio app mostra).
 * Devolve NaN quando não dá pra ler.
 */
export function parseQuantityInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return NaN;
  let normalized: string;
  if (t.includes(",")) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, "");
  } else {
    normalized = t;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\.\d+$/.test(normalized)) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Quantidade salva → texto do campo na edição. Com vírgula decimal: "2.125" (duas cotas e um
 * oitavo) viraria 2125 ao salvar de novo, porque ponto + 3 dígitos é lido como milhar.
 */
export function formatQuantityInput(quantity: number | undefined): string {
  if (!quantity) return "";
  return String(quantity).replace(".", ",");
}

/**
 * Preço médio mostrado no campo: investido ÷ quantidade, em centavos.
 */
export function averagePriceOf(quantity: number | undefined, investedValue: number | undefined): number {
  return quantity && investedValue ? Math.round((investedValue / quantity) * 100) / 100 : 0;
}

/**
 * Valor investido que o formulário manda.
 *
 * O preço médio do campo é arredondado em centavos: 97.654,32 ÷ 10.000 cotas = 9,765432 → 9,77,
 * e 10.000 × 9,77 = 97.700,00. Recalcular o investido sempre fazia só abrir "Editar" pra trocar o
 * objetivo mudar o investido em R$ 45,68 (e o lucro junto). Se ela não mexeu na quantidade nem
 * no preço médio, vale o investido que já estava salvo.
 */
export function investedToSend(input: {
  quantity: number;
  avgPrice: number;
  /** Na edição: o que estava salvo. Ao criar, undefined. */
  original?: { quantity: number | undefined; investedValue: number | undefined };
}): number | undefined {
  const { quantity, avgPrice, original } = input;
  if (original && original.investedValue !== undefined && original.quantity !== undefined) {
    const mesmoPreco = avgPrice === averagePriceOf(original.quantity, original.investedValue);
    if (quantity === original.quantity && mesmoPreco) return original.investedValue;
  }
  return Number.isFinite(quantity) && quantity > 0 && avgPrice > 0 ? Math.round(quantity * avgPrice * 100) / 100 : undefined;
}
