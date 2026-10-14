/**
 * O tamanho da letra dos valores nos dois cartões Brasil e Exterior do herói da Carteira. Cada
 * cartão tem metade da largura: a 320 px cabem uns 86 px de texto. Com 19 px fixos, qualquer
 * carteira a partir de R$ 100.000 ("R$ 666.051") ou US$ 10.000 com centavos passava da borda do
 * cartão (14/10/2026). Quanto mais comprido o texto, menor a letra, e menor ainda abaixo de 360 px.
 */
export function classeDoValor(texto: string): string {
  const n = texto.length;
  if (n <= 9) return "text-[19px]";
  if (n <= 11) return "text-[19px] max-[359px]:text-[15px]";
  if (n <= 13) return "text-[16px] max-[359px]:text-[13px]";
  return "text-[14px] max-[359px]:text-[12px]";
}

/** Dólares do cartão Exterior: sem centavos a partir de US$ 10.000, como os reais do cartão Brasil. */
export function dolaresDoCartao(v: number): string {
  const grande = Math.abs(v) >= 10000;
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: grande ? 0 : 2, maximumFractionDigits: grande ? 0 : 2 })}`;
}
