import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { monthlyRecapEmail, monthlyNudgeEmail } from "@/lib/email/templates";
import { decideRecapEmail, MAX_NUDGES } from "@/lib/insights/recap-audience";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PARENT_CATEGORY_LABEL, isParentCategoryKey } from "@/lib/categories";

// Dezenas de e-mails em sequência passam do teto padrão de 10s.
export const maxDuration = 60;

/**
 * Resumo do mês por e-mail — o único e-mail recorrente do app. Roda no dia 1º e fecha o mês
 * ANTERIOR, pra todo mundo que teve movimento nele.
 *
 * Por que existe: o app não tinha nada que trouxesse a pessoa de volta. Os outros três e-mails
 * (senha, acesso liberado, boas-vindas) disparam uma vez só, no começo — e os números de uso
 * mostravam 3 de cada 4 contas criadas que nunca mais abriram o app. Um resumo mensal é o
 * motivo honesto pra voltar: mostra o que aconteceu com o dinheiro dela, não pede nada.
 *
 * São DOIS e-mails, um por público, no mesmo disparo:
 *  - quem teve movimento no mês → RESUMO (como foi o mês dela);
 *  - quem não teve             → CONVITE pra começar ("anote um gasto de hoje").
 * O convite é o que fala com a maior parte da base — gente que criou conta e nunca voltou.
 *
 * Regras que evitam virar spam (ver decideRecapEmail, testado à parte):
 * - só quem não desativou em Notificações (notifyMonthlyRecap);
 * - uma vez por mês por pessoa, garantido por recapEmailSentMonth (o cron pode repetir);
 * - convite no máximo MAX_NUDGES vezes: quem não usou em 3 meses não vai usar no 4º e-mail;
 * - quem criou conta DENTRO do mês fechado não recebe cobrança de um mês que mal viu.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  // ?dryRun=1 monta tudo e responde o que SERIA enviado, sem enviar. Serve pra conferir o
  // alcance ("vai pra quantas pessoas?") antes de um disparo de verdade.
  const dryRun = url.searchParams.get("dryRun") === "1";
  // ?onlyEmail=x@y.com envia só pra esse endereço — o teste antes de soltar pra base inteira.
  const onlyEmail = url.searchParams.get("onlyEmail")?.trim().toLowerCase();

  // Mês fechado = o anterior ao de hoje (fuso do Brasil; no fim da noite, o servidor em UTC
  // já estaria no dia seguinte e recaparia o mês errado na virada).
  const now = nowInBrazil();
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const baseUrl = appBaseUrl(request);

  // Todo mundo que ainda quer receber e ainda não recebeu o e-mail DESTE mês. Quem recebe o
  // resumo e quem recebe o convite é decidido por pessoa, logo abaixo.
  // O OR com null explícito é obrigatório: em SQL, `NOT (coluna = 'x')` com a coluna NULA dá
  // NULL (nem verdadeiro nem falso) e a linha fica de fora — e a coluna é nula pra quem nunca
  // recebeu, ou seja, o filtro sozinho não enviaria pra NINGUÉM, em silêncio.
  const candidates = await prisma.user.findMany({
    where: {
      notifyMonthlyRecap: true,
      role: "CLIENT",
      OR: [{ recapEmailSentMonth: null }, { recapEmailSentMonth: { not: monthKey } }],
      ...(onlyEmail ? { email: onlyEmail } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      recapNudgeCount: true,
      _count: { select: { monthlyEntries: { where: { year, month } } } },
    },
  });

  // Início do mês fechado: quem criou a conta depois disso não leva cobrança do mês.
  const monthStart = new Date(year, month - 1, 1);
  const newMonthLabel = now.toLocaleDateString("pt-BR", { month: "long" });

  let sent = 0;
  let nudges = 0;
  const failures: string[] = [];

  for (const user of candidates) {
    const decision = decideRecapEmail({
      hasActivityInMonth: user._count.monthlyEntries > 0,
      alreadySentThisMonth: false, // já filtrado na consulta acima
      wantsEmail: true, // idem
      nudgeCount: user.recapNudgeCount,
      existedBeforeMonth: user.createdAt < monthStart,
    });
    if (decision === "nada") continue;

    if (decision === "convite") {
      const { subject, html } = monthlyNudgeEmail({
        name: user.name,
        newMonthLabel,
        appUrl: `${baseUrl}/mensal`,
        preferencesUrl: `${baseUrl}/configuracoes/notificacoes`,
      });
      if (dryRun) {
        nudges += 1;
        continue;
      }
      try {
        const result = await sendEmail({ to: user.email, subject, html });
        if (result.ok) {
          nudges += 1;
          await prisma.user.update({
            where: { id: user.id },
            data: { recapEmailSentMonth: monthKey, recapNudgeCount: { increment: 1 } },
          });
        } else {
          failures.push(user.email);
        }
      } catch {
        failures.push(user.email);
      }
      continue;
    }

    const [grouped, byCategory] = await Promise.all([
      prisma.monthlyEntry.groupBy({
        by: ["category"],
        where: { userId: user.id, year, month },
        _sum: { amount: true },
      }),
      prisma.monthlyEntry.groupBy({
        by: ["parentCategory"],
        where: { userId: user.id, year, month, category: "EXPENSE", parentCategory: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const totalOf = (category: string) =>
      Number(grouped.find((g) => g.category === category)?._sum.amount ?? 0);
    const income = totalOf("INCOME");
    const expense = totalOf("EXPENSE");
    const investment = totalOf("INVESTMENT_CONTRIBUTION");
    const balance = income - expense - investment;

    // Gasto do mês anterior ao recapeado, só pra frase de comparação.
    const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const previousExpense = Number(
      (
        await prisma.monthlyEntry.aggregate({
          where: { userId: user.id, year: previous.year, month: previous.month, category: "EXPENSE" },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0,
    );

    const top = byCategory
      .map((c) => ({ key: c.parentCategory as string, value: Number(c._sum.amount ?? 0) }))
      .sort((a, b) => b.value - a.value)[0];

    const { subject, html } = monthlyRecapEmail({
      name: user.name,
      monthLabel,
      income,
      expense,
      balance,
      expenseDelta: previousExpense > 0 ? expense / previousExpense - 1 : null,
      topCategory:
        top && isParentCategoryKey(top.key)
          ? { label: PARENT_CATEGORY_LABEL[top.key], value: top.value }
          : null,
      appUrl: `${baseUrl}/mensal/${year}/${month}`,
      preferencesUrl: `${baseUrl}/configuracoes/notificacoes`,
    });

    if (dryRun) {
      sent += 1;
      continue;
    }

    // Melhor esforço por pessoa: um endereço que quica não pode derrubar o envio dos outros.
    try {
      const result = await sendEmail({ to: user.email, subject, html });
      if (result.ok) {
        sent += 1;
        // Marca DEPOIS do envio dar certo: falhou, tenta de novo na próxima execução.
        await prisma.user.update({
          where: { id: user.id },
          // Zera os convites: ela voltou a usar, e se um dia parar de novo, merece recomeçar
          // do zero em vez de já entrar no limite por causa de um sumiço antigo.
          data: { recapEmailSentMonth: monthKey, recapNudgeCount: 0 },
        });
      } else {
        failures.push(user.email);
      }
    } catch {
      failures.push(user.email);
    }
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    candidates: candidates.length,
    resumos: sent,
    convites: nudges,
    failures: failures.length,
    maxNudges: MAX_NUDGES,
    dryRun,
  });
}

/** URL do app a partir do próprio request — funciona em localhost e no domínio de produção. */
function appBaseUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
