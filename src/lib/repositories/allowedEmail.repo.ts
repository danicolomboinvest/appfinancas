import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { emailConfirmado } from "@/lib/auth/confirmacao-email";

/**
 * Lista de e-mails com acesso PREMIUM (área de investimentos: Carteira, Simuladores, Análises,
 * Aposentadoria — o conteúdo do curso). Desde a mudança pro modelo freemium, isso NÃO controla
 * mais quem consegue criar conta/logar — qualquer um cadastra e usa a parte de finanças pessoais
 * de graça; essa lista só decide o que aparece nas telas trancadas (ver hasPremiumAccess). A
 * liberação vem de dois lugares:
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
 * "acesso até 30/08" continua valendo o dia inteiro de 30/08).
 *
 * `now` é o instante REAL (new Date()), não o relógio de Brasília: a conversão pro Brasil
 * acontece aqui dentro. O padrão era nowInBrazil(), convertido de novo abaixo — no servidor UTC
 * "hoje" ficava 3h atrás de Brasília, e entre 00h e 03h quem venceu ontem ainda entrava. */
export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
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

/** Acesso premium (área de investimentos) de um usuário já logado. ADMIN sempre tem — mesma
 * exceção do login, a Dani não pode ficar trancada fora do próprio painel.
 *
 * O e-mail precisa estar confirmado: a liberação é pelo e-mail, e sem isso quem se cadastrasse
 * com o e-mail de uma compradora (antes dela) levava a área paga dela. */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, emailVerifiedAt: true, createdAt: true },
  });
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!emailConfirmado(user)) return false;
  return isEmailAllowed(user.email);
}

