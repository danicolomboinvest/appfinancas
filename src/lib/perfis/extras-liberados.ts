import { temAdicional } from "@/lib/adicionais/acesso";

/**
 * Se a conta já tem os extras (Nós dois e Empresa). A regra é a da cobrança
 * (lib/adicionais/acesso.ts, `temAdicional`): antes da data em ADICIONAIS_COBRAR_DESDE todo mundo
 * tem; depois, tem a Dani (ADMIN), quem já era cliente antes dela e quem pagou (Hubla, Apple ou
 * liberação na mão).
 *
 * O Nós dois é 100% pago (decisão da Dani, 11/10): o perfil Casal e o login do par saem juntos do
 * mesmo adicional, a "conta_parceiro" (R$ 27 por ano), o mesmo produto da Hubla e da Apple.
 */
export async function extrasLiberados(userId: string, agora: Date = new Date()): Promise<{ casal: boolean; empresa: boolean }> {
  const [casal, empresa] = await Promise.all([temAdicional(userId, "conta_parceiro", agora), temAdicional(userId, "perfil_empresa", agora)]);
  return { casal, empresa };
}
