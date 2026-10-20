/**
 * Números grandes que cabem na tela (20/10/2026, primeira cliente na Argentina): em pesos os
 * valores têm dois ou três dígitos a mais que em reais ("ARS 1.680.000", "ARS 2.500.000,00"), e as
 * letras de tamanho fixo passavam da borda a 320 px. Quanto mais comprido o texto, menor a letra,
 * e menor ainda abaixo de 360 px. Valores em reais do dia a dia ficam como estavam.
 */

/** O valor do teclado do Digitar ("R$ 45,90", "ARS 2.500.000,00"): a linha toda da folha. */
export function classeDoVisor(texto: string): string {
  const n = texto.length;
  if (n <= 12) return "text-[2.5rem]";
  if (n <= 15) return "text-[2.5rem] max-[359px]:text-[2.125rem]";
  if (n <= 18) return "text-[2.125rem] max-[359px]:text-[1.75rem]";
  return "text-[1.75rem] max-[359px]:text-[1.5rem]";
}

/** O saldo nos cartões lado a lado de Dívidas ("ARS 504.000"): metade da largura da tela. */
export function classeDoSaldoNoCartao(texto: string): string {
  const n = texto.replace(/^[^\d•]*/, "").length;
  if (n <= 7) return "text-[clamp(1.375rem,6.5cqw,1.625rem)]";
  if (n <= 9) return "text-[clamp(1.375rem,6.5cqw,1.625rem)] max-[359px]:text-[1.0625rem]";
  if (n <= 11) return "text-[1.25rem] max-[359px]:text-[0.9375rem]";
  return "text-[1.0625rem] max-[359px]:text-[0.8125rem]";
}
