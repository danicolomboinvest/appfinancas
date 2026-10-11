/**
 * "Virar meta" do "Posso comprar?" (protótipo aprovado): juntar antes e comprar à vista, sem
 * dívida, guardando até 10% da renda por mês (a parte que a regra dos 90% já separa para o
 * futuro). Começa no mês que vem; o "por mês" arredonda para cima em dezenas.
 *
 * Ana, celular de R$ 3.000 com renda de R$ 7.700: 4 meses de R$ 750, compra em fev/2027.
 */
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function planoDoSonho(valor: number, renda: number, hoje: { ano: number; mes: number }) {
  if (!(valor > 0) || !(renda > 0)) return null;
  const meses = Math.min(120, Math.max(1, Math.ceil(valor / (renda * 0.1))));
  const porMes = Math.ceil(valor / meses / 10) * 10;
  const comeca = new Date(hoje.ano, hoje.mes, 1);
  const compra = new Date(hoje.ano, hoje.mes - 1 + meses, 1);
  return {
    meses,
    porMes,
    comeca: { ano: comeca.getFullYear(), mes: comeca.getMonth() + 1 },
    compraEm: { ano: compra.getFullYear(), mes: compra.getMonth() + 1 },
    compraEmCurto: `${MESES_CURTOS[compra.getMonth()]}/${compra.getFullYear()}`,
  };
}
