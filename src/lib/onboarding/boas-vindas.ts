/**
 * Quem recebe qual e-mail de boas-vindas, e quando. Puro e testado: o envio mora no cron
 * (src/app/api/cron/boas-vindas) e na página de confirmação do e-mail.
 *
 * Regras (aprovadas pela Dani em 30/09/2026):
 *  - Comprou e não criou a conta: lembrete no 1º dia e no 4º dia depois da liberação.
 *  - Criou a conta: boas-vindas quando confirma o e-mail; no 2º e no 5º dia depois disso, um
 *    empurrão SÓ se a conta continua sem nenhum lançamento. Quem lançou sai da trilha na hora.
 *  - Um e-mail por pessoa por rodada. Se uma rodada falhar, a seguinte manda o que está devido,
 *    nunca os dois de uma vez (quem perdeu o do 1º dia e já está no 4º recebe só o do 4º).
 *
 * Só vale para quem entrou DEPOIS de BOAS_VINDAS_DESDE. A base que já existia não recebe
 * sozinha: mandar pra ela é decisão da Dani, feita à parte (ver `atrasados` no cron).
 */

const DIA_MS = 86_400_000;

/**
 * Início das boas-vindas automáticas: o horário do deploy (UTC). Liberações e confirmações
 * anteriores não entram na trilha.
 */
export const BOAS_VINDAS_DESDE = new Date("2026-09-30T20:00:00Z");

/** Passou disso sem ação, a trilha acabou: e-mail de "comece" pra quem sumiu há semanas é spam. */
export const PRAZO_SEM_CONTA_DIAS = 10;
export const PRAZO_COM_CONTA_DIAS = 12;

/** Chaves no NotificationLog (uma por pessoa por e-mail, @@unique([userId, key])). */
export const CHAVE_BOAS_VINDAS = "boas-vindas";
export const CHAVE_VAZIO_DIA2 = "boas-vindas-vazio-dia2";
export const CHAVE_VAZIO_DIA5 = "boas-vindas-vazio-dia5";

export type EtapaSemConta = "conta-dia1" | "conta-dia4";
export type EtapaComConta = typeof CHAVE_BOAS_VINDAS | typeof CHAVE_VAZIO_DIA2 | typeof CHAVE_VAZIO_DIA5;

/** Qual lembrete de "crie sua conta" está devido agora, ou null. */
export function etapaSemConta(
  p: { liberadoEm: Date; lembrete1Em: Date | null; lembrete2Em: Date | null },
  agora: Date,
): EtapaSemConta | null {
  const dias = (agora.getTime() - p.liberadoEm.getTime()) / DIA_MS;
  if (dias < 1 || dias > PRAZO_SEM_CONTA_DIAS) return null;
  if (dias >= 4) return p.lembrete2Em ? null : "conta-dia4";
  return p.lembrete1Em ? null : "conta-dia1";
}

/** Qual e-mail da trilha "criou a conta" está devido agora, ou null. */
export function etapaComConta(
  p: { confirmadoEm: Date; enviados: ReadonlySet<string>; temLancamento: boolean },
  agora: Date,
): EtapaComConta | null {
  if (p.temLancamento) return null;
  const dias = (agora.getTime() - p.confirmadoEm.getTime()) / DIA_MS;
  if (dias < 0 || dias > PRAZO_COM_CONTA_DIAS) return null;
  if (dias >= 5) return p.enviados.has(CHAVE_VAZIO_DIA5) ? null : CHAVE_VAZIO_DIA5;
  if (dias >= 2) return p.enviados.has(CHAVE_VAZIO_DIA2) ? null : CHAVE_VAZIO_DIA2;
  return p.enviados.has(CHAVE_BOAS_VINDAS) ? null : CHAVE_BOAS_VINDAS;
}

/** O e-mail como ele deve ser comparado: sem maiúscula e sem espaço nas pontas. */
export function chaveDeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Quem, dos liberados, ainda não tem conta. A comparação ignora maiúscula e espaço: em 30/09/2026
 * havia 5 contas antigas gravadas com letra maiúscula, e 3 delas caíam como "sem conta" numa
 * comparação exata, o que mandaria "crie a sua conta" para quem já tem.
 */
export function liberadosSemConta<T extends { email: string }>(liberados: readonly T[], emailsDeContas: Iterable<string>): T[] {
  const temConta = new Set<string>();
  for (const e of emailsDeContas) temConta.add(chaveDeEmail(e));
  return liberados.filter((l) => !temConta.has(chaveDeEmail(l.email)));
}
