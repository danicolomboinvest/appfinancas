import type { FixedIncomeIndex } from "@prisma/client";

/**
 * A taxa em que ela comprou o título de renda fixa (`Asset.taxaCompra`, 11/10/2026).
 *
 * Formato no banco: FRAÇÃO (a unidade de taxa do app inteiro), lida junto com o indexador do
 * ativo (`Asset.fixedIncomeIndex`):
 * - PREFIXADO: 0.12 = 12% ao ano;
 * - IPCA: 0.075 = IPCA + 7,5% ao ano (só o juro real, sem o IPCA);
 * - POS_FIXADO: 1.05 = 105% do CDI (a Selic do Tesouro Selic também entra como % do CDI/Selic).
 * Nulo = ela não disse. Na tela ela digita em %, como está no app do banco ("7,5" ou "105").
 */
export const TAXA_COMPRA_MAX = 10; // 1.000% do CDI ou 1.000% ao ano: acima disso é erro de digitação

/** "7,5" → 0.075; "105" → 1.05; vazio → null; inválido → undefined (não mexe). */
export function taxaDoFormulario(texto: string | null | undefined): number | null | undefined {
  if (texto === null || texto === undefined) return undefined;
  const t = String(texto).trim().replace("%", "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  if (!Number.isFinite(n) || n <= 0 || n / 100 > TAXA_COMPRA_MAX) return undefined;
  return Math.round((n / 100) * 1e6) / 1e6;
}

/** Para o campo do formulário: 0.075 → "7,5". */
export function taxaParaOCampo(taxa: number | null | undefined): string {
  if (taxa === null || taxa === undefined) return "";
  return (Math.round(taxa * 100 * 10000) / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

/** "IPCA + 7,5% ao ano", "105% do CDI", "12% ao ano". */
export function textoDaTaxaCompra(taxa: number, indexador: FixedIncomeIndex | null): string {
  const pct = (taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (indexador === "IPCA") return `IPCA + ${pct}% ao ano`;
  if (indexador === "PREFIXADO") return `${pct}% ao ano`;
  return `${pct}% do CDI`;
}
