import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { prisma } from "@/lib/db/prisma";
import { abrirEnvioEmLote } from "@/lib/email/send";
import { monthlyRecapEmail, monthlyNudgeEmail } from "@/lib/email/templates";
import { decideRecapEmail, escolherPerfilDoResumo, MAX_NUDGES } from "@/lib/insights/recap-audience";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { toCurrencyCode } from "@/lib/money";
import { categoryLabel, isParentCategoryKey } from "@/lib/categories";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { vozDoTema } from "@/lib/profiles/voice";

// Centenas de e-mails em sequência: o teto maior da Vercel (o mesmo do cron do Open Finance), e
// o loop para sozinho com folga antes dele (PRAZO_MS). Quem ficar pra trás recebe na rodada do
// dia seguinte — o cron roda nos dias 1, 2 e 3 (vercel.json), e a trava recapEmailSentMonth
// impede que alguém receba duas vezes.
export const maxDuration = 300;
const PRAZO_MS = 270_000;

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
 * - uma vez por mês por pessoa, garantido por recapEmailSentMonth (o cron repete nos dias 2 e 3
 *   só pra completar quem não coube na rodada do dia 1º);
 * - convite no máximo MAX_NUDGES vezes: quem não usou em 3 meses não vai usar no 4º e-mail;
 * - quem criou conta DENTRO do mês fechado não recebe cobrança de um mês que mal viu.
 */
export async function GET(request: Request) {
  const inicio = Date.now();
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

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
      currency: true,
      createdAt: true,
      recapNudgeCount: true,
      _count: { select: { financialProfiles: true } },
    },
    // Ordem fixa: se o tempo acabar no meio, a rodada seguinte continua de onde parou (quem já
    // recebeu sai da consulta pela trava do mês).
    orderBy: { id: "asc" },
  });

  // Lançamentos do mês por pessoa E por perfil, numa consulta só (em blocos, pra lista de ids
  // não crescer sem limite). A atividade precisa ser do mesmo perfil dos números do e-mail.
  const lancamentosPorPessoa = new Map<string, { profileId: string | null; lancamentos: number }[]>();
  for (let i = 0; i < candidates.length; i += 1000) {
    const ids = candidates.slice(i, i + 1000).map((c) => c.id);
    const grupos = await prisma.monthlyEntry.groupBy({
      by: ["userId", "profileId"],
      where: { userId: { in: ids }, year, month },
      _count: { _all: true },
    });
    for (const g of grupos) {
      const lista = lancamentosPorPessoa.get(g.userId) ?? [];
      lista.push({ profileId: g.profileId, lancamentos: g._count._all });
      lancamentosPorPessoa.set(g.userId, lista);
    }
  }

  // Início do mês fechado: quem criou a conta depois disso não leva cobrança do mês.
  const monthStart = new Date(year, month - 1, 1);
  const newMonthLabel = now.toLocaleDateString("pt-BR", { month: "long" });

  let sent = 0;
  let nudges = 0;
  let pendentes = 0;
  const failures: string[] = [];
  const email = abrirEnvioEmLote();

  try {
    for (const [posicao, user] of candidates.entries()) {
      // Para com folga antes do teto: morto pela plataforma, nem a resposta sairia.
      if (Date.now() - inicio > PRAZO_MS) {
        pendentes = candidates.length - posicao;
        break;
      }

      const lancamentos = lancamentosPorPessoa.get(user.id) ?? [];
      // Perfil ativo só é buscado quando precisa (quem não vai receber nada não gasta consulta).
      const ativo = lancamentos.length > 0 ? await getOrCreateActiveProfile(user.id) : null;
      const perfilDoResumoId = ativo ? escolherPerfilDoResumo(lancamentos, ativo.id) : null;

      const decision = decideRecapEmail({
        hasActivityInMonth: perfilDoResumoId !== null,
        alreadySentThisMonth: false, // já filtrado na consulta acima
        wantsEmail: true, // idem
        nudgeCount: user.recapNudgeCount,
        existedBeforeMonth: user.createdAt < monthStart,
      });
      if (decision === "nada") continue;

      // O resumo é do perfil que teve o movimento (ver escolherPerfilDoResumo); o convite, do
      // perfil ativo. O tom do e-mail segue o tema desse perfil, igual ao resto do app.
      const perfilDoEmail =
        perfilDoResumoId && perfilDoResumoId !== ativo?.id
          ? await prisma.financialProfile.findFirstOrThrow({
              where: { id: perfilDoResumoId, userId: user.id },
              select: { id: true, name: true, theme: true, kind: true },
            })
          : (ativo ?? (await getOrCreateActiveProfile(user.id)));
      const t = vozDoTema(perfilDoEmail.theme, perfilDoEmail.kind).titulos;

      if (decision === "convite") {
        const { subject, html } = monthlyNudgeEmail({
          name: user.name,
          newMonthLabel,
          appUrl: `${baseUrl}/mensal`,
          preferencesUrl: `${baseUrl}/configuracoes/notificacoes`,
          t,
        });
        if (dryRun) {
          nudges += 1;
          continue;
        }
        try {
          const result = await email.enviar({ to: user.email, subject, html });
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
          // Um perfil só (o do resumo): o e-mail leva pra /mensal, que mostra um perfil só. Somar
          // Pessoal + Empresa dava um resultado que não aparece em tela nenhuma.
          where: { userId: user.id, profileId: perfilDoEmail.id, year, month },
          _sum: { amount: true },
        }),
        prisma.monthlyEntry.groupBy({
          by: ["parentCategory"],
          where: { userId: user.id, profileId: perfilDoEmail.id, year, month, category: "EXPENSE", parentCategory: { not: null } },
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
            where: { userId: user.id, profileId: perfilDoEmail.id, year: previous.year, month: previous.month, category: "EXPENSE" },
            _sum: { amount: true },
          })
        )._sum.amount ?? 0,
      );

      const top = byCategory
        .map((c) => ({ key: c.parentCategory as string, value: Number(c._sum.amount ?? 0) }))
        .sort((a, b) => b.value - a.value)[0];
      // O nome da maior categoria é o do perfil do resumo (numa Empresa, "Estrutura", não "Moradia").

      const { subject, html } = monthlyRecapEmail({
        name: user.name,
        monthLabel,
        currency: toCurrencyCode(user.currency),
        income,
        expense,
        investment,
        balance,
        expenseDelta: previousExpense > 0 ? expense / previousExpense - 1 : null,
        topCategory:
          top && isParentCategoryKey(top.key)
            ? { label: categoryLabel(perfilDoEmail.kind, top.key), value: top.value }
            : null,
        appUrl: `${baseUrl}/mensal/${year}/${month}`,
        preferencesUrl: `${baseUrl}/configuracoes/notificacoes`,
        t,
        perfil: user._count.financialProfiles > 1 ? perfilDoEmail.name : undefined,
      });

      if (dryRun) {
        sent += 1;
        continue;
      }

      // Melhor esforço por pessoa: um endereço que quica não pode derrubar o envio dos outros.
      try {
        const result = await email.enviar({ to: user.email, subject, html });
        if (result.ok) {
          sent += 1;
          // Marca DEPOIS do envio dar certo: falhou, tenta de novo na próxima execução (dias 2 e 3).
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
  } finally {
    email.fechar();
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    candidates: candidates.length,
    resumos: sent,
    convites: nudges,
    failures: failures.length,
    pendentes,
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
