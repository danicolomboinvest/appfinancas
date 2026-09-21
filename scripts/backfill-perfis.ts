/**
 * Dá um perfil "Pessoal" a quem já usava o app, e pendura nele todo o histórico da pessoa.
 *
 * IDEMPOTENTE de propósito: pode rodar quantas vezes for preciso. Roda uma vez antes do deploy
 * e de novo depois, pra pegar o que o código antigo tiver gravado no intervalo — essas linhas
 * nascem com profileId nulo e ficariam invisíveis quando as telas passarem a filtrar por perfil.
 *
 * Só toca em linha com profileId NULO. Nunca move dado de um perfil pra outro.
 *
 * Rodar com: npx tsx scripts/backfill-perfis.ts [--dry]
 */
import { prisma } from "@/lib/db/prisma";

/** Tabelas que passam a viver dentro de um perfil. Precisa bater com a lista do schema. */
const TABELAS = [
  "monthlyEntry", "budget", "monthlyPlan", "customCategory", "goal", "asset",
  "emergencyFund", "planningParams", "portfolioStrategy", "patrimonySnapshot",
  "importBatch", "contributionAllocation", "transactionCategoryRule",
  "simulation", "analysisSheet", "yearlyConsolidationCache", "accumulationProjectionCache",
] as const;

async function main() {
  const dry = process.argv.includes("--dry");
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`${users.length} contas${dry ? " (SIMULAÇÃO, nada será gravado)" : ""}`);

  let criados = 0;
  let reaproveitados = 0;
  const movidos = new Map<string, number>();

  for (const u of users) {
    // Quem já tem perfil padrão reaproveita o dele: rodar de novo não pode criar um segundo.
    let perfil = await prisma.financialProfile.findFirst({ where: { userId: u.id, isDefault: true } });
    if (!perfil) {
      if (dry) {
        criados += 1;
      } else {
        perfil = await prisma.financialProfile.create({
          data: { userId: u.id, name: "Pessoal", kind: "PESSOAL", icon: "wallet", color: "ambar", isDefault: true, isLegacy: true },
        });
        criados += 1;
      }
    } else {
      reaproveitados += 1;
    }
    if (dry || !perfil) continue;

    for (const tabela of TABELAS) {
      // @ts-expect-error índice dinâmico sobre os delegates do Prisma: a lista é fixa e validada acima.
      const { count } = await prisma[tabela].updateMany({
        where: { userId: u.id, profileId: null },
        data: { profileId: perfil.id },
      });
      if (count > 0) movidos.set(tabela, (movidos.get(tabela) ?? 0) + count);
    }
  }

  console.log(`\nPerfis criados: ${criados} | já existiam: ${reaproveitados}`);
  if (movidos.size === 0) {
    console.log("Nenhum registro órfão: tudo já estava vinculado.");
  } else {
    console.log("Registros vinculados:");
    for (const [t, n] of [...movidos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${t}`);
  }

  // Conferência final: sobrou alguma linha sem perfil?
  let orfaos = 0;
  for (const tabela of TABELAS) {
    // @ts-expect-error mesmo índice dinâmico da lista fixa acima.
    const n = await prisma[tabela].count({ where: { profileId: null } });
    if (n > 0) {
      console.log(`  AINDA SEM PERFIL: ${tabela} → ${n}`);
      orfaos += n;
    }
  }
  console.log(orfaos === 0 ? "\nConferido: nenhuma linha sem perfil." : `\nATENÇÃO: ${orfaos} linhas sem perfil.`);
  await prisma.$disconnect();
}

main();
