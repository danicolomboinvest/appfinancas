import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "@/lib/import/dinheiro-proprio";
import { pareceEstorno } from "@/lib/import/estorno";

/**
 * Revisão dos lançamentos que já estão no app de antes da importação saber separar o dinheiro
 * dela mesma. Os mesmos sinais da importação, aplicados ao que já foi gravado: a pessoa decide
 * um por um, e o app nunca muda nada sozinho.
 *
 * Puro, sem banco.
 */

export type TipoRevisao = "aplicacao" | "fatura" | "conta_propria_saida" | "conta_propria_entrada" | "resgate" | "estorno";

export type LancamentoAntigo = {
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  description: string | null;
  amount: number;
};

/** Palavras pra pré-filtrar no banco (o filtro fino é o de baixo). */
export const TERMOS_REVISAO = ["aplica", "caixinha", "rdb", "cdb", "tesouro", "poupan", "fatura", "resgate", "estorno", "reembolso", "devolu", "chargeback", "cancelad", "titularidade", "entre contas", "conta propria", "conta própria"];

/**
 * O que esse lançamento antigo parece ser, ou null se não precisa de revisão. `importaFatura`:
 * pagamento de fatura só é "contado duas vezes" pra quem também importa a fatura.
 */
export function classificarAntigo(e: LancamentoAntigo, nomeDaPessoa: string | null, importaFatura: boolean): TipoRevisao | null {
  if (e.amount <= 0) return null;
  if (e.category === "EXPENSE") {
    if (pareceAplicacao(e.description)) return "aplicacao";
    if (parecePagamentoDeFatura(e.description)) return importaFatura ? "fatura" : null;
    if (pareceContaPropria(e.description, nomeDaPessoa)) return "conta_propria_saida";
    return null;
  }
  if (e.category === "INCOME") {
    if (pareceEstorno(e.description)) return "estorno";
    if (pareceResgate(e.description)) return "resgate";
    if (pareceContaPropria(e.description, nomeDaPessoa)) return "conta_propria_entrada";
  }
  return null;
}
