/**
 * O "a mais por mês" do plano de dívidas. Começa em zero: o app não sabe de dinheiro
 * sobrando que a pessoa nunca disse, então a primeira data vale só para as parcelas de hoje.
 */
export const EXTRA_INICIAL = 0

/** Atalhos de valor. Nenhum vem escolhido. */
export const ATALHOS_DO_EXTRA = [100, 200, 500]

/** A linha curta que diz com o que a data foi calculada. */
export function textoDoCalculo(extra: number, m0: (v: number) => string): string {
  return extra > 0 ? `com ${m0(extra)} a mais por mês` : 'só com as parcelas de hoje'
}
