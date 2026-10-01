/**
 * Resgate: dinheiro voltando do que a pessoa guardou (30/09/2026).
 *
 * Não é um tipo novo no banco: é um lançamento de guardado (INVESTMENT_CONTRIBUTION) com valor
 * NEGATIVO, como o estorno é um gasto negativo. Assim todas as somas do mês já fazem a conta
 * certa sem mudar nada: o "guardado" do mês vira o que entrou menos o que saiu, a renda não
 * infla com dinheiro que já era dela, e o saldo continua batendo com o extrato.
 *
 * Antes não havia onde registrar: na importação o resgate só podia ser "tirado" (sumia) ou
 * contado como renda, e a carteira seguia mostrando o dinheiro como investido. Agora a carteira
 * pergunta de qual investimento saiu (ver getWithdrawalLinkState em lib/portfolio/contribution-link).
 */
export function ehResgate(entry: { category: string; amount: number }): boolean {
  return entry.category === "INVESTMENT_CONTRIBUTION" && entry.amount < 0;
}
