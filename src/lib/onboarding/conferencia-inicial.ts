import { chaveDeIguais } from "@/lib/import/revisao-em-grupo";

/**
 * A conferência do primeiro extrato (leva 1 do primeiro uso, 14/10/2026): no começo, no máximo 3
 * perguntas antes de ver o mês. As outras entram "A conferir" e voltam pelo "Revisar N
 * lançamentos" do Resumo.
 *
 * Puro, sem React: a importação chama e usa o resultado.
 */
export const MAX_PERGUNTAS_DO_COMECO = 3;

export type LinhaDaConferencia = {
  key: number;
  description: string;
  amount: number;
  profileId: string | null;
  /** Pergunta de categoria (vale para a loja inteira). Falso nas dúvidas de uma linha só. */
  porLoja: boolean;
};

/**
 * Quanto do mês cada pergunta decide: a linha dela e, na pergunta de categoria, todas as outras
 * pendentes da mesma loja (a resposta vale para o grupo).
 */
export function valorDaPergunta(key: number, pendentes: LinhaDaConferencia[]): number {
  const alvo = pendentes.find((l) => l.key === key);
  if (!alvo) return 0;
  const chave = alvo.porLoja ? chaveDeIguais(alvo.description) : null;
  if (!chave) return Math.abs(alvo.amount);
  return pendentes
    .filter((l) => l.porLoja && (l.profileId ?? null) === (alvo.profileId ?? null) && (l.key === key || chaveDeIguais(l.description) === chave))
    .reduce((soma, l) => soma + Math.abs(l.amount), 0);
}

/**
 * As `max` perguntas de maior valor, na ordem em que a fila já estava (as dúvidas de uma linha
 * antes das categorias). Empate: fica a que veio primeiro.
 */
export function perguntasDeMaiorValor(fila: number[], pendentes: LinhaDaConferencia[], max = MAX_PERGUNTAS_DO_COMECO): number[] {
  if (fila.length <= max) return fila;
  const escolhidas = new Set(
    fila
      .map((key, i) => ({ key, i, valor: valorDaPergunta(key, pendentes) }))
      .sort((a, b) => b.valor - a.valor || a.i - b.i)
      .slice(0, Math.max(0, max))
      .map((x) => x.key),
  );
  return fila.filter((k) => escolhidas.has(k));
}

/** A nota das que ficam "A conferir" depois das perguntas do começo: "Os outros 1" era o que aparecia. */
export function notaDasQueFicam(n: number): string {
  return n === 1 ? "O outro fica para quando quiser." : `Os outros ${n} ficam para quando quiser.`;
}
