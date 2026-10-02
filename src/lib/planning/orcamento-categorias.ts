/**
 * As categorias do mês do jeito do Copilot (01/10/2026): a cor vem da PREVISÃO, as contas que
 * ainda vão vencer aparecem reservadas, e "Cobrir" tira a sobra de uma para a que passou.
 * Puro: a página busca os números, aqui só a conta.
 */

/** Conta fixa sai de uma vez (o aluguel do dia 10): projetar pelo ritmo explodiria a previsão. */
const FIXAS = new Set(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]);

export type EstadoDaCategoria = "dentro" | "vai-passar" | "passou" | "sem-plano";

export type CategoriaDoMes = {
  key: string;
  label: string;
  planejado: number;
  /** O que já saiu (até hoje, ou sem data). */
  gasto: number;
  /** Lançado com data depois de hoje: a conta que ainda vai vencer. */
  aVencer: number;
  previsto: number;
  estado: EstadoDaCategoria;
  /** Planejado − gasto − a vencer: o que ainda está livre de verdade (negativo = passou). */
  sobra: number;
};

export function categoriaDoMes(input: { key: string; label: string; planejado: number; gasto: number; aVencer: number }, decorrido: number): CategoriaDoMes {
  const { planejado, gasto, aVencer } = input;
  const ritmo = FIXAS.has(input.key) || decorrido <= 0.05 ? gasto : gasto / Math.min(1, decorrido);
  const previsto = Math.round(Math.max(gasto, ritmo) + aVencer);
  const sobra = Math.round(planejado - gasto - aVencer);
  const estado: EstadoDaCategoria = !(planejado > 0) ? "sem-plano" : gasto + aVencer > planejado ? "passou" : previsto > planejado * 1.02 ? "vai-passar" : "dentro";
  return { ...input, previsto, estado, sobra };
}

/** Ordem da lista: quem passou, quem vai passar, e então quem gasta mais. */
export function ordenarCategorias(cs: CategoriaDoMes[]): CategoriaDoMes[] {
  const peso: Record<EstadoDaCategoria, number> = { passou: 0, "vai-passar": 1, dentro: 2, "sem-plano": 3 };
  return [...cs].sort((a, b) => peso[a.estado] - peso[b.estado] || b.gasto + b.aVencer - (a.gasto + a.aVencer));
}

/**
 * "Lazer passou R$ 60. Cobrir com a sobra de Transporte?": a que mais passou, coberta pela que
 * tem mais folga PREVISTA (o que sobra depois do ritmo do resto do mês), se a folga cobrir tudo.
 */
export function sugestaoDeCobrir(cs: CategoriaDoMes[]): { de: CategoriaDoMes; para: CategoriaDoMes; valor: number } | null {
  const passou = cs.filter((c) => c.estado === "passou").sort((a, b) => a.sobra - b.sobra)[0];
  if (!passou) return null;
  const valor = Math.ceil(-passou.sobra);
  const doadora = cs
    .filter((c) => c.key !== passou.key && c.planejado > 0 && c.estado === "dentro")
    .map((c) => ({ c, folga: Math.floor(c.planejado - c.previsto) }))
    .filter((x) => x.folga >= valor)
    .sort((a, b) => b.folga - a.folga)[0];
  return doadora ? { de: doadora.c, para: passou, valor } : null;
}

/** O plano sugerido no detalhe: a média dos meses com plano, se passou em metade ou mais. */
export function planoMaisRealista(historico: { gasto: number; planejado: number }[], planejadoAtual: number): { passou: number; meses: number; sugerido: number } | null {
  const comPlano = historico.filter((h) => h.planejado > 0);
  if (comPlano.length < 3) return null;
  const passou = comPlano.filter((h) => h.gasto > h.planejado).length;
  if (passou * 2 < comPlano.length) return null;
  const media = comPlano.reduce((s, h) => s + h.gasto, 0) / comPlano.length;
  const sugerido = Math.ceil(media / 50) * 50;
  return sugerido > planejadoAtual ? { passou, meses: comPlano.length, sugerido } : null;
}
