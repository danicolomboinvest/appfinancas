import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const url = process.env.DATABASE_URL ?? "";
if (!url.includes("localhost:54329/qa_areas")) { console.error("só banco local qa_areas"); process.exit(1); }
const prisma = new PrismaClient();
const SENHA = "senha-de-teste-local";
async function nova(email: string, nome: string) {
  const a = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (a) { await prisma.financialProfile.deleteMany({ where: { userId: a.id } }); await prisma.decisao.deleteMany({ where: { userId: a.id } }); await prisma.user.delete({ where: { id: a.id } }); }
  await prisma.allowedEmail.upsert({ where: { email }, update: { active: true }, create: { email, note: "qa local", source: "HUBLA" } });
  const u = await prisma.user.create({ data: { email, name: nome, passwordHash: await bcrypt.hash(SENHA, 10), emailVerifiedAt: new Date(), onboardedAt: new Date(), theme: "light", novidadesVersaoNova: "pulou", novidadesVistasEm: new Date() } });
  await prisma.financialProfile.create({ data: { userId: u.id, name: "Pessoal", kind: "PESSOAL", theme: "padrao", isDefault: true } });
  return u;
}
async function main() {
  for (const a of ["metas", "carteira", "calc", "decidir", "reset"]) await nova(`nova-${a}@exemplo.test`, "Bia Nova");
  for (const e of ["ana-reset@exemplo.test", "nova-reset@exemplo.test", "antiga-reset@exemplo.test"]) {
    await prisma.produtoLiberado.upsert({ where: { email_produto: { email: e, produto: "money_reset" } }, update: { ativo: true }, create: { email: e, produto: "money_reset", origem: "manual" } });
  }
  const antiga = await prisma.user.findUnique({ where: { email: "antiga-reset@exemplo.test" }, include: { financialProfiles: true } });
  if (antiga) {
    const dono = { userId: antiga.id, profileId: antiga.financialProfiles.find((p) => p.isDefault)?.id ?? antiga.financialProfiles[0].id };
    await prisma.decisao.deleteMany({ where: { userId: antiga.id, tipo: { startsWith: "reset" } } });
    const base = Date.now() - 9 * 86400000;
    await prisma.decisao.create({ data: { ...dono, tipo: "reset_inicio", chave: "reset|inicio", createdAt: new Date(base) } });
    for (const d of [1, 2, 3, 4, 5, 6]) await prisma.decisao.create({ data: { ...dono, tipo: "reset_dia", chave: `reset|dia|${d}`, createdAt: new Date(base + d * 86400000) } });
    await prisma.decisao.create({ data: { ...dono, tipo: "reset_resposta", chave: "reset|motivo", descricao: "Quero parar de chegar no fim do mês sem nada" } });
  }
  console.log("ok");
}
main().finally(() => prisma.$disconnect());
