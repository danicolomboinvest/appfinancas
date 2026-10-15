/**
 * A linha que diz de onde veio o valor de uma renda fixa calculada pelo app (15/10/2026): o
 * índice e a data, sempre "antes do IR" (regra "sem número inventado": fonte e data ao lado).
 * Usada no detalhe do ativo e no Novo ativo, para as duas telas dizerem a mesma coisa.
 */

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export type ComoCalculou = "cdi" | "ipca" | "pre" | "tesouro";

/** "Estimado pelo CDI de 14/10, antes do IR" e a fonte ("Banco Central"), ou null se o app não calculou. */
export function linhaDoRendimento(r: { como: string | null; referenteA: Date | string | null; estimado: boolean; semTaxa: boolean }): { texto: string; fonte: string | null; nota: string | null } | null {
  if (!r.como || !r.referenteA || r.como === "tesouro") return null;
  const ref = typeof r.referenteA === "string" ? new Date(r.referenteA) : r.referenteA;
  if (Number.isNaN(ref.getTime())) return null;
  if (r.como === "cdi") {
    return { texto: `${r.semTaxa ? "Estimado com 100% do CDI" : "Estimado pelo CDI"} de ${ddmm(ref)}, antes do IR`, fonte: "Banco Central", nota: null };
  }
  if (r.como === "ipca") {
    const mes = `${MES[ref.getUTCMonth()]}/${String(ref.getUTCFullYear()).slice(2)}`;
    return { texto: `Estimado pelo IPCA de ${mes}, antes do IR`, fonte: "Banco Central", nota: r.estimado ? "O mês atual usa o último IPCA divulgado." : null };
  }
  if (r.como === "pre") return { texto: `Estimado pela taxa da compra até ${ddmm(ref)}, antes do IR`, fonte: null, nota: null };
  return null;
}
