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
 * Pro SQL (`typical-expense.ts`), que só sabe "contém": NÃO decide nada, só traz os CANDIDATOS,
 * e quem decide é `ehNaoGasto`, em memória. Por isso é largo de propósito (pedaços de palavra,
 * sem acento): tem de pegar TUDO que `ehNaoGasto` reconhece, senão a linha fica no gasto.
 *
 * Antes era a própria regra, com frases inteiras ("pagamento de fatura", "pagto cartão"), e
 * deixava passar o que `parecePagamentoDeFatura` reconhece: "Pagamento cartão de crédito",
 * "Fatura Nubank", "Pagamento de boleto NU PAGAMENTOS". A fatura contava junto com as compras
 * dela e o custo de vida subia (16/10/2026: 31 de 286 perfis, mediana de 12% a mais). E o
 * contrário: "Pagamento de fatura CLARO" saía do gasto, e é a conta do celular.
 *
 * Mexeu em `parecePagamentoDeFatura` ou nas aplicações? O teste em `nao-e-gasto.test.ts` confere
 * que todo "não é gasto" passa por esta lista.
 */
export const TERMOS_NAO_E_GASTO = [
  // aplicação (e "aplicação"), caixinha, RDB, CDB, Tesouro Direto
  "aplica", "caixinha", "rdb", "cdb", "tesouro",
  // fatura; "cartão/cartao" (Pagto cartão crédito); "tarjeta"/"resumen" (Argentina)
  "fatura", "cart", "tarj", "resumen",
  // boleto pago à empresa do cartão ("NU PAGAMENTOS", "NU.PAGAMENTOS"), ver EMPRESA_DO_CARTAO
  "pagamentos", "nubank", "itaucard", "bradescard", "credicard", "hipercard", "midway", "ourocard",
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
