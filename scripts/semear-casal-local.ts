/**
 * Nós dois da Ana canônica SÓ PARA O BANCO LOCAL (fotos do login do par). Roda depois de
 * scripts/semear-local.ts, que cria a Ana com o Pessoal.
 *
 *   npx tsx scripts/semear-casal-local.ts            → perfil Casal da Ana, sem par (para o convite)
 *   npx tsx scripts/semear-casal-local.ts --com-par  → e o Lucas já dentro, com o "só meu" dele
 *
 * Entrar com: ana@exemplo.test ou lucas@exemplo.test / senha-de-teste-local (só no banco local).
 * Números de estudo-apps-financas/ana-canonica.md, seção 9: Lucas manda R$ 458 em outubro e
 * R$ 259 em setembro. Recusa rodar fora do localhost: os números da Ana não vão para produção.
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type ParentCategory } from "@prisma/client";

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Recusei: este script só roda no banco local (DATABASE_URL aponta para "${host || "nada"}").`);
  process.exit(1);
}

const prisma = new PrismaClient();
const SENHA = "senha-de-teste-local";
const comPar = process.argv.includes("--com-par");

type Linha = { ano: number; mes: number; dia: number; cat: "INCOME" | "EXPENSE"; pc: ParentCategory | null; desc: string; valor: number; pessoa: "A" | "B"; doCasal: boolean | null; soMeu?: boolean; doLucas?: boolean };

const OUTUBRO: Linha[] = [
  { ano: 2026, mes: 10, dia: 1, cat: "INCOME", pc: null, desc: "Salário", valor: 7700, pessoa: "A", doCasal: null },
  { ano: 2026, mes: 10, dia: 1, cat: "INCOME", pc: null, desc: "Salário", valor: 6300, pessoa: "B", doCasal: null, doLucas: true },
  { ano: 2026, mes: 10, dia: 1, cat: "EXPENSE", pc: "MORADIA", desc: "Aluguel", valor: 2400, pessoa: "A", doCasal: true },
  { ano: 2026, mes: 10, dia: 3, cat: "EXPENSE", pc: "ALIMENTACAO", desc: "Mercado", valor: 450, pessoa: "A", doCasal: true },
  { ano: 2026, mes: 10, dia: 5, cat: "EXPENSE", pc: "MORADIA", desc: "Condomínio", valor: 500, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 6, cat: "EXPENSE", pc: "ALIMENTACAO", desc: "Mercado", valor: 370, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 4, cat: "EXPENSE", pc: "MORADIA", desc: "Luz Enel", valor: 180, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 4, cat: "EXPENSE", pc: "MORADIA", desc: "Internet Vivo", valor: 150, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 4, cat: "EXPENSE", pc: "LAZER", desc: "Jantar fora", valor: 210, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 2, cat: "EXPENSE", pc: "OUTROS", desc: "Ração da Mel", valor: 90, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 10, dia: 2, cat: "EXPENSE", pc: "SAUDE", desc: "Smart Fit", valor: 120, pessoa: "A", doCasal: false },
  { ano: 2026, mes: 10, dia: 3, cat: "EXPENSE", pc: "LAZER", desc: "Spotify", valor: 22, pessoa: "B", doCasal: false, doLucas: true },
  { ano: 2026, mes: 10, dia: 6, cat: "EXPENSE", pc: "OUTROS", desc: "Barbearia", valor: 60, pessoa: "B", doCasal: false, doLucas: true },
  // O "só meu" da Ana: não aparece em lente nenhuma para o Lucas.
  { ano: 2026, mes: 10, dia: 5, cat: "EXPENSE", pc: "OUTROS", desc: "Calça", valor: 180, pessoa: "A", doCasal: false, soMeu: true },
];

// Setembro: casa 6.620, Ana pagou 3.900 e Lucas 2.720; pela renda, Lucas manda R$ 259.
const SETEMBRO: Linha[] = [
  { ano: 2026, mes: 9, dia: 1, cat: "INCOME", pc: null, desc: "Salário", valor: 7700, pessoa: "A", doCasal: null },
  { ano: 2026, mes: 9, dia: 1, cat: "INCOME", pc: null, desc: "Salário", valor: 6300, pessoa: "B", doCasal: null, doLucas: true },
  { ano: 2026, mes: 9, dia: 1, cat: "EXPENSE", pc: "MORADIA", desc: "Aluguel", valor: 2400, pessoa: "A", doCasal: true },
  { ano: 2026, mes: 9, dia: 12, cat: "EXPENSE", pc: "ALIMENTACAO", desc: "Mercado do mês", valor: 1500, pessoa: "A", doCasal: true },
  { ano: 2026, mes: 9, dia: 5, cat: "EXPENSE", pc: "MORADIA", desc: "Condomínio e contas", valor: 1210, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 9, dia: 20, cat: "EXPENSE", pc: "LAZER", desc: "Saídas a dois", valor: 1010, pessoa: "B", doCasal: true, doLucas: true },
  { ano: 2026, mes: 9, dia: 22, cat: "EXPENSE", pc: "OUTROS", desc: "Pet e farmácia", valor: 500, pessoa: "B", doCasal: true, doLucas: true },
];

async function main() {
  const ana = await prisma.user.findUnique({ where: { email: "ana@exemplo.test" }, select: { id: true } });
  if (!ana) throw new Error("Rode antes: npx tsx scripts/semear-local.ts");
  await prisma.allowedEmail.update({ where: { email: "ana@exemplo.test" }, data: { active: true, expiresAt: new Date("2027-10-11T15:00:00Z") } });

  // O Lucas de antes sai inteiro (conta, vínculo e o só meu dele).
  const lucasAntigo = await prisma.user.findUnique({ where: { email: "lucas@exemplo.test" }, select: { id: true } });
  if (lucasAntigo) {
    await prisma.monthlyEntry.deleteMany({ where: { userId: lucasAntigo.id } });
    await prisma.user.delete({ where: { id: lucasAntigo.id } });
  }
  await prisma.financialProfile.deleteMany({ where: { userId: ana.id, kind: "CASAL" } });
  await prisma.financialProfile.updateMany({ where: { userId: ana.id }, data: { isDefault: false } });
  const casal = await prisma.financialProfile.create({
    data: {
      userId: ana.id,
      name: "Nós dois",
      kind: "CASAL",
      icon: "heart",
      theme: "girly",
      position: 1,
      isDefault: true,
      casal: { nomeA: "Ana", nomeB: "Lucas", divisao: "renda", acertos: [] },
    },
  });

  const lucas = comPar
    ? await prisma.user.create({
        data: { email: "lucas@exemplo.test", name: "Lucas Lima", passwordHash: await bcrypt.hash(SENHA, 10), onboardedAt: new Date(), theme: "light" },
      })
    : null;

  let n = 0;
  await prisma.monthlyEntry.createMany({
    data: [...OUTUBRO, ...SETEMBRO].map((l) => ({
      userId: ana.id,
      profileId: casal.id,
      year: l.ano,
      month: l.mes,
      entryDate: new Date(Date.UTC(l.ano, l.mes - 1, l.dia, 12)),
      category: l.cat,
      parentCategory: l.pc,
      description: l.desc,
      amount: l.valor,
      pessoa: l.pessoa,
      doCasal: l.doCasal,
      soMeu: l.soMeu ?? false,
      autorUserId: lucas && l.doLucas ? lucas.id : null,
      externalId: `casal-local:${n++}`,
    })),
  });

  await prisma.goal.createMany({
    data: [
      { userId: ana.id, profileId: casal.id, name: "Apartamento", targetAmount: 60000, currentAmount: 18400, targetDate: new Date("2029-02-01T12:00:00Z"), icon: "CASA" },
      { userId: ana.id, profileId: casal.id, name: "Viagem de 5 anos", targetAmount: 9000, currentAmount: 3150, targetDate: new Date("2027-08-01T12:00:00Z"), icon: "VIAGEM" },
    ],
  });

  if (lucas) {
    await prisma.membroCasal.create({
      data: { profileId: casal.id, userId: lucas.id, letra: "B", entrouEm: new Date("2026-10-11T14:00:00Z"), termosVersao: "par-2026-10-11", termosAceitosEm: new Date("2026-10-11T14:00:00Z") },
    });
    // O "só meu" do Lucas é gravado com o userId DELE: a Ana não vê nem o total.
    await prisma.monthlyEntry.create({
      data: { userId: lucas.id, profileId: casal.id, autorUserId: lucas.id, year: 2026, month: 10, entryDate: new Date(Date.UTC(2026, 9, 8, 12)), category: "EXPENSE", parentCategory: "LAZER", description: "Presente surpresa", amount: 150, pessoa: "B", doCasal: false, soMeu: true },
    });
    // Setembro: a Ana já conferiu, falta o Lucas (tela "Fechar setembro").
  }
  console.log(`Pronto: Nós dois da Ana${lucas ? " com o Lucas dentro" : " sem par"} (banco local).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
