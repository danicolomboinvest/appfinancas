/**
 * A resposta ao aviso "Saúde passou R$ 153" (pedido da Dani, 14/10/2026: "quando eu respondo, eu
 * quero que você tire aquilo"). Qualquer resposta da folha "O que fazer?" (foi pontual, cobrir com
 * outra categoria, subir o plano, não gastar mais nada) tira o aviso daquela categoria no mês.
 *
 * Ele só volta se a categoria passar de novo bem mais do que passava na hora da resposta: 50% a
 * mais e pelo menos R$ 50 a mais. Resposta antiga, sem o valor da hora, segura o aviso o mês todo
 * (como antes).
 */

/** Quanto a mais do que passava na hora da resposta faz o aviso voltar. */
export const VOLTA_COM = 1.5;
/** E nunca por menos que isso de diferença: R$ 10 que viram R$ 15 não é novidade. */
export const VOLTA_COM_PELO_MENOS = 50;

/** O id do aviso de uma categoria que passou, o mesmo do Foco e do Decidir. */
export const idDoEstouro = (categoria: string) => `estouro-${categoria}`;

/**
 * A resposta ainda segura o aviso? `passouNaResposta` é quanto passava quando ela respondeu (null:
 * resposta antiga ou "não gastar mais nada", que vale o mês inteiro); `passouAgora` é quanto passa
 * agora, contra o plano de agora.
 */
export function respostaSeguraOAviso(passouNaResposta: number | null | undefined, passouAgora: number): boolean {
  if (passouNaResposta === null || passouNaResposta === undefined || !(passouNaResposta > 0)) return true;
  const limite = Math.max(passouNaResposta * VOLTA_COM, passouNaResposta + VOLTA_COM_PELO_MENOS);
  return passouAgora < limite;
}

export type AvisoDispensado = { id: string; passou: number | null };

/**
 * As respostas aos avisos de categoria que passou, por categoria: o que ela dispensou na folha
 * (com o quanto passava) e o "não gastar mais nada" (teto zero, vale o mês todo).
 */
export function respostasDeEstouro(dispensados: AvisoDispensado[], tetos: { categoria: string; valor: number }[] = []): Map<string, number | null> {
  const r = new Map<string, number | null>();
  for (const d of dispensados) {
    if (!d.id.startsWith("estouro-")) continue;
    const categoria = d.id.slice("estouro-".length);
    // Duas respostas no mês (uma de antes, sem valor): vale a que segura mais, a sem valor.
    const antes = r.get(categoria);
    r.set(categoria, antes === null || d.passou === null ? null : Math.max(antes ?? 0, d.passou));
  }
  for (const t of tetos) if (t.valor <= 0) r.set(t.categoria, null);
  return r;
}

/** A categoria passou, mas ela já respondeu e a resposta ainda vale: o aviso não aparece. */
export function avisoRespondido(respostas: Map<string, number | null>, categoria: string, passouAgora: number): boolean {
  return respostas.has(categoria) && respostaSeguraOAviso(respostas.get(categoria), passouAgora);
}
