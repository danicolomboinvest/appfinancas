/**
 * Saídas e entradas do extrato que NÃO são gasto nem renda: dinheiro dela indo pra ela mesma.
 *
 * O extrato só sabe "saiu" ou "entrou". Sem separar isso, a Visão mensal somava a aplicação na
 * caixinha e o pagamento da fatura como gasto: quem gastou R$ 7.000, pagou a fatura de R$ 4.000
 * pelo banco e guardou R$ 2.000 aparecia com "gastou R$ 13.000".
 *
 * - Aplicação (RDB, CDB, caixinha, Tesouro…): é guardar, vira aporte sozinha.
 * - Resgate: dinheiro voltando da aplicação. Não é renda; a tela pergunta.
 * - Transferência pra conta dela mesma (mesma titularidade, ou o próprio nome): a tela pergunta
 *   se foi gasto, se foi guardar, ou se só mudou de conta.
 * - Pagamento de fatura: fica de fora quando ela importa a fatura (as compras já estão lá, uma a
 *   uma); se ela não importa, continua sendo o gasto do cartão.
 */

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const APLICACAO = /\b(aplicacao|aplic|caixinha|rdb|cdb|lci|lca|tesouro|poupanca|investimento|guardar dinheiro|cofrinho)\b/;
const RESGATE = /\b(resgate|resg|retirada (da|de) caixinha|retirada do cofrinho|resgatad[oa])\b/;
const CONTA_PROPRIA = /\b(mesma titularidade|entre contas|conta propria|transferencia propria|contas proprias)\b/;
const PAGAMENTO_FATURA = /fatura/;

export function pareceAplicacao(descricao: string | null | undefined): boolean {
  const d = semAcento(descricao ?? "");
  return APLICACAO.test(d) && !RESGATE.test(d);
}

export function pareceResgate(descricao: string | null | undefined): boolean {
  return RESGATE.test(semAcento(descricao ?? ""));
}

export function parecePagamentoDeFatura(descricao: string | null | undefined): boolean {
  const d = semAcento(descricao ?? "");
  return PAGAMENTO_FATURA.test(d) && (/pagament|pgto|pag /.test(d) || /cartao/.test(d));
}

/**
 * Transferência pra ela mesma: a descrição diz ("mesma titularidade"), ou traz o NOME dela (o
 * primeiro e o último nome, pra "Pix enviado - Daniela Colombo" não bater com outra Daniela).
 */
export function pareceContaPropria(descricao: string | null | undefined, nomeDaPessoa: string | null | undefined): boolean {
  const d = semAcento(descricao ?? "");
  if (CONTA_PROPRIA.test(d)) return true;
  const partes = semAcento(nomeDaPessoa ?? "").split(/\s+/).filter((p) => p.length >= 3);
  if (partes.length < 2) return false;
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return /\b(pix|ted|doc|transf|transferencia)\b/.test(d) && new RegExp(`\\b${primeiro}\\b`).test(d) && new RegExp(`\\b${ultimo}\\b`).test(d);
}
