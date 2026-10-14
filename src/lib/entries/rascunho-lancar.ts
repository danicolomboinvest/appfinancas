/**
 * Rascunho do "Digitar" que sobrevive à recarga da versão nova (13/10/2026). Quando o app é
 * atualizado com a folha de lançar aberta, ele recarrega sozinho; o valor, a categoria e o resto
 * ficam guardados no aparelho (sessionStorage, só nesta aba) e voltam ao abrir o Digitar de novo.
 * Vale por 10 minutos: depois disso é um lançamento que ninguém mais está esperando.
 */
export type RascunhoLancar = {
  tipo: "EXPENSE" | "INCOME" | "INVESTMENT_CONTRIBUTION" | "RESGATE";
  centavos: number;
  categoria: string | null;
  tipoLivre: string;
  descricao: string;
  chip: string;
};

export const CHAVE_RASCUNHO_LANCAR = "spi-rascunho-lancar";
export const VALIDADE_RASCUNHO_MS = 10 * 60_000;
const TIPOS = new Set(["EXPENSE", "INCOME", "INVESTMENT_CONTRIBUTION", "RESGATE"]);

export function montarRascunho(r: RascunhoLancar, agora: number): string {
  return JSON.stringify({ ...r, quando: agora });
}

/** Lê o que foi guardado; null se não tem, se venceu, se não tem valor ou se veio quebrado. */
export function lerRascunho(texto: string | null, agora: number): RascunhoLancar | null {
  if (!texto) return null;
  try {
    const r = JSON.parse(texto) as Partial<RascunhoLancar> & { quando?: number };
    if (typeof r.quando !== "number" || agora - r.quando > VALIDADE_RASCUNHO_MS || r.quando > agora) return null;
    if (!TIPOS.has(String(r.tipo)) || typeof r.centavos !== "number" || !(r.centavos > 0)) return null;
    return {
      tipo: r.tipo as RascunhoLancar["tipo"],
      centavos: Math.round(r.centavos),
      categoria: typeof r.categoria === "string" ? r.categoria : null,
      tipoLivre: typeof r.tipoLivre === "string" ? r.tipoLivre : "",
      descricao: typeof r.descricao === "string" ? r.descricao : "",
      chip: typeof r.chip === "string" ? r.chip : "hoje",
    };
  } catch {
    return null;
  }
}
