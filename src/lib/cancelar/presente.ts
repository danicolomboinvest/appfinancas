/**
 * Os 2 meses grátis do "Achei caro", automáticos (decisão da Dani, 11/10): o app soma 60 dias ao
 * prazo do acesso (AllowedEmail.expiresAt). Nada muda na Hubla: a cobrança continua na data dela,
 * e o presente é acesso a mais. Na renovação, o webhook soma o ano a partir do maior entre o prazo
 * atual e a data (renewedExpiry), então os 60 dias não se perdem. Puro.
 */
export const DIAS_DO_PRESENTE = 60;

/** O prazo novo: o atual (ou, sem prazo gravado, a renovação) mais 60 dias. */
export function prazoComPresente(expiresAt: Date | null, renovacao: Date, dias = DIAS_DO_PRESENTE): Date {
  const base = expiresAt && expiresAt.getTime() > renovacao.getTime() ? expiresAt : (expiresAt ?? renovacao);
  return new Date(base.getTime() + dias * 86_400_000);
}

/** Quem pode receber e-mail do fluxo: acesso ativo, não cancelou, não pediu reembolso, não venceu. */
export function podeReceberEmail(e: { active: boolean; canceladoEm: Date | null; expiresAt: Date | null } | null, agora: Date): boolean {
  if (!e || !e.active || e.canceladoEm) return false;
  return !e.expiresAt || e.expiresAt.getTime() > agora.getTime();
}
