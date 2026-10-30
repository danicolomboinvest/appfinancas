import { TIPO_AVISO_CASAL_NO_PESSOAL, aceiteDeixaAviso } from "@/lib/casa/aviso-casal-no-pessoal";

/**
 * Quem monta o perfil Casal e já lança nele (orçamento, plano de renda, lançamentos) antes de o
 * par aceitar o convite deixa tudo no perfil Casal. No Casal simples cada um usa o próprio
 * Pessoal e o perfil Casal some do menu, então a titular via tudo vazio (caso de 28/10/2026:
 * 128 lançamentos e o plano de renda ficaram no perfil escondido). Ao aceitar, os dados DELA
 * passam do Casal para o Pessoal.
 *
 * Nunca sobrescreve: onde o Pessoal já tem o mesmo registro (mesma chave única), o do Pessoal
 * fica e o do Casal não é movido. Só mexe no que é da titular (userId) e do perfil Casal.
 */

/** Tabelas sem chave única que envolva o perfil: movem inteiras. */
const SEM_CHAVE_UNICA = ["ImportBatch", "Goal", "FotoDaMeta", "ContributionAllocation", "Asset", "Simulation", "AnalysisSheet", "ContaAPagar", "Divida", "Cartao"] as const;

/** Tabelas com chave única: só move o que não colide com o que o Pessoal já tem. */
const COM_CHAVE_UNICA: { tabela: string; colunas: string[] }[] = [
  { tabela: "MonthlyEntry", colunas: ["externalId"] },
  { tabela: "Budget", colunas: ["year", "month", "parentCategory", "customCategoryId"] },
  { tabela: "MonthlyPlan", colunas: ["year", "month"] },
  { tabela: "CustomCategory", colunas: ["name"] },
  { tabela: "TransactionCategoryRule", colunas: ["pattern"] },
  { tabela: "RegraDePerfil", colunas: ["pattern"] },
  { tabela: "EmergencyFund", colunas: [] },
  { tabela: "PlanningParams", colunas: [] },
  { tabela: "PortfolioStrategy", colunas: ["assetClass"] },
  { tabela: "PatrimonySnapshot", colunas: ["date"] },
];

/**
 * O aviso de uma vez para a titular (lib/casa/aviso-casal-no-pessoal): só quando o aceite levou
 * alguma coisa. Decisao com `resolvidaEm` nulo até o "Entendi" no Resumo.
 */
export async function registrarAvisoDoCasalNoPessoal(
  tx: { decisao: { create: (args: { data: { userId: string; profileId: string; tipo: string; chave: string; valor: number; resolvidaEm: null } }) => PromiseLike<unknown> } },
  dados: { userId: string; casalProfileId: string; pessoalProfileId: string; movidos: number },
): Promise<boolean> {
  if (!aceiteDeixaAviso(dados.movidos)) return false;
  await tx.decisao.create({
    data: { userId: dados.userId, profileId: dados.pessoalProfileId, tipo: TIPO_AVISO_CASAL_NO_PESSOAL, chave: dados.casalProfileId, valor: dados.movidos, resolvidaEm: null },
  });
  return true;
}

export async function levarDadosDoCasalParaOPessoal(
  tx: { $executeRawUnsafe: (consulta: string, ...valores: unknown[]) => PromiseLike<number> },
  userId: string,
  casalProfileId: string,
  pessoalProfileId: string,
): Promise<number> {
  if (casalProfileId === pessoalProfileId) return 0;
  let movidos = 0;
  for (const tabela of SEM_CHAVE_UNICA) {
    movidos += await tx.$executeRawUnsafe(`UPDATE "${tabela}" SET "profileId" = $1 WHERE "userId" = $2 AND "profileId" = $3`, pessoalProfileId, userId, casalProfileId);
  }
  for (const { tabela, colunas } of COM_CHAVE_UNICA) {
    const mesmaChave = colunas.map((c) => ` AND x."${c}" IS NOT DISTINCT FROM "${tabela}"."${c}"`).join("");
    movidos += await tx.$executeRawUnsafe(
      `UPDATE "${tabela}" SET "profileId" = $1 WHERE "userId" = $2 AND "profileId" = $3 AND NOT EXISTS (SELECT 1 FROM "${tabela}" x WHERE x."userId" = $2 AND x."profileId" = $1${mesmaChave})`,
      pessoalProfileId,
      userId,
      casalProfileId,
    );
  }
  return movidos;
}
