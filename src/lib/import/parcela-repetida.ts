import { descricaoComparavel, installmentDescription, mesmaParcela, parseInstallment } from "@/lib/entries/recurrence";

/**
 * A mesma parcela duas vezes (15/10/2026, achado em produção). Duas causas, as duas na importação
 * da fatura (mensal/import-actions.ts):
 *
 * 1. Duas parcelas da mesma compra no mesmo arquivo (a k e a k+1) ou em duas faturas: cada linha
 *    projetava o próprio rabo. A chave da projeção leva o "N/T", então a k+1 de uma linha nunca
 *    achava a k+1 da outra e cada mês seguinte ficava com o par. Agora a compra (a loja sem o
 *    "N/T", o total, o valor e o mês da compra = mês da parcela - (k - 1)) projeta cada parcela
 *    uma vez só: ver `controleDeProjecao`.
 * 2. A parcela k de um mês que não bate com o da outra fatura: o modo antigo punha a fatura
 *    inteira no mês escolhido; o novo põe a parcela k no mês da compra + (k - 1). A busca da
 *    parcela já lançada só aceitava o mês vizinho quando a de lá era projetada; a parcela que veio
 *    de verdade em outra fatura, um mês fora, entrava de novo. Agora a vizinha de qualquer origem
 *    serve, depois do mês certo e da projetada: ver `acharParcelaExistente`.
 *
 * Puro, sem banco. Meses como índice (ano * 12 + mês - 1). Também é a régua da prévia
 * (scripts/tmp-previa-parcelas.ts): `previaDasParcelas` diz o que uma correção apagaria ou moveria.
 */

/** A loja sem o "N/T": todas as parcelas da mesma compra têm a mesma ("loja x parc 1/10"). */
export function lojaDaParcela(descricao: string, total: number): string {
  return descricaoComparavel(installmentDescription(descricao, 1, total));
}

// ---------------------------------------------------------------------------------------------
// 1. Projeção uma vez por compra

export type ParcelaDoArquivo = {
  /** O perfil para onde a linha vai (a mesma compra em perfis diferentes são duas). */
  perfil: string;
  descricao: string;
  atual: number;
  total: number;
  valor: number;
  /** O mês em que esta parcela conta, pela data da compra (índice). */
  mes: number;
};

type CompraDoArquivo = {
  valor: number;
  total: number;
  /** Quantas linhas do arquivo trazem cada parcela. */
  noArquivo: Map<number, number>;
  /** Quantas vezes cada parcela já foi projetada nesta importação. */
  projetadas: Map<number, number>;
  /** Quantas compras iguais são: a parcela que mais aparece no arquivo (duas TVs no mesmo dia = 2). */
  copias: number;
};

export type ControleDeProjecao = {
  /** Esta linha pode projetar a parcela `n` da compra? Se sim, já conta como projetada. */
  projetar(p: ParcelaDoArquivo, n: number): boolean;
};

/**
 * Quem projeta cada parcela das compras do arquivo. Duas linhas da mesma compra (a 3/10 e a 4/10)
 * projetam o rabo uma vez: a 4/10 não é projetada pela 3/10 porque o arquivo já traz ela, e da
 * 5/10 em diante só a primeira linha projeta. Duas compras iguais de verdade (mesma loja, valor e
 * parcela no mesmo arquivo) continuam duas: cada parcela vale tantas vezes quanto a parcela que
 * mais aparece no arquivo.
 */
