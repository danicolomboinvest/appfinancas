import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * Lista de e-mails autorizados a usar o app (acesso fechado: só compradores do curso /
 * assinantes). A liberação vem de dois lugares:
 *  - MANUAL: a Dani adiciona no painel /admin/acessos (cola a lista de compradores).
 *  - HUBLA: o webhook libera/revoga sozinho conforme a compra ou assinatura.
 *
 * O e-mail é sempre normalizado (minúsculo, sem espaços) para casar com o e-mail do login,
 * que também é comparado assim. Sem isso, "Maria@x.com " no Hubla nunca casaria com
 * "maria@x.com" digitado no cadastro.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Vencido = tinha prazo e a data-limite já passou (comparando só o dia, no fuso do Brasil —
 * "acesso até 30/08" continua valendo o dia inteiro de 30/08). */
export function isExpired(expiresAt: Date | null, now: Date = nowInBrazil()): boolean {
  if (!expiresAt) return false;
  const limit = nowInBrazil(expiresAt);
  const today = nowInBrazil(now);
  return limit.getFullYear() < today.getFullYear() ||
    (limit.getFullYear() === today.getFullYear() &&
      (limit.getMonth() < today.getMonth() ||
        (limit.getMonth() === today.getMonth() && limit.getDate() < today.getDate())));
}

/** Um e-mail só tem acesso se está na lista, está ativo, E (se tiver prazo) ainda não venceu. */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const entry = await prisma.allowedEmail.findUnique({
    where: { email: normalizeEmail(email) },
    select: { active: true, expiresAt: true },
  });
  if (entry?.active !== true) return false;
  return !isExpired(entry.expiresAt);
}

export async function listAllowedEmails() {
  return prisma.allowedEmail.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Adiciona vários e-mails de uma vez (a Dani cola a lista de compradores). Ignora duplicados
 * e reativa quem já existia mas estava inativo. Além do total, devolve quem entrou AGORA
 * (novo ou reativado) — é só essa turma que deve receber o e-mail de "acesso liberado";
 * quem já estava ativo na lista já foi avisado antes.
 */
export async function addAllowedEmails(
  emails: string[],
  note?: string,
  /** Data-limite do acesso (ex.: liberação por 1 ano). Nulo = sem prazo (padrão); undefined =
   * não mexe no prazo de quem já existia (só se aplica a quem é criado agora). */
  expiresAt?: Date | null,
): Promise<{ affected: number; toNotify: string[] }> {
  const unique = [...new Set(emails.map(normalizeEmail).filter((e) => e.includes("@")))];
  if (unique.length === 0) return { affected: 0, toNotify: [] };

  const alreadyActive = new Set(
    (
      await prisma.allowedEmail.findMany({
        where: { email: { in: unique }, active: true },
        select: { email: true },
      })
    ).map((e) => e.email),
  );

  for (const email of unique) {
    await prisma.allowedEmail.upsert({
      where: { email },
      // Colar de novo a lista deve reativar quem foi desativado, sem apagar a origem/nota;
      // o prazo só é atualizado se foi informado agora (não apaga um prazo já definido antes).
      update: { active: true, ...(note ? { note } : {}), ...(expiresAt !== undefined ? { expiresAt } : {}) },
      create: { email, source: "MANUAL", note: note ?? null, expiresAt: expiresAt ?? null },
    });
  }
  return { affected: unique.length, toNotify: unique.filter((e) => !alreadyActive.has(e)) };
}

/** Renovação: a Dani volta na linha de alguém e estende (ou remove, passando null) o prazo. */
export async function setAllowedEmailExpiry(id: string, expiresAt: Date | null) {
  return prisma.allowedEmail.update({ where: { id }, data: { expiresAt } });
}

export async function setAllowedEmailActive(id: string, active: boolean) {
  return prisma.allowedEmail.update({ where: { id }, data: { active } });
}

export async function removeAllowedEmail(id: string) {
  return prisma.allowedEmail.delete({ where: { id } });
}

/**
 * Libera um e-mail a partir do webhook do Hubla (compra aprovada / acesso concedido).
 * Cria como HUBLA se ainda não existe; se já existe (inclusive liberação manual), garante
 * que fique ativo sem sobrescrever a origem manual. `isNew` diz se a liberação aconteceu
 * AGORA (não existia, ou estava inativa) — o Hubla manda mais de um evento pra mesma compra
 * (member_added + payment_succeeded), e só o primeiro deve disparar o e-mail de convite.
 */
export async function grantFromHubla(
  email: string,
  note?: string,
  phone?: string | null,
): Promise<{ isNew: boolean }> {
  const normalized = normalizeEmail(email);
  const existing = await prisma.allowedEmail.findUnique({
    where: { email: normalized },
    select: { active: true },
  });
  await prisma.allowedEmail.upsert({
    where: { email: normalized },
    // Celular da compra: grava se veio; nunca apaga um que já estava salvo.
    update: { active: true, ...(phone ? { phone } : {}) },
    create: { email: normalized, source: "HUBLA", note: note ?? null, phone: phone ?? null },
  });
  return { isNew: existing?.active !== true };
}

/** Celular que veio da compra no Hubla (se veio) — usado como reserva no cadastro. */
export async function getAllowedPhone(email: string): Promise<string | null> {
  const row = await prisma.allowedEmail.findUnique({
    where: { email: normalizeEmail(email) },
    select: { phone: true },
  });
  return row?.phone ?? null;
}

/**
 * Revoga o acesso a partir do webhook do Hubla (reembolso / assinatura cancelada / acesso
 * removido). Não apaga o registro (mantém histórico) — só desativa. Se o e-mail nem estava
 * na lista, não faz nada.
 */
export async function revokeFromHubla(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.allowedEmail.updateMany({
    where: { email: normalized },
    data: { active: false },
  });
}
