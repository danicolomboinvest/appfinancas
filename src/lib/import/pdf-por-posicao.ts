/**
 * Texto do PDF remontado pela POSIÇÃO de cada pedaço na página, não pela ordem em que o arquivo
 * guarda os pedaços.
 *
 * Por quê: o extrato do Itaú baixado pelo app ("extrato conta / lançamentos") guarda a página por
 * COLUNA: primeiro todas as datas, depois todas as descrições, depois todos os valores. A leitura
 * normal sai nessa ordem, e nenhuma linha tem data, descrição e valor juntos: 61 linhas com valor
 * e zero lançamentos, 8 tentativas da mesma pessoa em 13/10/2026. Aqui cada data vira o começo de
 * uma linha, e cada pedaço da mesma altura (o valor fica alguns pontos acima da data) vai pra
 * linha da data mais próxima.
 */

export type PedacoDoPdf = { str: string; x: number; y: number };

/** Começa com uma data. Às vezes a data vem grudada na descrição num pedaço só
 * ("09/10/2026PAY MERCADO"): também é começo de linha. */
const DATA_RE = /^\d{2}\/\d{2}\/\d{4}/;
/** Distância máxima (em pontos do PDF) entre um pedaço e a data da linha dele. A linha do Itaú tem 18 pontos de
 * altura e o valor fica de 1 a 11 pontos acima ou abaixo da data, conforme a descrição quebra ou não. */
const ALCANCE = 14;

/** Uma página: pedaços → linhas de texto, separadas por tabulação entre colunas. */
export function linhasPorPosicao(pedacos: PedacoDoPdf[]): string[] {
  const uteis = pedacos.filter((p) => p.str.trim() !== "");
  if (uteis.length === 0) return [];
  // A coluna da data é a mais à esquerda onde aparecem datas.
  const datas = uteis.filter((p) => DATA_RE.test(p.str.trim()));
  const xDaData = datas.length > 0 ? Math.min(...datas.map((d) => d.x)) : null;
  const ancoras = xDaData === null ? [] : datas.filter((d) => Math.abs(d.x - xDaData) < 4);

  type Grupo = { y: number; pedacos: PedacoDoPdf[] };
  const grupos: Grupo[] = ancoras.map((a) => ({ y: a.y, pedacos: [] }));
  const soltos: PedacoDoPdf[] = [];
  for (const p of uteis) {
    let melhor: Grupo | null = null;
    for (const g of grupos) {
      const d = Math.abs(g.y - p.y);
      if (d <= ALCANCE && (!melhor || d < Math.abs(melhor.y - p.y))) melhor = g;
    }
    if (melhor) melhor.pedacos.push(p);
    else soltos.push(p);
  }
  // Pedaços soltos (cabeçalho, rodapé) viram linhas pela altura, como na leitura normal.
  const linhasSoltas: Grupo[] = [];
  for (const p of soltos) {
    const g = linhasSoltas.find((x) => Math.abs(x.y - p.y) < 2);
    if (g) g.pedacos.push(p);
    else linhasSoltas.push({ y: p.y, pedacos: [p] });
  }
  grupos.push(...linhasSoltas);
  grupos.sort((a, b) => b.y - a.y);
  return grupos.map((g) =>
    [...g.pedacos]
      .sort((a, b) => a.x - b.x || b.y - a.y)
      .map((p) => p.str.trim().replace(/^(\d{2}\/\d{2}\/\d{4})(?=\S)/, "$1\t"))
      .join("\t"),
  );
}

/**
 * O texto normal saiu por coluna? Só para o extrato do Itaú (cabeçalho "extrato conta" e as
 * colunas "valor (R$)" e "saldo (R$)"), e só quando há várias datas sozinhas na linha e quase
 * nenhuma linha com data e valor juntos. Outros bancos que também têm data sozinha na linha (a
 * descrição e o valor vêm embaixo, de propósito) não passam por aqui.
 */
export function precisaRemontarPorPosicao(texto: string): boolean {
  if (!/extrato conta/i.test(texto) || !/valor\s*\(R\$\)/i.test(texto) || !/saldo\s*\(R\$\)/i.test(texto)) return false;
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const soData = linhas.filter((l) => /^\d{2}\/\d{2}\/\d{4}$/.test(l)).length;
  const completas = linhas.filter((l) => /^\d{2}\/\d{2}\/\d{4}\s.*-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(l)).length;
  return soData >= 5 && completas < soData / 4;
}
