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

/** Palavras que não dizem de ONDE veio a compra: não servem pra achar a compra de um estorno. */
const PALAVRAS_SEM_LOJA = new Set([
  "estorno", "estornado", "estornada", "reembolso", "devolucao", "chargeback", "cancelamento", "cancelada", "cancelado",
  "credito", "compra", "pagamento", "pagto", "loja", "pix", "ted", "debito", "cartao", "transferencia", "recebido",
  "recebida", "enviado", "enviada", "parcela", "ltda", "eireli", "mercado", "pago", "online", "brasil", "comercio",
]);

/** As palavras da descrição que podem ser o nome da loja (4 letras ou mais, sem acento). */
function palavrasDaLoja(descricao: string | null): Set<string> {
  const texto = (descricao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ");
  return new Set(texto.split(/\s+/).filter((p) => p.length >= 4 && !PALAVRAS_SEM_LOJA.has(p)));
}

export type CompraAnterior = { description: string | null; amount: number; parentCategory: string | null; customCategoryId: string | null };

/**
 * A compra que um estorno devolve: a mais recente com o nome da mesma loja, de preferência com o
 * mesmo valor (estorno parcial acontece, então valor diferente ainda serve, mas perde pra igual).
 * É dela que vem a categoria do estorno: sem isso, "ESTORNO LOJA X" ia pra Outros, a compra
 * seguia contando inteira em Lazer e Outros ficava negativo. `compras` vem da mais recente pra
 * mais antiga.
 */
export function acharCompraDoEstorno<T extends CompraAnterior>(estorno: { description: string | null; amount: number }, compras: T[]): T | null {
  const loja = palavrasDaLoja(estorno.description);
  if (loja.size === 0) return null;
  const valor = Math.abs(estorno.amount);
  const mesmaLoja = compras.filter((c) => c.amount > 0 && [...palavrasDaLoja(c.description)].some((p) => loja.has(p)));
  return mesmaLoja.find((c) => Math.abs(c.amount - valor) < 0.01) ?? mesmaLoja[0] ?? null;
}

