/**
 * Auditoria pontual: procura no banco a assinatura da leitura errada de extrato.
 * Rodar com: npx tsx scripts/auditar-numeros.ts
 */
import { prisma } from "@/lib/db/prisma";

const TETO = 200_000;

async function main() {
  const users = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true, email: true, name: true },
  });

  const linhas: string[] = [];
  let contaminadas = 0;

  for (const u of users) {
    const entries = await prisma.monthlyEntry.findMany({
      where: { userId: u.id },
      select: { amount: true, category: true, description: true, year: true, month: true, importBatchId: true },
    });
    if (entries.length === 0) continue;

    const vals = entries.map((e) => Number(e.amount));
    const gigantes = vals.filter((v) => Math.abs(v) > TETO);
    const redondos = vals.filter((v) => Math.round(Math.abs(v) * 100) % 100 === 0).length;
    const receitas = entries.filter((e) => e.category === "INCOME").length;
    const semCentavo = redondos / entries.length;
    const propReceita = receitas / entries.length;

    const sinais: string[] = [];
    if (gigantes.length > 0) sinais.push(`${gigantes.length} valor(es) > R$ 200 mil (max ${Math.max(...gigantes.map(Math.abs)).toLocaleString("pt-BR")})`);
    if (entries.length >= 8 && semCentavo >= 0.9) sinais.push(`${Math.round(semCentavo * 100)}% sem centavos`);
    if (entries.length >= 5 && propReceita >= 0.9) sinais.push(`${Math.round(propReceita * 100)}% entrou como receita`);

    if (sinais.length > 0) {
      contaminadas++;
      const lotes = new Set(entries.map((e) => e.importBatchId).filter(Boolean));
      linhas.push(
        `\n${u.name ?? "(sem nome)"} <${u.email}>\n  ${entries.length} lançamentos · ${lotes.size} lote(s) de importação\n  ${sinais.join("\n  ")}`,
      );
    }
  }

  console.log(`Contas de cliente com lançamentos: verificadas ${users.length}`);
  console.log(`Contas com assinatura de leitura errada: ${contaminadas}`);
  console.log(linhas.join("\n"));
  await prisma.$disconnect();
}

main();
