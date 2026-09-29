/**
 * Saída de dinheiro que NÃO é gasto: aplicação (RDB, CDB, caixinha, Tesouro) e pagamento da
 * fatura do cartão (as compras da fatura já estão lançadas uma a uma). O extrato traz tudo
 * isso como débito, e contar como gasto dizia que a renda estava 130% comprometida.
 *
 * Fica num arquivo sem banco porque a mesma regra vale no SQL (`typical-expense.ts`) e em
 * contas feitas em memória (o caixa da Empresa): duas listas acabariam discordando.
 */
export const SUBCATEGORIA_NAO_E_GASTO = "Investimento";

export const TERMOS_NAO_E_GASTO = [
  "aplicação", "aplicacao", "caixinha", "rdb", "cdb", "tesouro direto",
  "pagamento de fatura", "pagamento fatura", "pgto fatura", "pag fatura", "fatura do cartão", "fatura do cartao",
];

/** A mesma regra do filtro SQL, pra quem já tem os lançamentos na mão. */
export function ehNaoGasto(e: { subcategory?: string | null; description?: string | null }): boolean {
  if (e.subcategory === SUBCATEGORIA_NAO_E_GASTO) return true;
  const d = e.description?.toLowerCase();
  return !!d && TERMOS_NAO_E_GASTO.some((t) => d.includes(t));
}
