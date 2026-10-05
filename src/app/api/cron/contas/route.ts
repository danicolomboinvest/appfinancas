import { NextResponse } from "next/server";
import { CONFIRMACAO_DESDE } from "@/lib/auth/confirmacao-email";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { prisma } from "@/lib/db/prisma";
import { hojeEmBrasilia, lembretesDeHoje } from "@/lib/contas/contas";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { contasEmail } from "@/lib/email/templates";
import { makeMoneyFormatter, toCurrencyCode } from "@/lib/money";
import { vozDoTema } from "@/lib/profiles/voice";
import { contasQueUsamOApp, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";

export const maxDuration = 60;

const DIA_MS = 86_400_000;

/**
 * Lembrete das contas a pagar, uma vez por dia às 8h de Brasília (vercel.json): a conta que vence
 * amanhã e a que vence hoje, das que ela marcou "Me lembrar". Cada lembrete tem chave com o
 * vencimento e sai uma vez só (NotificationLog). Vai pro celular de quem ligou as notificações;
 * quem não ligou (o app de iPhone e Android não recebe push) ganha um e-mail com todas as do dia.
 *
 * `?dryRun=1` mostra o que sairia sem mandar nada; `?onlyEmail=` restringe a uma pessoa.
 */
export async function GET(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const onlyEmail = url.searchParams.get("onlyEmail")?.trim().toLowerCase();
  const baseUrl = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`;

  const hoje = hojeEmBrasilia();
  const contas = await prisma.contaAPagar.findMany({
    where: {
      quitada: false,
      lembrar: true,
      vencimento: { gte: hoje, lte: new Date(hoje.getTime() + DIA_MS) },
      // Sem e-mail confirmado (conta criada com o e-mail de outra pessoa?), nada sai pra ela.
      user: { OR: [{ emailVerifiedAt: { not: null } }, { createdAt: { lt: CONFIRMACAO_DESDE } }], ...(onlyEmail ? { email: onlyEmail } : {}) },
    },
    orderBy: [{ vencimento: "asc" }, { nome: "asc" }],
    include: {
      user: { select: { id: true, email: true, name: true, role: true, currency: true, createdAt: true } },
      profile: { select: { theme: true, kind: true } },
    },
  });

  const porPessoa = new Map<string, typeof contas>();
  for (const c of contas) porPessoa.set(c.userId, [...(porPessoa.get(c.userId) ?? []), c]);

  // Reembolso ou cancelamento: o app nem abre pra ela, e o lembrete levaria pra uma tela trancada.
  const pessoas = [...porPessoa.values()].map((l) => l[0].user);
  const comAcesso = await contasQueUsamOApp(pessoas);

  let pushed = 0;
  let mailed = 0;
  const preview: { email: string; lembretes: string[] }[] = [];

  for (const [userId, lista] of porPessoa) {
    const user = lista[0].user;
    if (user.role !== "ADMIN" && !comAcesso.has(normalizeEmail(user.email))) continue;

    const lembretes = lembretesDeHoje(lista.map((c) => ({ ...c, valor: c.valor == null ? null : Number(c.valor) })), hoje);
    if (lembretes.length === 0) continue;
    const ja = await prisma.notificationLog.findMany({ where: { userId, key: { in: lembretes.map((l) => l.chave) } }, select: { key: true } });
    const vistos = new Set(ja.map((j) => j.key));
    const money = makeMoneyFormatter(toCurrencyCode(user.currency));

    const novos = lembretes
      .filter((l) => !vistos.has(l.chave))
      .map((l) => {
        const c = lista.find((x) => x.id === l.contaId)!;
        // A voz do perfil da conta: a conta da Empresa avisa no jeito da Empresa.
        const t = vozDoTema(c.profile?.theme, c.profile?.kind).titulos;
        return {
          chave: l.chave,
          nome: c.nome,
          titulo: t.contasLembreteTitulo(c.nome, l.quando),
          corpo: t.contasLembreteCorpo(c.valor == null ? null : money(Number(c.valor))),
          t,
        };
      });
    if (novos.length === 0) continue;
    preview.push({ email: user.email, lembretes: novos.map((n) => n.titulo) });
    if (dryRun) continue;

    // Só vira "já avisado" o que chegou de fato: o que não chegou hoje tenta de novo amanhã
    // (a véspera vira o aviso do dia, com outra chave).
    const entregues: string[] = [];
    if (isPushConfigured()) {
      for (const n of novos) {
        if ((await sendPushToUser(userId, { title: n.titulo, body: n.corpo, url: "/orcamento/contas", tag: n.chave })) > 0) entregues.push(n.chave);
      }
    }
    if (entregues.length > 0) pushed += 1;
    else if (isEmailConfigured()) {
      const { subject, html } = contasEmail({ name: user.name, t: novos[0].t, contas: novos, url: `${baseUrl}/orcamento/contas` });
      const res = await sendEmail({ to: user.email, subject, html });
      if (res.ok) {
        mailed += 1;
        entregues.push(...novos.map((n) => n.chave));
      }
    }
    if (entregues.length > 0) {
      await prisma.notificationLog.createMany({ data: entregues.map((key) => ({ userId, key })), skipDuplicates: true });
    }
  }

  return NextResponse.json({ ok: true, dryRun, hoje: hoje.toISOString().slice(0, 10), contas: contas.length, pushed, mailed, preview: dryRun ? preview : preview.length });
}
