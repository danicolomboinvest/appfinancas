/**
 * Ao salvar uma renda fixa ou um Tesouro: o valor de hoje é um número que ELA informou (do app do
 * banco) ou é a conta do app? (15/10/2026, rendimento-renda-fixa.ts.)
 *
 * Quando ela informou, o rendimento parte desse valor e dessa data (Asset.valorInformado e
 * valorInformadoEm) e só soma o que rendeu depois: o app nunca troca por uma estimativa um número
 * que ela digitou. Quando é a conta do app, parte da compra (investido, data e taxa).
 *
 * Devolve undefined quando não muda nada (editou outra coisa e o valor ficou igual).
 */
export function valorInformadoAoSalvar(input: {
  /** Renda fixa ou Tesouro, em reais. */
  rendaFixa: boolean;
  criando: boolean;
  /** O Novo ativo mandou a estimativa do app (ela não tocou em "Digitar o valor exato"). */
  estimadoPeloApp: boolean;
  /** O valor de hoje que está sendo salvo. */
  valor: number;
  /** Na edição, o valor que o campo trouxe preenchido; null ao criar ou se não veio. */
  original: number | null;
  investido: number | null;
  /** Depois de salvar, o ativo tem a data da compra. */
  temData: boolean;
  /** Na edição, mudou a data, a taxa, o indexador ou o investido. */
  mudouABase: boolean;
  agora: Date;
}): { valorInformado: number | null; valorInformadoEm: Date | null } | undefined {
  if (!input.rendaFixa) return undefined;
  const informou = { valorInformado: input.valor, valorInformadoEm: input.agora };
  const daCompra = { valorInformado: null, valorInformadoEm: null };
  if (input.criando) {
    // Sem a data da compra, o app só tem de onde partir se for o valor de hoje.
    if (!input.temData) return informou;
    if (input.estimadoPeloApp) return daCompra;
    const igualAoInvestido = input.investido !== null && Math.abs(input.valor - input.investido) < 0.005;
    return igualAoInvestido ? daCompra : informou;
  }
  if (input.original !== null && Math.abs(input.valor - input.original) >= 0.005) return informou;
  if (input.mudouABase && input.temData) return daCompra;
  return undefined;
}
