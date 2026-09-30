/**
 * Saída de dinheiro que NÃO é gasto: aplicação (RDB, CDB, caixinha, Tesouro) e pagamento da
 * fatura do cartão (as compras da fatura já estão lançadas uma a uma). O extrato traz tudo
 * isso como débito, e contar como gasto dizia que a renda estava 130% comprometida.
 *
 * Fica num arquivo sem banco porque a mesma regra vale no SQL (`typical-expense.ts`) e em
 * contas feitas em memória (o caixa da Empresa): duas listas acabariam discordando.
 */
import { descricaoSemFalsaAplicacao, parecePagamentoDeFatura } from "@/lib/import/dinheiro-proprio";

export const SUBCATEGORIA_NAO_E_GASTO = "Investimento";

/**
 * Pro SQL (`typical-expense.ts`), que só sabe "contém". É um filtro mais largo que `ehNaoGasto`
 * (sem palavra inteira, sem tirar a conta de consumo): o Prisma não tem expressão regular.
 */
export const TERMOS_NAO_E_GASTO = [
  "aplicação", "aplicacao", "caixinha", "rdb", "cdb", "tesouro direto",
  "pagamento de fatura", "pagamento fatura", "pgto fatura", "pagto fatura", "pag fatura", "fatura do cartão", "fatura do cartao",
  "pagto cartão", "pagto cartao",
];

/** Os mesmos termos de aplicação da lista, mas como PALAVRA inteira (ver `ehNaoGasto`). */
const APLICACAO_NAO_E_GASTO = /\b(aplicacao|caixinha|rdb|cdb|tesouro direto)\b/;

/**
 * A regra do filtro SQL, pra quem já tem os lançamentos na mão, só que mais justa que o "contém"
 * do SQL: palavra inteira ("NERDBURGER" não é RDB), sem os serviços e objetos que usam as mesmas
 * palavras ("aplicação de cílios", "caixinha de som", ver `descricaoSemFalsaAplicacao`), e o
 * pagamento de fatura pela regra única do import (`parecePagamentoDeFatura`), que sabe que
 * "Pagamento de fatura CLARO" é a conta do celular. Errar aqui pro lado de "não é gasto" deixava
 * o custo de vida menor do que é.
 */
export function ehNaoGasto(e: { subcategory?: string | null; description?: string | null }): boolean {
  if (e.subcategory === SUBCATEGORIA_NAO_E_GASTO) return true;
  if (!e.description) return false;
  return APLICACAO_NAO_E_GASTO.test(descricaoSemFalsaAplicacao(e.description)) || parecePagamentoDeFatura(e.description);
}
