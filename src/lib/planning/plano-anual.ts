/**
 * As regras do "Salvar" do plano do ano (/orcamento), num lugar só e sem banco.
 *
 * Existe porque cada lado do salvar seguia uma regra: as categorias só eram gravadas do mês
 * corrente em diante, mas renda e aporte reescreviam os 12 meses, inclusive os já vividos e os
 * de um ano que já tinha acabado. E como o formulário sempre mandava todas as categorias, um
 * ajuste "só deste mês" feito no Fechamento virava o valor do resto do ano no próximo salvar.
 *
 * Puro: `hoje` é o relógio de Brasília (nowInBrazil), passado de fora.
 */

/**
 * Meses que um "salvar tudo" pode tocar: do mês corrente em diante, no ano corrente; o ano
 * inteiro em ano futuro; nenhum em ano já fechado. Reescrever mês já vivido mudava a história:
 * quem planejou R$ 800 em janeiro, cumpriu, e em setembro ajustou pra R$ 1.200 passava a ver
 * "economizou R$ 400" em todos os meses anteriores.
 */
export function mesesQueOSalvarGrava(ano: number, hoje: Date): number[] {
  const todos = Array.from({ length: 12 }, (_, i) => i + 1);
  if (ano > hoje.getFullYear()) return todos;
  if (ano < hoje.getFullYear()) return [];
  return todos.filter((m) => m >= hoje.getMonth() + 1);
}

/** Ano que já acabou: o plano dele é história, e o "Salvar" não grava nada nele. */
export function anoFechado(ano: number, hoje: Date): boolean {
  return ano < hoje.getFullYear();
}

/**
 * O mês que responde "o que eu tenho planejado?" na tela do plano: o mês corrente no ano
 * corrente (é dele em diante que o salvar grava), janeiro nos outros anos.
 */
export function mesDeReferenciaDoPlano(ano: number, hoje: Date): number {
  return ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 1;
}

/**
 * O valor enviado mudou em relação ao que a tela carregou? Só o que ela mexeu é gravado: o
 * resto fica como está em cada mês, inclusive um ajuste pontual feito só num mês.
 *
 * Sem o valor carregado (formulário de uma versão antiga do app, ainda aberto numa aba), grava
 * como antes: melhor regravar igual do que perder o que ela mudou.
 */
export function mudouDoCarregado(enviado: unknown, carregado: unknown): boolean {
  if (carregado === null || carregado === undefined || carregado === "") return true;
  const a = Number(enviado);
  const b = Number(carregado);
  // Valor inválido segue pra validação, que recusa com a mensagem certa.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) >= 0.005;
}