export async function listAllowedEmails() {
  return prisma.allowedEmail.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Prazo que fica numa linha que JÁ existia quando a Dani cola a lista de novo. `undefined` =
 * não mexe.
 *
 * O campo "Acesso até" vem sempre preenchido com +1 ano, então aplicar o prazo às cegas
 * encurtava em silêncio quem já tinha mais: a VIP sem prazo ganhava vencimento e quem tinha
 * até 2028 caía pra daqui a um ano. Regra: quem está com acesso valendo nunca sai perdendo —
 * fica com o melhor entre o que tinha e o novo (sem prazo é o melhor de todos). Quem estava
 * desativado ou vencido recomeça com o prazo informado agora, e aí campo vazio (null) libera
 * sem prazo, como o formulário promete.
 */
export function prazoAoLiberarDeNovo(
  atual: { active: boolean; expiresAt: Date | null },
  novo: Date | null | undefined,
  // Instante real: isExpired já converte pro dia de Brasília (nowInBrazil aqui converteria duas vezes).
  now: Date = new Date(),
): Date | null | undefined {
  if (novo === undefined) return undefined;
  const valendo = atual.active && !isExpired(atual.expiresAt, now);
  if (!valendo) return novo;
  if (atual.expiresAt === null) return undefined;
  if (novo === null || novo > atual.expiresAt) return novo;
  return undefined;
}

/**
 * Adiciona vários e-mails de uma vez (a Dani cola a lista de compradores). Ignora duplicados
 * e reativa quem já existia mas estava inativo. Além do total, devolve quem entrou AGORA
 * (novo ou reativado) — é só essa turma que deve receber o e-mail de "acesso liberado";
 * quem já estava ativo na lista já foi avisado antes — e quantos já tinham um acesso mais
 * longo e ficaram com ele (ver prazoAoLiberarDeNovo), pra isso não passar despercebido.
 */
export async function addAllowedEmails(
  emails: string[],
  note?: string,
  /** Data-limite do acesso (ex.: liberação por 1 ano). Nulo = sem prazo; undefined = não mexe
   * no prazo de quem já existia (quem é criado agora fica sem prazo). */
  expiresAt?: Date | null,
): Promise<{ affected: number; toNotify: string[]; keptLonger: number }> {
  const unique = [...new Set(emails.map(normalizeEmail).filter((e) => e.includes("@")))];
  if (unique.length === 0) return { affected: 0, toNotify: [], keptLonger: 0 };

  const existing = new Map(
    (
      await prisma.allowedEmail.findMany({
        where: { email: { in: unique } },
        select: { email: true, active: true, expiresAt: true },
      })
    ).map((e) => [e.email, e]),
  );

  let keptLonger = 0;
  for (const email of unique) {
    const atual = existing.get(email);
    const prazo = atual ? prazoAoLiberarDeNovo(atual, expiresAt) : expiresAt;
    if (atual && expiresAt !== undefined && prazo === undefined) keptLonger++;
    await prisma.allowedEmail.upsert({
      where: { email },
      // Colar de novo a lista deve reativar quem foi desativado, sem apagar a origem/nota.
      update: { active: true, ...(note ? { note } : {}), ...(prazo !== undefined ? { expiresAt: prazo } : {}) },
      create: { email, source: "MANUAL", note: note ?? null, expiresAt: expiresAt ?? null },
    });
  }
  return {
    affected: unique.length,
    // Vencido também conta como "entrou agora": pra ela o acesso estava fechado.
    toNotify: unique.filter((e) => {
      const atual = existing.get(e);
      return !atual || !atual.active || isExpired(atual.expiresAt);
    }),
    keptLonger,
  };
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
/** Duração padrão do acesso: a assinatura do app é anual. */
export const ACCESS_YEARS = 1;

/** Mesma data, um ano à frente. 29/02 vira 28/02 no ano seguinte (setFullYear sozinho viraria
 * 01/03, empurrando a renovação pro mês errado).
 *
 * A data é a do calendário de Brasília (regra da Hubla, e é o dia que isExpired olha). Lendo no
 * fuso do servidor (UTC na Vercel), a compra às 22h de 28/02/2028 em Brasília já era 29/02 e
 * vencia em 27/02/2029 — a cliente perdia um dia. Brasília não tem horário de verão desde 2019,
 * então somar os dias de calendário ao instante mantém também a hora de Brasília. */
export function addAccessPeriod(from: Date, years = ACCESS_YEARS): Date {
  const b = nowInBrazil(from);
  const ano = b.getFullYear() + years;
  const mes = b.getMonth();
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(b.getDate(), ultimoDiaDoMes);
  const diasSomados = Date.UTC(ano, mes, dia) - Date.UTC(b.getFullYear(), mes, b.getDate());
  return new Date(from.getTime() + diasSomados);
}

/**
 * Nova data-limite de uma renovação: soma um ano a partir do que for MAIS TARDE entre hoje e o
 * vencimento atual. Quem renova antes de vencer não perde os dias que já pagou; quem renova
 * depois de vencido recomeça a contar de hoje (não ganha retroativo que não usou).
 */
export function renewedExpiry(currentExpiry: Date | null, now: Date = new Date()): Date {
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return addAccessPeriod(base);
}

/**
 * Marca em lastHublaInvoiceId de "este período foi dado por um evento SEM fatura". O Hubla manda
 * customer.member_added (sem invoice) e invoice.payment_succeeded (com invoice) pra mesma compra,
 * em qualquer ordem. Se o member_added chegava antes, ele dava o ano e deixava a fatura nula; o
 * payment_succeeded via uma fatura "nova" e somava outro ano — a primeira compra saía com 2 anos.
 * Com a marca, a primeira fatura que chega depois só é registrada, sem estender de novo.
 */
export const FATURA_PENDENTE = "pendente";

/** Até quantos dias depois de um período sem fatura a próxima fatura ainda é "a dele". Passado
 * isso, a fatura que chega é renovação de verdade e estende normalmente. */
const JANELA_DA_FATURA_PENDENTE_DIAS = 30;

/**
 * O que um evento de liberação do Hubla faz com o prazo. Sem banco, pra dar pra testar cada
 * ordem de chegada dos eventos.
 * - `extended`: se o evento deu (ou somou) um período pago.
 * - `lastHublaInvoiceId`: o que gravar na trava de fatura (undefined = não mexe).
 */
export function decidirPrazoHubla(
  existing: { active: boolean; expiresAt: Date | null; lastHublaInvoiceId: string | null } | null,
  invoiceId: string | null | undefined,
  now: Date = new Date(),
): { extended: boolean; expiresAt: Date | null; lastHublaInvoiceId: string | undefined } {
  const fatura = invoiceId || null;
  // Primeira liberação: um ano. Sem fatura, fica a marca de que a fatura desse ano ainda vem.
  if (!existing) {
    return { extended: true, expiresAt: addAccessPeriod(now), lastHublaInvoiceId: fatura ?? FATURA_PENDENTE };
  }
  const semMudanca = { extended: false, expiresAt: existing.expiresAt, lastHublaInvoiceId: fatura ?? undefined };

  // Fatura já processada = reenvio/evento irmão da mesma compra: não estende de novo.
  if (fatura && existing.lastHublaInvoiceId === fatura) return semMudanca;
  // Acesso sem prazo e valendo (VIP da Dani): nenhum evento de compra encurta pra um ano.
  if (existing.active && existing.expiresAt === null) return semMudanca;

  if (fatura) {
    // A fatura do período que um evento sem fatura acabou de dar: só registra.
    if (existing.lastHublaInvoiceId === FATURA_PENDENTE && existing.expiresAt) {
      const limite = addAccessPeriod(new Date(now.getTime() - JANELA_DA_FATURA_PENDENTE_DIAS * 24 * 60 * 60 * 1000));
      if (existing.expiresAt >= limite) return semMudanca;
    }
    return { extended: true, expiresAt: renewedExpiry(existing.expiresAt, now), lastHublaInvoiceId: fatura };
  }
  // Sem id de fatura no payload, o único movimento seguro é dar prazo a quem não tem nenhum —
  // estender às cegas abriria a porta pro acesso infinito por reenvio.
  if (!existing.expiresAt) {
    return { extended: true, expiresAt: renewedExpiry(null, now), lastHublaInvoiceId: FATURA_PENDENTE };
  }
  return semMudanca;
}

export async function grantFromHubla(
  email: string,
  note?: string,
  phone?: string | null,
  /** Id da fatura do Hubla. É a trava anti-duplicata: o Hubla manda mais de um evento pra
   * mesma compra (member_added + payment_succeeded) e ainda reenvia em caso de falha — sem
   * isso, cada reenvio esticaria o acesso em mais um ano de graça. */
  invoiceId?: string | null,
): Promise<{ isNew: boolean; expiresAt: Date | null; extended: boolean }> {
  const normalized = normalizeEmail(email);
  const existing = await prisma.allowedEmail.findUnique({
    where: { email: normalized },
    select: { active: true, expiresAt: true, lastHublaInvoiceId: true },
  });

  const decisao = decidirPrazoHubla(existing, invoiceId);

  await prisma.allowedEmail.upsert({
    where: { email: normalized },
    // Celular da compra: grava se veio; nunca apaga um que já estava salvo.
    update: {
      active: true,
      ...(phone ? { phone } : {}),
      ...(decisao.extended ? { expiresAt: decisao.expiresAt } : {}),
      ...(decisao.lastHublaInvoiceId !== undefined ? { lastHublaInvoiceId: decisao.lastHublaInvoiceId } : {}),
    },
    create: {
      email: normalized,
      source: "HUBLA",
      note: note ?? null,
      phone: phone ?? null,
      expiresAt: decisao.expiresAt,
      lastHublaInvoiceId: decisao.lastHublaInvoiceId ?? null,
    },
  });
  return { isNew: existing?.active !== true, expiresAt: decisao.expiresAt, extended: decisao.extended };
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
 *
 * Liberação MANUAL não cai: é a Dani quem decidiu (VIP, cortesia, compra fora do Hubla), e o
 * reembolso de um item no Hubla não pode levar junto um acesso que não veio dele. Ela corta na
 * mão pelo painel se quiser.
 */
export async function revokeFromHubla(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.allowedEmail.updateMany({
    // Liberação MANUAL fica, a não ser que o Hubla tenha estendido o prazo dela (a pessoa comprou
    // em cima de um acesso dado na mão): aí o ano reembolsado sai junto.
    where: { email: normalized, OR: [{ source: "HUBLA" }, { lastHublaInvoiceId: { not: null } }] },
    data: { active: false },
  });
}
