import { prisma } from "@/lib/db/prisma";
import { EVENTO_NOVIDADES_VISTAS } from "@/lib/novidades/passos";

/**
 * A marca de "já vi o que mudou" é da CONTA, não do aparelho nem do perfil: quem viu no celular
 * não vê de novo no computador. Mora na tabela de eventos de uso (UsageEvent), que já é por
 * usuário, para não precisar de migração.
 */
export async function jaViuAsNovidades(userId: string): Promise<boolean> {
  const evento = await prisma.usageEvent.findFirst({ where: { userId, name: EVENTO_NOVIDADES_VISTAS }, select: { id: true } });
  return Boolean(evento);
}

export async function marcarNovidadesVistas(userId: string, como: "terminou" | "pulou"): Promise<void> {
  if (await jaViuAsNovidades(userId)) return;
  await prisma.usageEvent.create({ data: { userId, name: EVENTO_NOVIDADES_VISTAS, path: `/novidades/${como}` } });
}
