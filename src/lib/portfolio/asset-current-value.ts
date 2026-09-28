/**
 * Qual "valor atual" gravar ao salvar o formulário de um ativo cotado (ação, FII, ETF).
 *
 * Na edição, o campo "Valor atual (opcional)" já vem preenchido com o que está salvo. Se o
 * servidor respeitasse qualquer número que chegasse ali, a dica "deixe em branco: o app busca a
 * cotação" nunca valeria ao editar: ela muda a quantidade de 10 pra 20 PETR4, o investido dobra
 * (quantidade × preço médio) e o valor atual fica o de antes — a carteira mostra um prejuízo de
 * 50% que não existe até alguém tocar em "Atualizar cotações".
 *
 * Então o número digitado só manda quando ela de fato mexeu nele. Campo intocado conta como
 * "em branco": vale quantidade × cotação de hoje. Sem cotação (fonte fora do ar), o valor salvo
 * acompanha a mudança de quantidade na proporção — é o mesmo preço unitário de antes, bem
 * melhor que manter o total antigo pra uma posição que dobrou.
 */
export function resolveQuotedCurrentValue(input: {
  /** O que chegou no campo "valor atual" ("" quando vazio). */
  typedCurrent: string;
  /** O valor que o campo trouxe pré-preenchido na edição ("" ao criar). */
  originalCurrent: string;
  /** Quantidade salva antes da edição ("" ao criar). */
  originalQuantity: string;
  /** Quantidade que chegou agora. */
  quantity: number | undefined;
  /** Cotação de hoje, quando a busca funcionou. */
  price: number | null | undefined;
}): string | number {
  const { typedCurrent, originalCurrent, originalQuantity, quantity, price } = input;
  const intocado = typedCurrent !== "" && originalCurrent !== "" && Number(typedCurrent) === Number(originalCurrent);
  const temQuantidade = quantity !== undefined && quantity > 0;

  if (temQuantidade && price && price > 0 && (typedCurrent === "" || intocado)) {
    return Math.round(quantity * price * 100) / 100;
  }

  const qtdAntes = Number(originalQuantity);
  if (intocado && temQuantidade && Number.isFinite(qtdAntes) && qtdAntes > 0 && qtdAntes !== quantity) {
    return Math.round(((Number(originalCurrent) * quantity) / qtdAntes) * 100) / 100;
  }

  return typedCurrent;
}