export function controleDeProjecao(noArquivo: ParcelaDoArquivo[]): ControleDeProjecao {
  const compras = new Map<string, CompraDoArquivo[]>();
  const achar = (p: ParcelaDoArquivo): CompraDoArquivo => {
    const chave = `${p.perfil}|${lojaDaParcela(p.descricao, p.total)}|${p.total}|${p.mes - (p.atual - 1)}`;
    const lista = compras.get(chave) ?? [];
    let c = lista.find((x) => mesmaParcela(x.valor, p.valor, p.total));
    if (!c) {
      c = { valor: p.valor, total: p.total, noArquivo: new Map(), projetadas: new Map(), copias: 0 };
      lista.push(c);
      compras.set(chave, lista);
    }
    return c;
  };
  for (const p of noArquivo) {
    const c = achar(p);
    const n = (c.noArquivo.get(p.atual) ?? 0) + 1;
    c.noArquivo.set(p.atual, n);
    c.copias = Math.max(c.copias, n);
  }
  return {
    projetar(p, n) {
      const c = achar(p);
      const ja = (c.noArquivo.get(n) ?? 0) + (c.projetadas.get(n) ?? 0);
      if (ja >= Math.max(1, c.copias)) return false;
      c.projetadas.set(n, (c.projetadas.get(n) ?? 0) + 1);
      return true;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// 2. A parcela já lançada, com um mês de folga

/**
 * Onde procurar a parcela já lançada, em ordem: o mês certo (qualquer origem); o vizinho com a
 * parcela PROJETADA por outra fatura (o mês escolhido um mês fora); o vizinho com a parcela que
 * veio de verdade em outra fatura (o modo antigo, fatura inteira no mês escolhido, contra o novo,
 * compra + (k - 1)). Antes a última não existia e a parcela entrava de novo.
 */
export const ORDEM_DA_PROCURA: ReadonlyArray<{ delta: -1 | 0 | 1; soProjetada: boolean }> = [
  { delta: 0, soProjetada: false },
  { delta: -1, soProjetada: true },
  { delta: 1, soProjetada: true },
  { delta: -1, soProjetada: false },
  { delta: 1, soProjetada: false },
];

/**
 * Acha (e tira da lista, para não ser usada duas vezes) a parcela já lançada com o valor da linha.
 * `doMes(delta)`: as parcelas já gravadas com a mesma descrição no mês da linha + delta.
 */
export function acharParcelaExistente<P extends { valor: number }>(
  doMes: (delta: -1 | 0 | 1) => P[] | undefined,
  valor: number,
  total: number,
  ehProjetada: (p: P) => boolean,
): P | null {
  for (const { delta, soProjetada } of ORDEM_DA_PROCURA) {
    const lista = doMes(delta);
    if (!lista) continue;
    const i = lista.findIndex((p) => mesmaParcela(p.valor, valor, total) && (!soProjetada || ehProjetada(p)));
    if (i !== -1) return lista.splice(i, 1)[0];
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Prévia do conserto dos dados que já estão no banco (só leitura)

export type ParcelaGravada = {
  id: string;
  /** Quem é dono (userId|profileId). Fica só na memória: a prévia não imprime nem grava. */
  dono: string;
  /** Índice do mês em que está. */
  mes: number;
  descricao: string;
  valor: number;
  /** Gravada sem dia (modo antigo ou antes de out/2026). */
  semDia: boolean;
  /** Projetada: num mês depois do mês da fatura do lote que a criou. */
  projetada: boolean;
};

export type AchadoDaPrevia = {
  id: string;
  acao: "apagar" | "mover";
  causa: "par-no-mesmo-mes" | "mes-vizinho";
  /** "alta": a que sai é projetada ou sem dia. "revisar": as duas vieram de fatura, com dia (pode
   * ser compra igual um mês depois). */
  confianca: "alta" | "revisar";
  /** Para "mover": quantos meses (+1 ou -1). */
  meses?: number;
};

type Lida = ParcelaGravada & { atual: number; total: number; loja: string; origem: number };

/** Qual sai primeiro: a projetada, depois a sem dia; entre iguais, a última da lista. */
const ordemDeSair = (a: Lida, b: Lida) => Number(b.projetada) - Number(a.projetada) || Number(b.semDia) - Number(a.semDia);

/**
 * O que um conserto faria com as parcelas gravadas. Só diz; quem grava é outro script, depois.
 *
 * - par-no-mesmo-mes (causa 1): a mesma compra (dono, loja, total, valor, mês da compra) com a
 *   mesma parcela mais vezes no mesmo mês do que a parcela que mais veio de fatura (não
 *   projetada): as de sobra saem, as projetadas primeiro.
 * - mes-vizinho (causa 2): a mesma compra lida com o mês da compra um mês de diferença. Fica o
 *   lado com mais parcelas (empate: o com mais parcela com dia, o modo novo). A parcela do lado
 *   menor que também está no lado maior sai; a que só está no lado menor muda de mês.
 */
export function previaDasParcelas(
  gravadas: ParcelaGravada[],
  /** A série que ela recusou no "Não é parcela" (não é parcela, o conserto não mexe). */
  recusada: (dono: string, descricao: string, total: number) => boolean = () => false,
): AchadoDaPrevia[] {
  const lidas: Lida[] = [];
  for (const g of gravadas) {
    const p = parseInstallment(g.descricao);
    if (!p?.confident || !(g.valor > 0)) continue;
    if (recusada(g.dono, g.descricao, p.total)) continue;
    const loja = lojaDaParcela(g.descricao, p.total);
    lidas.push({ ...g, atual: p.current, total: p.total, loja, origem: g.mes - (p.current - 1) });
  }
  const achados: AchadoDaPrevia[] = [];
  const saiu = new Set<string>();

  // Compras: dono + loja + total, valor com a folga dos centavos.
  const porSerie = new Map<string, Lida[]>();
  for (const l of lidas) {
    const k = `${l.dono}|${l.loja}|${l.total}`;
    porSerie.set(k, [...(porSerie.get(k) ?? []), l]);
  }
  for (const daSerie of porSerie.values()) {
    const porValor: Lida[][] = [];
    for (const l of daSerie) {
      const g = porValor.find((x) => mesmaParcela(x[0].valor, l.valor, l.total));
      if (g) g.push(l);
      else porValor.push([l]);
    }
    for (const compra of porValor) {
      // Causa 1: dentro do mesmo mês da compra, a mesma parcela de sobra.
      const porOrigem = new Map<number, Lida[]>();
      for (const l of compra) porOrigem.set(l.origem, [...(porOrigem.get(l.origem) ?? []), l]);
      for (const mesma of porOrigem.values()) {
        const porParcela = new Map<number, Lida[]>();
        for (const l of mesma) porParcela.set(l.atual, [...(porParcela.get(l.atual) ?? []), l]);
        const copias = Math.max(1, ...[...porParcela.values()].map((ls) => ls.filter((l) => !l.projetada).length));
        for (const ls of porParcela.values()) {
          if (ls.length <= copias) continue;
          for (const l of [...ls].reverse().sort(ordemDeSair).slice(0, ls.length - copias)) {
            saiu.add(l.id);
            achados.push({ id: l.id, acao: "apagar", causa: "par-no-mesmo-mes", confianca: l.projetada || l.semDia ? "alta" : "revisar" });
          }
        }
      }
      // Causa 2: a mesma compra com o mês da compra um mês de diferença.
      const ficaram = compra.filter((l) => !saiu.has(l.id));
      const origens = [...new Set(ficaram.map((l) => l.origem))].sort((a, b) => a - b);
      for (let i = 0; i + 1 < origens.length; i += 1) {
        const [a, b] = [origens[i], origens[i + 1]];
        if (b - a !== 1) continue;
        const ladoA = ficaram.filter((l) => l.origem === a && !saiu.has(l.id));
        const ladoB = ficaram.filter((l) => l.origem === b && !saiu.has(l.id));
        if (ladoA.length === 0 || ladoB.length === 0) continue;
        // O lado maior fica (empate: o que tem mais parcela com dia, o modo novo).
        const peso = (ls: Lida[]) => ls.length * 2 + ls.filter((l) => !l.semDia).length / 1000;
        const [fica, sai, meses] = peso(ladoB) > peso(ladoA) ? [ladoB, ladoA, 1] : [ladoA, ladoB, -1];
        for (const l of sai) {
          const par = fica.find((f) => f.atual === l.atual && !saiu.has(f.id));
          if (par) {
            // Está nos dois meses: sai a do lado menor.
            saiu.add(l.id);
            achados.push({ id: l.id, acao: "apagar", causa: "mes-vizinho", confianca: l.projetada || l.semDia ? "alta" : "revisar" });
          } else {
            saiu.add(l.id);
            achados.push({ id: l.id, acao: "mover", causa: "mes-vizinho", confianca: l.projetada || l.semDia ? "alta" : "revisar", meses });
          }
        }
      }
    }
  }
  return achados;
}
