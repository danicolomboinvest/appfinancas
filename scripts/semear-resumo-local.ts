/**
 * Contas de teste SÓ PARA O BANCO LOCAL, para as fotos do Resumo novo (14/10/2026):
 * - Ana (já semeada): ganha 2 parcelas e 2 assinaturas, para os Próximos meses;
 * - bia-extrato: só o extrato da conta de setembro;
 * - caio-fatura: só a fatura do cartão de setembro;
 * - duda-digitou: um gasto digitado hoje;
 * - eva-nada: nada ainda.
 * Recusa rodar fora de localhost. Senha de todas: a mesma da Ana (scripts/semear-local.ts).
 *
 * Rodar com: npx tsx --env-file=.env.local scripts/semear-resumo-local.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type ParentCategory, type Prisma } from "@prisma/client";

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
const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));

async function conta(email: string, nome: string) {
  const antiga = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (antiga) {
    await prisma.financialProfile.deleteMany({ where: { userId: antiga.id } });
    await prisma.importBatch.deleteMany({ where: { userId: antiga.id } });
    await prisma.user.delete({ where: { id: antiga.id } });
  }
  await prisma.allowedEmail.upsert({ where: { email }, update: { active: true, expiresAt: null, canceladoEm: null }, create: { email, note: "conta de teste local", source: "HUBLA" } });
  const user = await prisma.user.create({ data: { email, name: nome, passwordHash: await bcrypt.hash(SENHA, 10), emailVerifiedAt: new Date(), onboardedAt: new Date(), theme: "light", novidadesVersaoNova: "pulou", novidadesVistasEm: new Date() } });
  const perfil = await prisma.financialProfile.create({ data: { userId: user.id, name: "Pessoal", kind: "PESSOAL", theme: "padrao", isDefault: true } });
  return { userId: user.id, profileId: perfil.id };
}

type Linha = [ParentCategory | null, string, number, number | null];

function lancamentos(dono: { userId: string; profileId: string }, ano: number, mes: number, linhas: Linha[], lote: string | null, categoria: "EXPENSE" | "INCOME" = "EXPENSE"): Prisma.MonthlyEntryCreateManyInput[] {
  return linhas.map(([parentCategory, description, amount, d]) => ({
    ...dono,
    year: ano,
    month: mes,
    category: categoria,
    parentCategory: categoria === "EXPENSE" ? parentCategory : null,
    description,
    amount,
    entryDate: d ? dia(ano, mes, d) : null,
    importBatchId: lote,
    createdAt: lote ? new Date(Date.UTC(2026, 9, 10, 13)) : new Date(),
  }));
}

async function main() {
  // Ana: parcelas e assinaturas (os Próximos meses).
  const ana = await prisma.user.findUnique({ where: { email: "ana@exemplo.test" }, select: { id: true } });
  const perfilDaAna = ana ? await prisma.financialProfile.findFirst({ where: { userId: ana.id, isDefault: true }, select: { id: true } }) : null;
  if (ana && perfilDaAna) {
    const dono = { userId: ana.id, profileId: perfilDaAna.id };
    await prisma.monthlyEntry.deleteMany({ where: { ...dono, description: { in: ["Amazon (7/10)", "Amazon (8/10)", "Notebook (2/12)", "Notebook (3/12)"] } } });
    await prisma.monthlyEntry.createMany({
      data: [
        ...lancamentos(dono, 2026, 9, [["OUTROS", "Amazon (7/10)", 89, 12], ["EDUCACAO", "Notebook (2/12)", 250, 12]], null),
        ...lancamentos(dono, 2026, 10, [["OUTROS", "Amazon (8/10)", 89, 12], ["EDUCACAO", "Notebook (3/12)", 250, 12]], null),
      ],
    });
    await prisma.contaAPagar.deleteMany({ where: { ...dono, nome: { in: ["Netflix", "Spotify"] } } });
    await prisma.contaAPagar.createMany({
      data: [
        { ...dono, nome: "Netflix", valor: 44.9, vencimento: dia(2026, 10, 20), repete: true, tipo: "assinatura" },
        { ...dono, nome: "Spotify", valor: 21.9, vencimento: dia(2026, 10, 25), repete: true, tipo: "assinatura" },
      ],
    });
  }

  // Bia: só o extrato da conta de setembro (a fatura paga entra como um gasto só).
  const bia = await conta("bia-extrato@exemplo.test", "Bia Teste");
  const extrato = await prisma.importBatch.create({ data: { ...bia, docType: "extrato", fileName: "extrato-setembro.ofx", createdAt: new Date(Date.UTC(2026, 9, 10, 13)) } });
  await prisma.monthlyEntry.createMany({
    data: [
      ...lancamentos(bia, 2026, 9, [[null, "SALARIO EMPRESA X", 5480, 5]], extrato.id, "INCOME"),
      ...lancamentos(
        bia,
        2026,
        9,
        [
          ["MORADIA", "ALUGUEL", 1350, 5],
          ["MORADIA", "CONDOMINIO", 300, 6],
          ["OUTROS", "PAGAMENTO FATURA CARTAO", 1900, 10],
          ["ALIMENTACAO", "PIX SUPERMERCADO BOM PRECO", 210, 8],
          ["ALIMENTACAO", "SUPERMERCADO BOM PRECO", 190, 15],
          ["ALIMENTACAO", "PIX HORTIFRUTI", 160, 22],
          ["TRANSPORTE", "PIX POSTO SHELL", 180, 12],
          ["SAUDE", "DROGASIL", 69, 18],
          ["OUTROS", "TARIFA PACOTE SERVICOS", 39.9, 1],
          ["OUTROS", "TARIFA SAQUE", 11.1, 20],
          ["LAZER", "PIX CINEMA", 60, 27],
        ],
        extrato.id,
      ),
    ],
  });

  // Caio: só a fatura do cartão de setembro.
  const caio = await conta("caio-fatura@exemplo.test", "Caio Teste");
  const fatura = await prisma.importBatch.create({ data: { ...caio, docType: "fatura", fileName: "fatura-setembro.pdf", createdAt: new Date(Date.UTC(2026, 9, 10, 13)) } });
  const compras: Linha[] = [
    ...Array.from({ length: 6 }, (_, i): Linha => ["ALIMENTACAO", "SUPERMERCADO BOM PRECO", [120, 95, 140, 88, 110, 87][i], 3 + i * 4]),
    ...Array.from({ length: 9 }, (_, i): Linha => ["ALIMENTACAO", "IFOOD", [42, 51, 38, 47, 55, 44, 49, 40, 44][i], 2 + i * 3]),
    ...Array.from({ length: 8 }, (_, i): Linha => ["TRANSPORTE", "UBER TRIP", [22, 18, 31, 25, 19, 28, 24, 23][i], 4 + i * 3]),
    ...Array.from({ length: 3 }, (_, i): Linha => ["SAUDE", "DROGASIL", [90, 75, 95][i], 6 + i * 9]),
    ...Array.from({ length: 5 }, (_, i): Linha => ["LAZER", "SPOTIFY E CINEMA", [21.9, 48, 36, 60, 34.1][i], 5 + i * 5]),
    ...Array.from({ length: 4 }, (_, i): Linha => ["OUTROS", "SHOPEE", [39, 52, 28, 61][i], 9 + i * 5]),
    ["OUTROS", "MAGAZINE LUIZA (2/4)", 140, null],
    ["OUTROS", "CENTAURO (3/5)", 120, null],
    ["OUTROS", "AMAZON (5/6)", 160, null],
  ];
  await prisma.monthlyEntry.createMany({ data: lancamentos(caio, 2026, 9, compras, fatura.id) });

  // Duda: um gasto digitado hoje.
  const duda = await conta("duda-digitou@exemplo.test", "Duda Teste");
  await prisma.monthlyEntry.create({ data: { ...duda, year: 2026, month: 10, category: "EXPENSE", parentCategory: "ALIMENTACAO", description: "Mercado", subcategory: "Supermercado", amount: 45, entryDate: dia(2026, 10, 14) } });

  // Eva: nada ainda.
  await conta("eva-nada@exemplo.test", "Eva Teste");
  console.log("Pronto: Ana com parcelas e assinaturas; bia-extrato, caio-fatura, duda-digitou e eva-nada criadas.");
}

main().finally(() => prisma.$disconnect());
