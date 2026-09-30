import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { PERFIL_INICIAL } from "@/lib/repositories/profile.repo";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import type { AccountContext, AuthContext } from "@/lib/auth/session";

const SALT_ROUNDS = 10;

/**
 * Das contas que o banco devolveu pra um e-mail sem olhar maiúscula, qual é a da pessoa.
 *
 * Existe porque o e-mail era gravado do jeito que foi digitado: "Maria.Silva@Gmail.com" no
 * cadastro e "maria.silva@gmail.com" no login não se achavam, e o login dizia senha errada.
 * Hoje tudo entra minúsculo, mas as contas antigas continuam com a caixa original — por isso a
 * busca ignora a caixa em vez de só minusculizar o que chega.
 *
 * O filtro final compara de novo em memória porque o "insensitive" do Prisma no Postgres pode
 * virar ILIKE, e aí "_" num e-mail ("maria_silva@") casaria com qualquer letra. Se já existirem duas contas que
 * só diferem na caixa (o bug antigo criava), vence a grafada exatamente como digitado, e depois
 * a mais antiga — que é onde estão os dados dela.
 */
export function escolherContaDoEmail<T extends { email: string }>(contas: T[], digitado: string): T | null {
  const alvo = normalizeEmail(digitado);
  const mesmas = contas.filter((c) => normalizeEmail(c.email) === alvo);
  return mesmas.find((c) => c.email === digitado.trim()) ?? mesmas[0] ?? null;
}

export async function findUserByEmail(email: string) {
  const contas = await prisma.user.findMany({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
  return escolherContaDoEmail(contas, email);
}

/**
 * Dentre os e-mails dados, quais já têm conta criada (pra não convidar quem já se cadastrou).
 * Devolve minúsculo, que é como a lista de acessos guarda: conta antiga gravada com maiúscula
 * também conta como "já tem conta".
 */
export async function findExistingUserEmails(emails: string[]): Promise<string[]> {
  if (emails.length === 0) return [];
  const procurados = new Set(emails.map(normalizeEmail));
  const users = await prisma.user.findMany({
    where: { OR: [...procurados].map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
    select: { email: true },
  });
  return [...new Set(users.map((u) => normalizeEmail(u.email)).filter((e) => procurados.has(e)))];
}

export async function createUser(input: { email: string; password: string; name: string; phone?: string }) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      email: normalizeEmail(input.email),
      passwordHash,
      name: input.name,
      phone: input.phone ?? null,
      // O perfil nasce junto, no mesmo INSERT: deixar pra primeira tela criar abria uma corrida
      // entre o layout e a página, e a conta podia nascer com dois perfis "Pessoal".
      financialProfiles: { create: { ...PERFIL_INICIAL } },
    },
  });
}

/**
 * Cria uma conta direto pelo admin (acesso de cortesia/VIP) já com a senha que a Dani escolheu
 * na hora — ela repassa a senha pra pessoa (WhatsApp, e-mail, etc.), que pode trocar depois
 * pelo fluxo normal de "esqueci minha senha".
 */
export async function createUserInvite(input: { email: string; name: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      email: normalizeEmail(input.email),
      passwordHash,
      name: input.name,
      // Quem cria é a Dani, com o e-mail que ela mesma conferiu com a pessoa: não faz sentido
      // a conta VIP esbarrar na tela de "confirme seu e-mail" no primeiro acesso.
      emailVerifiedAt: new Date(),
      // Mesmo motivo do createUser: a conta já nasce com o perfil ativo.
      financialProfiles: { create: { ...PERFIL_INICIAL } },
    },
  });
}

/**
 * `cache()` do React: dentro de UMA requisição, várias chamadas viram uma consulta só.
 *
 * Importa porque o usuário é lido em pontos independentes do mesmo render — o layout precisa
 * do tema, o formatador precisa da moeda — e sem isso cada um pagava uma ida ao banco para
 * ler a mesma linha. O escopo é a requisição, então o dado de uma pessoa nunca vaza pra outra.
 */
export const getOwnUser = cache(async (ctx: AccountContext) => {
  return prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
});

/**
 * Grava a confirmação do e-mail a partir do link. Só vale se o e-mail do link ainda é o da conta
 * (o link carrega o e-mail pra que um link antigo não confirme um endereço que a conta não tem
 * mais). Confirmar de novo não muda a data da primeira vez. Devolve se a conta existe e bate.
 */
export async function marcarEmailConfirmado(userId: string, email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user || normalizeEmail(user.email) !== normalizeEmail(email)) return false;
  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }
  return true;
}

/** A pessoa passou pela tela de boas-vindas: não volta mais lá. */
export async function markOnboarded(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
}

/** Intervalo mínimo entre atualizações de lastSeenAt, pra não escrever no banco a cada request. */
const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

/**
 * Marca que o usuário acabou de abrir o app, no máximo 1x a cada ~15min (throttle a partir do
 * lastSeenAt que já veio do getOwnUser, então sem query extra de leitura). Alimenta as métricas
 * de engajamento do relatório de admin. Best-effort: falha aqui nunca deve quebrar a página.
 */
export async function touchLastSeen(userId: string, previous: Date | null): Promise<void> {
  if (previous && Date.now() - previous.getTime() < LAST_SEEN_THROTTLE_MS) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } catch {
    /* engajamento é métrica secundária, não vale derrubar a navegação por isso */
  }
}

/** E-mail fica de fora de propósito: é a chave do acesso (allowlist), só muda via suporte. */
export async function updateOwnProfile(
  ctx: AuthContext,
  input: { name?: string; phone?: string | null },
) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

/** Sem theme, só a moeda muda: o Prisma ignora campo undefined. */
export async function updateOwnPreferences(ctx: AuthContext, input: { currency: string; theme?: string }) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

export async function updateOwnNotificationPrefs(
  ctx: AuthContext,
  input: { notifyBudgetAlerts: boolean; notifyLateGoals: boolean; notifyMonthlyRecap: boolean },
) {
  return prisma.user.update({ where: { id: ctx.userId }, data: input });
}

export async function getRecapDismissedMonth(ctx: AuthContext): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { recapDismissedMonth: true } });
  return user?.recapDismissedMonth ?? null;
}

/** Fecha o Resumo Mensal daquele mês (ex.: "2026-07"): não aparece de novo até o mês seguinte. */
export async function dismissRecapMonth(ctx: AuthContext, monthKey: string): Promise<void> {
  await prisma.user.update({ where: { id: ctx.userId }, data: { recapDismissedMonth: monthKey } });
}
