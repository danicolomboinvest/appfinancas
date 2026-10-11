import { prisma } from "@/lib/db/prisma";
import { estadoDasNovidades, type EstadoDasNovidades } from "@/lib/novidades/passos";

/**
 * A marca do "Tivemos uma mudança" é da CONTA (User.novidadesVersaoNova), não do aparelho nem do
 * perfil: quem viu no celular não vê de novo no computador.
 */
export async function lerEstadoDasNovidades(userId: string): Promise<EstadoDasNovidades> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { novidadesVersaoNova: true } });
  return estadoDasNovidades(user?.novidadesVersaoNova);
}

/**
 * Viu até o fim ou pulou. Só grava na primeira vez: rever pela Ajuda não muda a marca. A nova
 * ("novo", que viu o "Boas-vindas ao SPI") vira "novo-visto" e não vê mais.
 */
export async function marcarNovidadesVistas(userId: string, como: "terminou" | "pulou"): Promise<void> {
  const agora = new Date();
  await prisma.user.updateMany({ where: { id: userId, novidadesVersaoNova: null }, data: { novidadesVersaoNova: como, novidadesVistasEm: agora } });
  await prisma.user.updateMany({ where: { id: userId, novidadesVersaoNova: "novo" }, data: { novidadesVersaoNova: "novo-visto", novidadesVistasEm: agora } });
}
