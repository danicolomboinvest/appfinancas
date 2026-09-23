/**
 * Enche o perfil "Empresa" da CONTA DE TESTE (rodada2@example.com) com seis meses de
 * movimento de uma pequena empresa fictícia, pra dar pra ver a DRE, o ponto de equilíbrio e
 * o caixa de segurança funcionando antes de qualquer cliente real usar.
 *
 * Só toca no perfil Empresa dessa conta. Idempotente: apaga o que ele mesmo semeou antes
 * (descrição começa com "[teste]") e semeia de novo.
 *
 * Rodar com: npx tsx scripts/semear-empresa-teste.ts
 */
import { prisma } from "@/lib/db/prisma";
import type { ParentCategory, Prisma } from "@prisma/client";

const EMAIL = "rodada2@example.com";
const MARCA = "[teste] ";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) throw new Error(`Conta ${EMAIL} não existe.`);
  const perfil = await prisma.financialProfile.findFirst({ where: { userId: user.id, kind: "EMPRESA" }, orderBy: { createdAt: "asc" } });
  if (!perfil) throw new Error("A conta de teste não tem perfil Empresa.");
  const dono = { userId: user.id, profileId: perfil.id };

  const apagados = await prisma.monthlyEntry.deleteMany({ where: { ...dono, description: { startsWith: MARCA } } });
  await prisma.asset.deleteMany({ where: { ...dono, notes: MARCA.trim() } });
  console.log(`Perfil ${perfil.name}: ${apagados.count} lançamentos antigos apagados.`);

  const hoje = new Date();
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, ultimo: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
  });

  // Uma loja de roupas pequena, no Simples: fatura entre 28 e 40 mil, margem apertada.
  const faturamento = [28500, 31200, 27800, 35600, 33900, 36400];
  const data = (m: (typeof meses)[number], dia: number) => new Date(Date.UTC(m.year, m.month - 1, Math.min(dia, m.ultimo)));
  const linhas: Prisma.MonthlyEntryCreateManyInput[] = [];

  meses.forEach((m, i) => {
    const fat = faturamento[i];
    const mesAberto = i === meses.length - 1;
    // O mês aberto tem só os primeiros dias lançados.
    const fator = mesAberto ? Math.min(1, hoje.getDate() / m.ultimo) : 1;
    const v = (x: number) => Math.round(x * fator * 100) / 100;
    const push = (category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION", parentCategory: string | null, subcategory: string, description: string, amount: number, dia: number) => {
      if (amount <= 0) return;
      linhas.push({ ...dono, year: m.year, month: m.month, category, parentCategory: parentCategory as ParentCategory | null, subcategory, description: MARCA + description, amount, entryDate: data(m, dia) });
    };
    // Receitas: vendas na loja, vendas online e um serviço de ajuste.
    push("INCOME", null, "Vendas", "Vendas da loja (maquininha)", v(fat * 0.62), 5);
    push("INCOME", null, "Vendas", "Vendas online (marketplace)", v(fat * 0.3), 15);
    push("INCOME", null, "Serviços", "Ajustes e consertos", v(fat * 0.08), 20);
    // Impostos: DAS do Simples (~6% no anexo I) e taxas.
    push("EXPENSE", "IMPOSTOS", "DAS (Simples Nacional)", "DAS do mês", v(fat * 0.06), 20);
    push("EXPENSE", "IMPOSTOS", "Taxas bancárias", "Tarifa da conta PJ", v(89), 10);
    // Custos variáveis: mercadorias (o grosso), taxa de cartão, frete, anúncios.
    push("EXPENSE", "ALIMENTACAO", "Mercadorias pra revenda", "Reposição de estoque", v(fat * 0.34), 8);
    push("EXPENSE", "ALIMENTACAO", "Embalagens", "Sacolas e caixas", v(fat * 0.01), 12);
    push("EXPENSE", "EDUCACAO", "Taxas de cartão/maquininha", "Taxa da maquininha", v(fat * 0.62 * 0.03), 28);
    push("EXPENSE", "EDUCACAO", "Marketplace", "Comissão do marketplace", v(fat * 0.3 * 0.14), 28);
    push("EXPENSE", "EDUCACAO", "Anúncios", "Impulsionamento no Instagram", v(600), 3);
    push("EXPENSE", "TRANSPORTE", "Frete", "Frete das vendas online", v(fat * 0.3 * 0.06), 22);
    push("EXPENSE", "TRANSPORTE", "Motoboy/Aplicativo", "Entregas na cidade", v(240), 18);
    // Despesas fixas: aluguel, contas, equipe, pró-labore, contador, sistema.
    push("EXPENSE", "MORADIA", "Aluguel", "Aluguel da loja", v(3200), 5);
    push("EXPENSE", "MORADIA", "Luz", "Conta de luz", v(410), 12);
    push("EXPENSE", "MORADIA", "Internet/Telefone", "Internet e telefone", v(150), 12);
    push("EXPENSE", "MORADIA", "Software e assinaturas", "Sistema de vendas (PDV)", v(189), 1);
    push("EXPENSE", "SAUDE", "Salários", "Salário da vendedora", v(2400), 5);
    push("EXPENSE", "SAUDE", "Encargos/INSS", "FGTS e INSS da vendedora", v(770), 7);
    push("EXPENSE", "SAUDE", "Pró-labore", "Pró-labore da dona", v(4500), 5);
    push("EXPENSE", "LAZER", "Contador", "Honorários do contador", v(450), 10);
    push("EXPENSE", "LAZER", "Design", "Fotos dos produtos", v(i % 2 === 0 ? 350 : 0), 14);
    push("EXPENSE", "OUTROS", "Seguros", "Seguro da loja", v(180), 15);
    // Retenção: reserva de caixa todo mês, reinvestimento quando sobra.
    push("INVESTMENT_CONTRIBUTION", null, "Reserva de caixa", "Reserva de caixa do mês", v(1500), 25);
    if (fat > 33000) push("INVESTMENT_CONTRIBUTION", null, "Reinvestimento", "Novo expositor pra loja", v(1200), 26);
  });

  await prisma.monthlyEntry.createMany({ data: linhas });
  await prisma.asset.create({
    data: {
      ...dono,
      name: "CDB liquidez diária (caixa da loja)",
      assetClass: "RENDA_FIXA",
      objective: "RESERVA_EMERGENCIA",
      currentValue: 27400,
      investedValue: 26100,
      notes: MARCA.trim(),
    },
  });
  console.log(`${linhas.length} lançamentos semeados em ${meses.length} meses, mais o caixa da loja.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
