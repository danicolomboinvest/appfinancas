/**
 * A pergunta da queda de 15% no "Montar minha estratégia". Com a carteira vazia (quem monta a
 * estratégia antes de cadastrar o primeiro investimento), a tela dizia "R$ 0, era R$ 0": sem
 * número nenhum para imaginar a queda. Aí vale um exemplo de R$ 10.000, dito como exemplo.
 */
export const EXEMPLO_DA_QUEDA = 10000;

export function quedaDe15(totalDaCarteira: number): { antes: number; depois: number; exemplo: boolean } {
  const exemplo = !(totalDaCarteira > 0);
  const antes = exemplo ? EXEMPLO_DA_QUEDA : totalDaCarteira;
  return { antes, depois: antes * 0.85, exemplo };
}
