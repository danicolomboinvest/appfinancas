import { NextResponse } from "next/server";
import { CONFIRMACAO_DESDE } from "@/lib/auth/confirmacao-email";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { buildBudgetAlerts, buildGoalAlerts, chaveDaMetaAtingida, metasQueChegaramLa, type Alert, type MetaAtingida } from "@/lib/insights/alerts";
import { computeGoalPlan } from "@/lib/planning/goal";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { alertEmail, metaAtingidaEmail } from "@/lib/email/templates";
import { makeMoneyFormatter, toCurrencyCode } from "@/lib/money";
import { PARENT_CATEGORIES, categoriasEssenciais, lerPreferenciasDeCategoria } from "@/lib/categories";
import { contasQueUsamOApp, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { enviarAvisosAntesDeCancelar, lembrarEstenderNaHubla } from "@/lib/cancelar/avisos";
import { desligarCanceladosVencidos } from "@/lib/assinatura/cancelamento";

export const maxDuration = 60;

/**
 * Avisos do meio do mês, uma vez por dia (vercel.json): categoria em 80% com metade do mês
 * pela frente, categoria que passou do plano, meta que ficou pra trás e, desde 11/10/2026, meta
 * que chegou lá ("Você chegou lá", uma vez por meta). Cada aviso tem uma chave e só sai uma vez
 * (NotificationLog). Vai pro celular de quem ligou os avisos; quem não ligou recebe por e-mail,
 * no máximo um e-mail por dia com os avisos do dia (e a meta concluída num e-mail só dela).
 */
export async function GET(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const onlyEmail = url.searchParams.get("onlyEmail")?.trim().toLowerCase();

  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const baseUrl = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`;

  const todos = await prisma.user.findMany({
    // Sem e-mail confirmado (conta criada com o e-mail de outra pessoa?), nada sai pra ela.
    where: { OR: [{ notifyBudgetAlerts: true }, { notifyLateGoals: true }], AND: [{ OR: [{ emailVerifiedAt: { not: null } }, { createdAt: { lt: CONFIRMACAO_DESDE } }] }], ...(onlyEmail ? { email: onlyEmail } : {}) },
    select: { id: true, email: true, name: true, role: true, currency: true, notifyBudgetAlerts: true, notifyLateGoals: true, createdAt: true },
  });
  // Reembolso ou cancelamento: o app nem abre pra ela, e o aviso levaria pra uma tela trancada.
  // Quem sobrou do grátis continua recebendo (ver usoDoApp).
  const comAcesso = await contasQueUsamOApp(todos);
  const users = todos.filter((u) => u.role === "ADMIN" || comAcesso.has(normalizeEmail(u.email)));

  let pushed = 0;
  let mailed = 0;
  const preview: { email: string; alerts: string[] }[] = [];

  for (const user of users) {
    const moeda = toCurrencyCode(user.currency);
    const money = makeMoneyFormatter(moeda);
    const alerts: Alert[] = [];
    // As metas que chegaram lá hoje, para o e-mail "Você chegou lá" (a chave é goal-done:<id>).
    let chegaram: MetaAtingida[] = [];

    // O perfil ativo entra antes dos dois blocos: o aviso de orçamento precisa do TIPO dele
    // (numa Empresa, MORADIA se chama "Estrutura") e o de metas, do id.
    const perfil = await getOrCreateActiveProfile(user.id);

    if (user.notifyBudgetAlerts) {
      // Meia-noite do dia 1 em Brasília (03:00 UTC), a mesma fronteira de ritmoDoMes: o que foi
      // criado antes é conta marcada e não conta como ritmo no aviso de 80%.
      const inicioDoMes = new Date(Date.UTC(year, month - 1, 1, 3));
      const [budgets, spent, preCriado, planosProprios, gastosProprios, proprias, totalGasto] = await Promise.all([
        // Só o perfil ativo: somar Pessoal + Casal + Empresa mandava "Alimentação passou" com
        // um número que não aparece em nenhuma tela.
        prisma.budget.findMany({ where: { userId: user.id, profileId: perfil.id, year, month, parentCategory: { not: null } }, select: { parentCategory: true, plannedAmount: true } }),
        prisma.monthlyEntry.groupBy({ by: ["parentCategory"], where: { userId: user.id, profileId: perfil.id, year, month, category: "EXPENSE", parentCategory: { not: null } }, _sum: { amount: true } }),
        prisma.monthlyEntry.groupBy({ by: ["parentCategory"], where: { userId: user.id, profileId: perfil.id, year, month, category: "EXPENSE", parentCategory: { not: null }, createdAt: { lt: inicioDoMes } }, _sum: { amount: true } }),
        // As categorias criadas por ela entram só como origem do "Tirar de" no e-mail (a Compras
        // da Ana), e o total do mês dá o livre (plano − gastou), como na folha "O que fazer?".
        prisma.budget.findMany({ where: { userId: user.id, profileId: perfil.id, year, month, customCategoryId: { not: null } }, select: { customCategoryId: true, plannedAmount: true } }),
        prisma.monthlyEntry.groupBy({ by: ["customCategoryId"], where: { userId: user.id, profileId: perfil.id, year, month, category: "EXPENSE", customCategoryId: { not: null } }, _sum: { amount: true } }),
        prisma.customCategory.findMany({ where: { userId: user.id, profileId: perfil.id }, select: { id: true, name: true } }),
        prisma.monthlyEntry.aggregate({ where: { userId: user.id, profileId: perfil.id, year, month, category: "EXPENSE" }, _sum: { amount: true } }),
      ]);
      const essenciais = categoriasEssenciais(lerPreferenciasDeCategoria(perfil.categorias));
      const gastoProprio = new Map(gastosProprios.map((g) => [g.customCategoryId, Number(g._sum.amount ?? 0)]));
      const nomeProprio = new Map(proprias.map((c) => [c.id, c.name]));
      const planejadoTotal = [...budgets, ...planosProprios].reduce((t, b) => t + Number(b.plannedAmount), 0);
      alerts.push(
        ...buildBudgetAlerts({
          year,
          month,
          today: now,
          planned: budgets.filter((b) => b.parentCategory && PARENT_CATEGORIES.includes(b.parentCategory)).map((b) => ({ parentCategory: b.parentCategory!, planned: Number(b.plannedAmount) })),
          spent: spent.filter((s) => s.parentCategory).map((s) => ({ parentCategory: s.parentCategory!, spent: Number(s._sum.amount ?? 0) })),
          preCriado: preCriado.filter((s) => s.parentCategory).map((s) => ({ parentCategory: s.parentCategory!, spent: Number(s._sum.amount ?? 0) })),
          money: (v) => money(v, { round: true }),
          kind: perfil.kind,
          outras: planosProprios
            .filter((p) => p.customCategoryId && nomeProprio.has(p.customCategoryId))
            .map((p) => ({ key: p.customCategoryId!, label: nomeProprio.get(p.customCategoryId!)!, planejado: Number(p.plannedAmount), gasto: gastoProprio.get(p.customCategoryId) ?? 0, essencial: essenciais.has(p.customCategoryId!) })),
          livre: planejadoTotal > 0 ? planejadoTotal - Number(totalGasto._sum.amount ?? 0) : null,
        }),
      );
    }
    if (user.notifyLateGoals) {
      const goals = await listGoalsWithProgress({ userId: user.id, role: user.role, profileId: perfil.id, profileTheme: perfil.theme, profileKind: perfil.kind });
      alerts.push(
        ...buildGoalAlerts({
          year,
          month,
          // Meta sem data não tem "atrasada" (o mesmo critério do Foco): fica fora do aviso.
          goals: goals.flatMap((g) => {
            if (!g.targetDate) return [];
            const plan = computeGoalPlan({ targetAmount: Number(g.targetAmount), currentAmount: g.computedCurrentAmount, targetDate: g.targetDate, annualRate: Number(g.annualRate ?? 0), startedAt: g.createdAt });
            return [{ id: g.id, name: g.name, behind: plan.status === "BEHIND", monthly: plan.requiredMonthlyContribution, guardado: g.computedCurrentAmount, alvo: Number(g.targetAmount) }];
          }),
          money: (v) => money(v, { round: true }),
        }),
      );
      chegaram = metasQueChegaramLa({
        hoje: now,
        goals: goals.map((g) => ({ id: g.id, name: g.name, alvo: Number(g.targetAmount), guardado: g.computedCurrentAmount, criadaEm: g.createdAt, temAporteNoMes: g.temAporteNoMes })),
      });
      alerts.push(
        ...chegaram.map((m) => ({
          key: chaveDaMetaAtingida(m.id),
          title: `${m.nome}: você chegou lá`,
          body: `${money(m.alvo, { round: true })} guardados. 100% da meta.`,
          url: `/planejamento/metas/${m.id}`,
        })),
      );
    }
    if (alerts.length === 0) continue;

    const already = await prisma.notificationLog.findMany({ where: { userId: user.id, key: { in: alerts.map((a) => a.key) } }, select: { key: true } });
    const seen = new Set(already.map((a) => a.key));
    const fresh = alerts.filter((a) => !seen.has(a.key));
    if (fresh.length === 0) continue;
    preview.push({ email: user.email, alerts: fresh.map((a) => a.title) });
    if (dryRun) continue;

    // Só vira "já avisado" o que chegou de fato. Antes o log era gravado mesmo com o e-mail
    // falhando (SMTP fora do ar, ou não configurado) — e como a chave é do mês, o aviso de
    // "Alimentação passou" nunca mais era tentado e ela não recebia nada. O que não chegou
    // hoje volta amanhã.
    const entregues: string[] = [];
    if (isPushConfigured()) {
      for (const a of fresh) {
        if ((await sendPushToUser(user.id, { title: a.title, body: a.body, url: a.url, tag: a.key })) > 0) entregues.push(a.key);
      }
    }
    if (entregues.length > 0) pushed += 1;
    else if (isEmailConfigured()) {
      const preferencesUrl = `${baseUrl}/configuracoes/notificacoes`;
      // A meta que chegou lá vai num e-mail só dela ("é o e-mail que ela vai querer mostrar");
      // os outros avisos do dia vão juntos, com o mais importante no topo.
      const metasNovas = chegaram.filter((m) => fresh.some((a) => a.key === chaveDaMetaAtingida(m.id)));
      const avisos = fresh.filter((a) => !a.key.startsWith("goal-done:"));
      for (const m of metasNovas) {
        const { subject, html } = metaAtingidaEmail({ name: user.name, meta: m.nome, alvo: m.alvo, meses: m.meses, mediaPorMes: m.mediaPorMes, url: `${baseUrl}/planejamento/metas/${m.id}`, preferencesUrl, tema: perfil.theme, moeda });
        if ((await sendEmail({ to: user.email, subject, html })).ok) entregues.push(chaveDaMetaAtingida(m.id));
      }
      if (avisos.length > 0) {
        const { subject, html } = alertEmail({ name: user.name, alerts: avisos.map((a) => ({ ...a, url: `${baseUrl}${a.url}` })), preferencesUrl, tema: perfil.theme, moeda });
        if ((await sendEmail({ to: user.email, subject, html })).ok) entregues.push(...avisos.map((a) => a.key));
      }
      if (entregues.length > 0) mailed += 1;
    }
    if (entregues.length > 0) {
      await prisma.notificationLog.createMany({ data: entregues.map((key) => ({ userId: user.id, key })), skipDuplicates: true });
    }
  }

  // Os e-mails combinados no "antes de cancelar" (prazo do reembolso e antes da renovação).
  const hojeDia = new Date(Date.UTC(year, month - 1, now.getDate()));
  const avisosDeCancelar = onlyEmail ? 0 : await enviarAvisosAntesDeCancelar(hojeDia, dryRun);
  const lembretesDaHubla = onlyEmail ? 0 : await lembrarEstenderNaHubla(new Date(), dryRun);
  // Quem saiu sem reembolso fica até o vencimento; passado ele, desliga (o login já barrava).
  const canceladosDesligados = onlyEmail || dryRun ? 0 : await desligarCanceladosVencidos();

  return NextResponse.json({ ok: true, dryRun, users: users.length, pushed, mailed, avisosDeCancelar, lembretesDaHubla, canceladosDesligados, preview: dryRun ? preview : preview.length });
}
