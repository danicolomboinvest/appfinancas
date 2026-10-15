import { dia, diasUteis } from "../../src/lib/portfolio/calendario-anbima";

/**
 * O rendimento da renda fixa na jornada (15/10/2026). O banco local tem um CDI de mentira, fixo,
 * em cada dia útil (semear.ts), e a Ana tem um CDB de 110% do CDI comprado há 6 meses.
 */
export const CDI_DE_TESTE = 0.00055131; // ao dia, em fração (≈ 14,9% ao ano)
export const CDB_DA_ANA = { nome: "CDB Nubank 110% do CDI", naLista: "CDB Nubank", investido: 5000, percentual: 1.1, compra: "2026-04-15" };

/** Quanto o CDB vale no dia (AAAA-MM-DD): cada dia útil da compra até ontem, com o CDI de teste. */
export function valorEsperadoDoCdb(hoje: string): number {
  const [a, m, d] = CDB_DA_ANA.compra.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  const n = diasUteis(dia(a, m, d), dia(ha, hm, hd));
  return Math.round(CDB_DA_ANA.investido * Math.pow(1 + CDI_DE_TESTE * CDB_DA_ANA.percentual, n) * 100) / 100;
}
