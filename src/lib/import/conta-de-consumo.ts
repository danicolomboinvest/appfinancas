/**
 * Conta de consumo (luz, telefone, água, internet) mandada no lugar de um extrato ou fatura.
 *
 * Ela não é uma lista de lançamentos: é UM boleto, que já aparece no extrato (débito, Pix) ou na
 * fatura do cartão (quando é paga no cartão) no dia em que sai o dinheiro. Antes o app tentava ler
 * a conta como fatura e inventava linhas: a de telefone virava "(DE A ...) CELULAR" e um
 * crédito de R$ 10 tirado de "a 14/07/2026"; a da luz contava o mesmo valor duas vezes. E a da
 * conta paga no cartão ainda duplicava com a linha da fatura. O caminho certo é recusar com uma
 * frase que diz o que fazer.
 */

const SINAIS_DE_CONTA: RegExp[] = [
  /conta de energia el[ée]trica/i,
  /\bkwh\b[\s\S]*\bconsumo\b|\bconsumo\b[\s\S]*\bkwh\b/i,
  /conta de [áa]gua|\besgoto\b[\s\S]*\bm³/i,
  /\btelef[oô]nica brasil\b|\bclaro s\.?a\.?\b|\btim s\.?a\.?\b|\boi s\.?a\.?\b/i,
  /plano contratado/i,
];

/** Coisas que só extrato e fatura de cartão têm: se aparecem, não é conta de consumo. */
const SINAIS_DE_BANCO: RegExp[] = [
  /lan[çc]amentos do cart[ãa]o/i,
  /limite (?:total|dispon[ií]vel|de cr[ée]dito)/i,
  /saldo (?:anterior|dispon[ií]vel|do dia|di[áa]rio)/i,
  /extrato (?:de conta|banc[áa]rio|da conta)/i,
  /total de compras/i,
];

export function pareceContaDeConsumo(texto: string): boolean {
  const amostra = texto.slice(0, 20000);
  if (SINAIS_DE_BANCO.some((re) => re.test(amostra))) return false;
  const conta = SINAIS_DE_CONTA.filter((re) => re.test(amostra)).length;
  // Um sinal forte basta quando vem com o jeito de boleto (vencimento e total a pagar).
  const boleto = /vencimento/i.test(amostra) && /(total a pagar|valor a pagar|valor do documento)/i.test(amostra);
  return conta >= 1 && boleto;
}

export const MSG_CONTA_DE_CONSUMO =
  "Esse arquivo é uma conta (de luz, telefone ou água), não um extrato nem uma fatura. Ela já aparece no seu extrato ou na fatura do cartão no dia em que você paga, então não precisa subir. Para eu te lembrar do vencimento, cadastre em Recorrentes › Contas.";
