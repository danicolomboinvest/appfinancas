/**
 * A renovação da assinatura (decisão da Dani, 11/10): sempre 1 ano depois da data da compra. Quem
 * já passou de um ano renovou; a próxima é o próximo aniversário da compra, a partir de hoje.
 * Puro. Sem data de compra, a tela não mostra a linha.
 */
export function renovacaoEm(compra: Date, hoje: Date): Date {
  const dia = compra.getUTCDate();
  const noAno = (ano: number) => {
    const ultimo = new Date(Date.UTC(ano, compra.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ano, compra.getUTCMonth(), Math.min(dia, ultimo)));
  };
  let ano = compra.getUTCFullYear() + 1;
  while (noAno(ano).getTime() <= hoje.getTime()) ano++;
  return noAno(ano);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "15 de março de 2027" */
export function dataLonga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
