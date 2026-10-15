import { valorDoLivre } from "@/lib/planning/livre-do-mes";

/**
 * A tela que aparece logo depois de importar: o mês montado.
 *
 * A página de venda promete "solta o extrato, o mês se monta sozinho", e a importação terminava
 * num "12 lançamentos importados com sucesso" e um botão Concluir. Quem pede reembolso no
 * primeiro dia é justamente quem não viu o valor na primeira hora. Aqui ela vê o mês: quanto
 * entrou, quanto saiu, pra onde mais foi e, se já tem orçamento, quanto ainda está livre.
 *
 * Puro, sem banco: a action busca as linhas e isto faz a conta (e é o que o teste cobre).
 */

export type LinhaDoMes = {
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  /** Chave da categoria (a fixa, ou o id da personalizada); null = gasto sem categoria. */
  chave: string | null;
  /** O nome que a pessoa lê ("Alimentação", "Pet"); null = sem categoria. */
  rotulo: string | null;
  /** Soma do grupo. Gasto pode vir negativo quando a devolução é maior que a compra. */
  valor: number;
};

export type OrcamentoDoMes = { chave: string; planejado: number };

export type Revelacao = {
  entrou: number;
  saiu: number;
  guardou: number;
  /** As 3 categorias com mais gasto; `fracao` é a parte do que saiu (0 a 1), pra barrinha. */
  maiores: { rotulo: string; valor: number; fracao: number }[];
  /** O livre do mês (planejado − o que saiu, em reais inteiros; negativo passou do plano). Null sem orçamento. */
  livre: number | null;
  planejado: number;
};

export function montarRevelacao(linhas: LinhaDoMes[], orcamentos: OrcamentoDoMes[]): Revelacao {
  const soma = (cat: LinhaDoMes["category"]) => linhas.filter((l) => l.category === cat).reduce((s, l) => s + l.valor, 0);
  const entrou = Math.max(0, soma("INCOME"));
  const saiu = Math.max(0, soma("EXPENSE"));
  const guardou = Math.max(0, soma("INVESTMENT_CONTRIBUTION"));

  // Gasto por categoria. O que está sem categoria entra no "saiu" (é dinheiro que saiu), mas não
  // disputa as "maiores": não é um lugar pra onde o dinheiro foi, é um gasto por classificar.
  const porCategoria = new Map<string, { rotulo: string; valor: number }>();
  for (const l of linhas) {
    if (l.category !== "EXPENSE" || !l.chave || !l.rotulo) continue;
    const atual = porCategoria.get(l.chave);
    porCategoria.set(l.chave, { rotulo: l.rotulo, valor: (atual?.valor ?? 0) + l.valor });
  }
  const maiores = [...porCategoria.values()]
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3)
    .map((c) => ({ ...c, fracao: saiu > 0 ? Math.min(1, c.valor / saiu) : 0 }));

  // O "livre" é o MESMO de todas as telas (lib/planning/livre-do-mes, 15/10/2026): o plano do mês
  // menos tudo o que saiu, com ou sem categoria. Negativo: passou do plano.
  const planejado = orcamentos.reduce((s, o) => s + Math.max(0, o.planejado), 0);
  if (planejado <= 0) return { entrou, saiu, guardou, maiores, livre: null, planejado: 0 };
  const livre = valorDoLivre(planejado, soma("EXPENSE"));
  return { entrou, saiu, guardou, maiores, livre, planejado };
}

/**
 * Qual mês mostrar depois de importar. Fatura: o mês escolhido (todas as compras entram nele).
 * Extrato: o mês com mais lançamentos no arquivo; no empate, o mais recente (o extrato de 20/08
 * a 20/09 é "o de setembro" pra quem subiu). Sem data nenhuma, null: a tela mostra só o pronto.
 */
export function mesDaRevelacao(datas: string[], fatura: { year: number; month: number } | null): { year: number; month: number } | null {
  if (fatura) return fatura;
  const contagem = new Map<string, number>();
  for (const d of datas) {
    const m = d.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!m) continue;
    const k = `${m[1]}-${m[2]}`;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  let melhor: string | null = null;
  for (const [k, n] of contagem) {
    const nMelhor = melhor ? contagem.get(melhor)! : -1;
    if (n > nMelhor || (n === nMelhor && melhor !== null && k > melhor)) melhor = k;
  }
  if (!melhor) return null;
  return { year: Number(melhor.slice(0, 4)), month: Number(melhor.slice(5, 7)) };
}
