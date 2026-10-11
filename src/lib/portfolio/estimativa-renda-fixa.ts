/**
 * "Quanto vale hoje?" de uma renda fixa no Novo ativo (rodada 23): pelo que ela investiu, quando
 * e quanto rende. É ESTIMATIVA, antes do IR, e a tela diz isso e de onde veio o CDI ou o IPCA
 * (Banco Central, com a data). "Não sei a taxa" estima com 100% do CDI e marca "estimado".
 * Sem a data da compra ou sem o índice, não estima (devolve null) e a tela pergunta o valor.
 */
export type Rendimento = { indexador: "cdi"; percentual: number } | { indexador: "ipca"; taxa: number } | { indexador: "pre"; taxa: number };

export function estimarRendaFixa(input: {
  investido: number;
  /** Meses desde a compra (0 ou mais). */
  meses: number;
  rende: Rendimento;
  /** CDI ao ano em fração (0.1365), do Banco Central. */
  cdiAoAno: number | null;
  /** IPCA de 12 meses em fração (0.0458), do Banco Central. */
  ipca12m: number | null;
}): number | null {
  const { investido, meses, rende } = input;
  if (!(investido > 0) || !(meses >= 0)) return null;
  const anos = meses / 12;
  let fator: number;
  if (rende.indexador === "cdi") {
    if (input.cdiAoAno === null) return null;
    const cdiAoDia = Math.pow(1 + input.cdiAoAno, 1 / 252) - 1;
    fator = Math.pow(1 + cdiAoDia * (rende.percentual / 100), 252 * anos);
  } else if (rende.indexador === "ipca") {
    if (input.ipca12m === null) return null;
    fator = Math.pow((1 + input.ipca12m) * (1 + rende.taxa / 100), anos);
  } else {
    fator = Math.pow(1 + rende.taxa / 100, anos);
  }
  return Math.round(investido * fator * 100) / 100;
}

/** Meses inteiros entre a compra (ano, mês 1 a 12) e hoje. */
export function mesesDesde(ano: number, mes: number, hoje: Date): number {
  return Math.max(0, (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() + 1 - mes));
}

/** "100% do CDI", "IPCA + 6%", "12% ao ano". */
export function textoDoRendimento(r: Rendimento): string {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (r.indexador === "cdi") return `${n(r.percentual)}% do CDI`;
  if (r.indexador === "ipca") return `IPCA + ${n(r.taxa)}%`;
  return `${n(r.taxa)}% ao ano`;
}
