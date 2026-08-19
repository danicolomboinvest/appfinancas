/**
 * Regra de IR na fonte por tipo de provento, pessoa física. Só aplicamos desconto onde a regra
 * é bem estabelecida e sem exceção prática — JSCP é sempre 15%, ponto final. Onde a regra
 * depende de condições do fundo/enquadramento ("Rend. Trib.") NÃO chutamos percentual: é
 * melhor mostrar o valor bruto com um aviso do que inventar um número errado.
 */

export type TaxTreatment = "isento" | "jscp_15" | "desconhecido";

/** Classifica o tipo de provento (texto cru do investidor10) quanto à tributação. */
export function classifyDividendTax(kind: string): TaxTreatment {
  const normalized = kind.trim().toLowerCase();
  if (normalized === "jscp" || normalized.includes("juros sobre capital")) return "jscp_15";
  // Dividendos (ações) e Rendimentos de FII são isentos de IR pra pessoa física.
  if (normalized === "dividendos" || normalized.includes("rendimento") && !normalized.includes("trib")) return "isento";
  // "Rend. Trib." (rendimento tributável) e qualquer rótulo não mapeado: não sabemos a
  // alíquota certa sem mais contexto do fundo/operação — não adivinhamos.
  return "desconhecido";
}

/** Valor líquido estimado por cota, já com os 15% de JSCP descontados quando a regra é certa.
 * Fora isso (isento ou desconhecido), o valor líquido é igual ao bruto. */
export function netValuePerShare(kind: string, grossValuePerShare: number): number {
  return classifyDividendTax(kind) === "jscp_15" ? grossValuePerShare * 0.85 : grossValuePerShare;
}
