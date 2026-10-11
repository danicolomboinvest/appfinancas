/**
 * Troca o tema e o modo da conta de teste no BANCO LOCAL (para as fotos das telas).
 * Uso: npx tsx scripts/definir-tema-local.ts <tema> <light|dark>
 */
import { PrismaClient } from "@prisma/client";

const host = (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error("Recusei: só no banco local.");
  process.exit(1);
}
const prisma = new PrismaClient();
const [tema, modo] = process.argv.slice(2);
(async () => {
  const user = await prisma.user.update({ where: { email: "ana@exemplo.test" }, data: { theme: modo === "dark" ? "dark" : "light" } });
  await prisma.financialProfile.updateMany({ where: { userId: user.id, isDefault: true }, data: { theme: tema } });
  await prisma.$disconnect();
})();
