/**
 * Toda sugestão do "Montar o plano" fecha exatamente no que há para dividir (protótipo aprovado,
 * rodada 19, `mpFecha`). `base` é o valor desejado de cada categoria; `trava` são as que ficam
 * como estão se couberem (as fixas, ou as que ela criou). O resto escala até bater o alvo,
 * arredonda em dezenas, e a sobra do arredondamento vai para a categoria variável maior.
 * Devolve os valores e as que ficaram mais de 10 abaixo do desejado (para o aviso "Para caber…").
 */
export function fecharExato(
  alvo: number,
  base: Record<string, number>,
  trava: readonly string[] = [],
  fixas: readonly string[] = [],
): { val: Record<string, number>; abaixo: string[] } {
  const ns = Object.keys(base);
  const val: Record<string, number> = {};
  if (ns.length === 0) return { val, abaixo: [] };
  alvo = Math.max(0, Math.round(alvo));
  let tr = ns.filter((n) => trava.includes(n));
  if (tr.reduce((s, n) => s + base[n], 0) > alvo) tr = [];
  let pool = ns.filter((n) => !tr.includes(n));
  if (pool.length === 0) {
    pool = ns;
    tr = [];
  }
  const T = alvo - tr.reduce((s, n) => s + base[n], 0);
  const W = pool.reduce((s, n) => s + Math.max(0, base[n]), 0);
  const peso = (n: string) => (W > 0 ? Math.max(0, base[n]) / W : 1 / pool.length);
  for (const n of tr) val[n] = base[n];
  const x = pool.map((n) => {
    const r = T * peso(n);
    const t = Math.floor(r / 10) * 10;
    return { n, r, t, f: r - t };
  });
  let sobra = T - x.reduce((s, o) => s + o.t, 0);
  for (const o of [...x].sort((a, b) => b.f - a.f)) {
    if (sobra >= 10) {
      o.t += 10;
      sobra -= 10;
    }
  }
  const variaveis = x.filter((o) => !fixas.includes(o.n) && o.t + sobra >= 0);
  const maior = [...(variaveis.length ? variaveis : x)].sort((a, b) => b.r - a.r)[0];
  if (maior) maior.t += sobra;
  for (const o of x) val[o.n] = o.t;
  return { val, abaixo: ns.filter((n) => val[n] < base[n] - 10) };
}

/** A regra do guardar da aula: dos 18%, 10% da renda vão para a liberdade financeira e o resto para os sonhos. */
export function divisaoDoGuardar(renda: number, guardar: number): { liberdade: number; sonhos: number } {
  const liberdade = Math.min(Math.max(0, guardar), Math.round(Math.max(0, renda) * 0.1));
  return { liberdade, sonhos: Math.max(0, guardar - liberdade) };
}

/** Porcentagens inteiras que somam 100 (maior resto), para a legenda do "Seu plano". */
export function porcentagensQueSomam100(valores: readonly number[]): number[] {
  const total = valores.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return valores.map(() => 0);
  const brutas = valores.map((v) => (Math.max(0, v) / total) * 100);
  const out = brutas.map(Math.floor);
  let falta = 100 - out.reduce((s, v) => s + v, 0);
  for (const i of brutas.map((b, i) => ({ i, f: b - Math.floor(b) })).sort((a, b) => b.f - a.f).map((x) => x.i)) {
    if (falta <= 0) break;
    out[i] += 1;
    falta -= 1;
  }
  return out;
}
