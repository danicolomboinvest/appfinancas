/**
 * O lead da assessoria para o CRM da Fatos Capital (seção 9 do plano): PREPARADO E DESLIGADO.
 *
 * Só vale para quem está na faixa (R$ 50 mil ou mais na Carteira, ou R$ 5 mil por mês de aporte),
 * e o formulário com o consentimento (LGPD) ainda não existe no app. Enquanto isso, nada sai
 * daqui. Para ligar, os três juntos: a variável CRM_API_KEY (só no servidor, nunca no navegador),
 * CRM_LEADS_LIGADO=1 e o formulário com o consentimento gravado.
 *
 * Integração (quando ligar): POST https://crm.fatoscapital.com.br/api/v1/leads com o header
 * X-API-Key e o corpo { nome, whatsapp, email, patrimonio, source: "SPI Finance", fields }.
 */
export type LeadDaAssessoria = {
  nome: string;
  whatsapp: string;
  email: string;
  /** A faixa calculada pelo app, nunca perguntada. */
  patrimonio: string;
  horario: string;
  canal: string;
  origemNoApp: "acompanhamento" | "desvio" | "estrategia" | "ajuda";
  /** Quando ela marcou o consentimento. Sem isso, não envia. */
  consentimentoEm: Date | null;
};

export function crmLigado(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CRM_LEADS_LIGADO === "1" && Boolean(env.CRM_API_KEY);
}

export async function enviarLeadDaAssessoria(lead: LeadDaAssessoria): Promise<{ enviado: false; motivo: "desligado" | "sem_consentimento" }> {
  if (!lead.consentimentoEm) return { enviado: false, motivo: "sem_consentimento" };
  // Desligado de propósito nesta versão: nenhuma chamada ao CRM real.
  return { enviado: false, motivo: "desligado" };
}
