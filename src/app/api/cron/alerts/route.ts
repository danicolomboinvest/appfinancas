import { NextResponse } from "next/server";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { buildBudgetAlerts, buildGoalAlerts, type Alert } from "@/lib/insights/alerts";
import { computeGoalPlan } from "@/lib/planning/goal";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { alertEmail } from "@/lib/email/templates";
import { makeMoneyFormatter, toCurrencyCode } from "@/lib/money";
import { PARENT_CATEGORIES } from "@/lib/categories";

export const maxDuration = 60;

/**
 * Avisos do meio do mês, uma vez por dia (vercel.json): categoria em 80% com metade do mês
 * pela frente, categoria estourada, meta que ficou pra trás. Cada aviso tem uma chave por
 * mês e só sai uma vez (NotificationLog). Vai pro celular de quem ligou os avisos; quem não
 * ligou recebe por e-mail, no máximo um e-mail por dia com todos os avisos do dia.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const onlyEmail = url.searchParams.get("onlyEmail")?.trim().toLowerCase();

  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const baseUrl = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`;

  const users = await prisma.user.findMany({
    where: { OR: [{ notifyBudgetAlerts: true }, { notifyLateGoals: true }], ...(onlyEmail ? { email: onlyEmail } : {}) },
    select: { id: true, email: true, name: true, role: true, currency: true, notifyBudgetAlerts: true, notifyLateGoals: true },
  });

  let pushed = 0;
  let mailed = 0;
  const preview: { email: string; alerts: string[] }[] = [];

  for (const user of users) {
    const money = makeMoneyFormatter(toCurrencyCode(user.currency));
    const alerts: Alert[] = [];

    if (user.notifyBudgetAlerts) {
      const [budgets, spent] = await Promise.all([
        prisma.budget.findMany({ where: { userId: user.id, year, month, parentCategory: { not: null } }, select: { parentCategory: true, plannedAmount: true } }),
        prisma.monthlyEntry.groupBy({ by: ["parentCategory"], where: { userId: user.id, year, month, category: "EXPENSE", parentCategory: { not: null } }, _sum: { amount: true } }),
      ]);
      alerts.push(
        ...buildBudgetAlerts({
          year,
          month,
          today: now,
          planned: budgets.filter((b) => b.parentCategory && PARENT_CATEGORIES.includes(b.parentCategory)).map((b) => ({ parentCategory: b.parentCategory!, planned: Number(b.plannedAmount) })),
          spent: spent.filter((s) => s.parentCategory).map((s) => ({ parentCategory: s.parentCategory!, spent: Number(s._sum.amount ?? 0) })),
          money: (v) => money(v, { round: true }),
        }),
      );
    }
    if (user.notifyLateGoals) {
      const perfil = await getOrCreateActiveProfile(user.id);
      const goals = await listGoalsWithProgress({ userId: user.id, role: user.role, profileId: perfil.id });
      alerts.push(
        ...buildGoalAlerts({
          year,
          month,
          goals: goals.map((g) => {
            const plan = computeGoalPlan({ targetAmount: Number(g.targetAmount), currentAmount: g.computedCurrentAmount, targetDate: g.targetDate ?? now, annualRate: Number(g.annualRate ?? 0), startedAt: g.createdAt });
            return { id: g.id, name: g.name, behind: plan.status === "BEHIND", monthly: plan.requiredMonthlyContribution };
          }),
          money: (v) => money(v, { round: true }),
        }),
      );
    }
    if (alerts.length === 0) continue;

    const already = await prisma.notificationLog.findMany({ where: { userId: user.id, key: { in: alerts.map((a) => a.key) } }, select: { key: true } });
    const seen = new Set(already.map((a) => a.key));
    const fresh = alerts.filter((a) => !seen.has(a.key));
    if (fresh.length === 0) continue;
    preview.push({ email: user.email, alerts: fresh.map((a) => a.title) });
    if (dryRun) continue;

    let delivered = 0;
    if (isPushConfigured()) {
      for (const a of fresh) delivered += await sendPushToUser(user.id, { title: a.title, body: a.body, url: a.url, tag: a.key });
    }
    if (delivered > 0) pushed += 1;
    else if (isEmailConfigured()) {
      const { subject, html } = alertEmail({ name: user.name, alerts: fresh.map((a) => ({ title: a.title, body: a.body, url: `${baseUrl}${a.url}` })), preferencesUrl: `${baseUrl}/configuracoes/notificacoes` });
      const res = await sendEmail({ to: user.email, subject, html });
      if (res.ok) mailed += 1;
    }
    await prisma.notificationLog.createMany({ data: fresh.map((a) => ({ userId: user.id, key: a.key })), skipDuplicates: true });
  }

  return NextResponse.json({ ok: true, dryRun, users: users.length, pushed, mailed, preview: dryRun ? preview : preview.length });
}
