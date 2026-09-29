/**
 * Ferramentas dos crons que percorrem uma lista longa (tickers, pessoas) dentro do teto de tempo
 * da Vercel.
 *
 * O problema que resolvem: o loop era um item por vez, sem prazo. Quando a lista passava do que
 * cabia no teto, a plataforma matava a função no meio — e como a ordem do banco é estável, eram
 * sempre os MESMOS itens do fim da fila que nunca rodavam (o mesmo FII sem provento novo, a
 * mesma pessoa sem o resumo do mês). Aqui o trabalho para sozinho antes do teto, diz quantos
 * ficaram pra trás, e o rodízio faz a próxima rodada começar por outro ponto.
 */

/**
 * Roda `fn` em cada item, `paralelo` de cada vez, e para de PEGAR itens novos quando o relógio
 * passa do `prazo` (timestamp em ms). O que já começou termina; o que não começou fica em
 * `pendentes`. Erro de um item não derruba os outros (conta em `falhas`).
 */
export async function processarComPrazo<T>(
  itens: T[],
  opcoes: { paralelo: number; prazo: number; agora?: () => number },
  fn: (item: T) => Promise<void>,
): Promise<{ processados: number; falhas: number; pendentes: number }> {
  const agora = opcoes.agora ?? Date.now;
  let proximo = 0;
  let processados = 0;
  let falhas = 0;

  async function trabalhador() {
    while (proximo < itens.length && agora() < opcoes.prazo) {
      const item = itens[proximo];
      proximo += 1;
      try {
        await fn(item);
        processados += 1;
      } catch {
        falhas += 1;
      }
    }
  }

  const n = Math.max(1, Math.min(opcoes.paralelo, itens.length));
  await Promise.all(Array.from({ length: n }, trabalhador));
  return { processados, falhas, pendentes: itens.length - proximo };
}

/**
 * A lista começando do item `inicio` e dando a volta (rodízio). Com um início diferente a cada
 * rodada, quem ficou pro fim ontem pode ser o primeiro hoje — ninguém fica de fora pra sempre.
 */
export function girarLista<T>(itens: T[], inicio: number): T[] {
  if (itens.length === 0) return [];
  const i = ((Math.floor(inicio) % itens.length) + itens.length) % itens.length;
  return [...itens.slice(i), ...itens.slice(0, i)];
}
