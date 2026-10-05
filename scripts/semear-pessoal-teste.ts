/**
 * Põe o mês corrente no perfil "Pessoal" da CONTA DE TESTE (rodada2@example.com), para os prints
 * da loja (App Store e Play) mostrarem um mês de verdade em andamento, e não R$ 0.
 *
 * Só toca no perfil Pessoal dessa conta. Idempotente: apaga o que ele mesmo semeou antes no mês
 * e semeia de novo, só até o dia de hoje. A marca fica no `externalId` ("semente-loja:"), e não na
 * descrição: na primeira versão o "[teste]" da descrição apareceu escrito no gráfico do orçamento.
 *
 * Rodar com: npx tsx scripts/semear-pessoal-teste.ts
 */
import { prisma } from "@/lib/db/prisma";
import type { ParentCategory, Prisma } from "@prisma/client";

const EMAIL = "rodada2@example.com";
const MARCA = "semente-loja:";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) throw new Error(`Conta ${EMAIL} não existe.`);
  const perfil = await prisma.financialProfile.findFirst({ where: { userId: user.id, kind: "PESSOAL" }, orderBy: { createdAt: "asc" } });
  if (!perfil) throw new Error("A conta de teste não tem perfil Pessoal.");
  const dono = { userId: user.id, profileId: perfil.id };

  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;
  const apagados = await prisma.monthlyEntry.deleteMany({ where: { ...dono, year, month, OR: [{ externalId: { startsWith: MARCA } }, { description: { startsWith: "[teste] " } }] } });
  console.log(`Perfil ${perfil.name}: ${apagados.count} lançamentos antigos do mês apagados.`);

  const linhas: Prisma.MonthlyEntryCreateManyInput[] = [];
  // Conta que se repete todo mês é lançada uma vez, lá atrás, com "Repetir": o app reconhece
  // pelo createdAt antes do mês começar, e ela sai do ritmo. Aqui fica assim também.
  const RECORRENTES = new Set(["Aluguel", "Condomínio", "Internet fibra", "Plano de saúde", "Streaming", "Academia", "Curso de inglês"]);
  const antesDoMes = new Date(Date.UTC(year, month - 1, 1) - 864e5 * 20);
  const push = (category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION", parentCategory: ParentCategory | null, subcategory: string, description: string, amount: number, dia: number) => {
    if (dia > hoje.getDate() && !RECORRENTES.has(description)) return;
    linhas.push({
      ...dono, year, month, category, parentCategory, subcategory, description, externalId: MARCA + linhas.length, amount,
      entryDate: new Date(Date.UTC(year, month - 1, dia)),
      ...(RECORRENTES.has(description) ? { createdAt: antesDoMes } : {}),
    });
  };

  push("INCOME", null, "Salário", "Salário", 6800, 1);
  push("INCOME", null, "Freela", "Freela de design", 900, 3);
  push("EXPENSE", "MORADIA", "Aluguel", "Aluguel", 1950, 1);
  push("EXPENSE", "MORADIA", "Condomínio", "Condomínio", 420, 1);
  push("EXPENSE", "MORADIA", "Internet", "Internet fibra", 110, 2);
  push("EXPENSE", "MORADIA", "Luz", "Conta de luz", 186.4, 2);
  push("EXPENSE", "ALIMENTACAO", "Mercado", "Mercado", 238.4, 1);
  push("EXPENSE", "ALIMENTACAO", "Padaria", "Padaria", 23.9, 2);
  push("EXPENSE", "ALIMENTACAO", "Restaurante", "Almoço", 36.9, 3);
  push("EXPENSE", "ALIMENTACAO", "Delivery", "iFood sábado", 42.5, 3);
  push("EXPENSE", "TRANSPORTE", "Combustível", "Gasolina", 150, 2);
  push("EXPENSE", "TRANSPORTE", "Aplicativo", "Uber pro trabalho", 31.2, 3);
  push("EXPENSE", "SAUDE", "Plano de saúde", "Plano de saúde", 389, 1);
  push("EXPENSE", "SAUDE", "Farmácia", "Farmácia", 28.3, 4);
  push("EXPENSE", "ALIMENTACAO", "Padaria", "Café da manhã", 18.5, 5);
  push("EXPENSE", "LAZER", "Streaming", "Streaming", 55.9, 1);
  push("EXPENSE", "LAZER", "Academia", "Academia", 129, 1);
  push("EXPENSE", "EDUCACAO", "Curso", "Curso de inglês", 249, 2);
  push("INVESTMENT_CONTRIBUTION", null, "Reserva de emergência", "Reserva de emergência", 600, 1);
  push("INVESTMENT_CONTRIBUTION", null, "Tesouro Selic", "Viagem Europa", 300, 1);

  await prisma.monthlyEntry.createMany({ data: linhas });
  console.log(`${linhas.length} lançamentos semeados em ${String(month).padStart(2, "0")}/${year}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
