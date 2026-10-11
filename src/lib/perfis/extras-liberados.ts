import { prisma } from "@/lib/db/prisma";

/**
 * Se a conta já tem os extras (Nós dois e Empresa). A regra é a do branch de cobrança
 * (lib/adicionais/acesso.ts, `temAdicional`): antes da data em ADICIONAIS_COBRAR_DESDE todo mundo
 * tem; depois, tem quem já era cliente antes dela ou quem pagou. Quando aquele branch entrar,
 * trocar este corpo por `temAdicional(userId, "conta_parceiro")` e `temAdicional(userId,
 * "perfil_empresa")`; a tela não muda.
 *
 * Aqui só a parte que não depende do pagamento (que mora lá): antes do lançamento e conta antiga.
 */
export async function extrasLiberados(userId: string, agora: Date = new Date()): Promise<{ casal: boolean; empresa: boolean }> {
  const desde = inicioDaCobranca();
  if (!desde || agora < desde) return { casal: true, empresa: true };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, role: true } });
  const antiga = !!u && (u.role === "ADMIN" || u.createdAt < desde);
  return { casal: antiga, empresa: antiga };
}

function inicioDaCobranca(valor: string | undefined = process.env.ADICIONAIS_COBRAR_DESDE): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor.trim())) return null;
  const d = new Date(`${valor.trim().slice(0, 10)}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
