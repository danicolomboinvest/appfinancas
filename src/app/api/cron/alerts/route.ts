import { NextResponse } from "next/server";
import { CONFIRMACAO_DESDE } from "@/lib/auth/confirmacao-email";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { diaDeInicioDoMes, mesDeAgoraDaPessoa, periodoDoMes } from "@/lib/mes/periodo";
import { buildBudgetAlerts, buildGoalAlerts, chaveDaMetaAtingida, metasQueChegaramLa, type Alert, type MetaAtingida } from "@/lib/insights/alerts";
import { computeGoalPlan } from "@/lib/planning/goal";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { carregarLivreDoMes } from "@/lib/repositories/livre-do-mes.repo";
import { contextoDoPerfil } from "@/lib/auth/session";
import { listBudgets, sumExpensesByCustomCategory, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { nomesDasPersonalizadas } from "@/lib/consolidation/escopo";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { alertEmail, metaAtingidaEmail } from "@/lib/email/templates";
import { makeMoneyFormatter, toCurrencyCode } from "@/lib/money";
import { PARENT_CATEGORIES, categoriasEssenciais, lerPreferenciasDeCategoria } from "@/lib/categories";
import { contasQueUsamOApp, normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { enviarAvisosAntesDeCancelar, lembrarEstenderNaHubla } from "@/lib/cancelar/avisos";
import { desligarCanceladosVencidos } from "@/lib/assinatura/cancelamento";
import { alertaResolvido, carregarRespostasDoMes } from "@/lib/avisos/respostas";

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
    select: { id: true, email: true, name: true, role: true, currency: true, notifyBudgetAlerts: true, notifyLateGoals: true, createdAt: true, diaInicioMes: true },
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
    // (numa Empresa, MORADIA se chama "Estrutura") e o de metas, do id. O contexto é o mesmo que
    // a sessão monta (contextoDoPerfil): no casal, o plano é o da casa e os gastos são os dos dois,
    // como no Orçamento. Antes o par recebia "Alimentação passou" do plano dele, que não existe.
    const perfil = await getOrCreateActiveProfile(user.id);
    const ctx = await contextoDoPerfil(user, perfil);

    // O mês da pessoa (30/10/2026): com o mês começando dia 15, em 05/11 o aviso de orçamento, o
    // "ficou para trás" das metas e o "chegou lá" são de outubro (15/10 a 14/11). Sem dia
    // escolhido, o mês do calendário, como sempre.
    const diaInicio = diaDeInicioDoMes(user.diaInicioMes);
    const mesDela = mesDeAgoraDaPessoa(now, diaInicio);

    if (user.notifyBudgetAlerts) {
      const { year, month } = mesDela;
      const periodo = periodoDoMes(year, month, diaInicio);
      // Meia-noite do dia 1 em Brasília (03:00 UTC), a mesma fronteira de ritmoDoMes: o que foi
      // criado antes é conta marcada e não conta como ritmo no aviso de 80%.
      const inicioDoMes = new Date(Date.UTC(periodo.inicio.getFullYear(), periodo.inicio.getMonth(), periodo.inicio.getDate(), 3));
      // As mesmas leituras do Orçamento (budget.repo) e o livre da fonte única (carregarLivreDoMes):
      // só o perfil ativo, nunca Pessoal + Casal + Empresa somados.
      const [planos, spent, preCriado, gastosProprios, proprias, livreDoMes] = await Promise.all([
        listBudgets(ctx, year, month),
        sumExpensesByParentCategory(ctx, year, month),
        sumExpensesByParentCategory(ctx, year, month, inicioDoMes),
        // As categorias criadas por ela entram só como origem do "Tirar de" no e-mail (a Compras
        // da Ana).
        sumExpensesByCustomCategory(ctx, year, month),
        nomesDasPersonalizadas(ctx),
        carregarLivreDoMes(ctx, { ano: year, mes: month }),
      ]);
      const budgets = planos.filter((b) => b.parentCategory !== null);
      const planosProprios = planos.filter((b) => b.customCategoryId !== null);
      const essenciais = categoriasEssenciais(lerPreferenciasDeCategoria(perfil.categorias));
      const gastoProprio = new Map(gastosProprios.map((g) => [g.customCategoryId, g.spent]));
      const nomeProprio = new Map(proprias.map((c) => [c.id, c.name]));
      alerts.push(
        ...buildBudgetAlerts({
          year,
          month,
          today: now,
          diaInicio,
          planned: budgets.filter((b) => b.parentCategory && PARENT_CATEGORIES.includes(b.parentCategory)).map((b) => ({ parentCategory: b.parentCategory!, planned: Number(b.plannedAmount) })),
          spent,
          preCriado,
          money: (v) => money(v, { round: true }),
          kind: perfil.kind,
          outras: planosProprios
            .filter((p) => p.customCategoryId && nomeProprio.has(p.customCategoryId))
            .map((p) => ({ key: p.customCategoryId!, label: nomeProprio.get(p.customCategoryId!)!, planejado: Number(p.plannedAmount), gasto: gastoProprio.get(p.customCategoryId!) ?? 0, essencial: essenciais.has(p.customCategoryId!) })),
          // O livre do mês pela fonte única (lib/repositories/livre-do-mes.repo): o mesmo número das telas.
          livre: livreDoMes.tipo === "plano" ? livreDoMes.valor : null,
        }),
      );
    }
    if (user.notifyLateGoals) {
      // O aporte "deste mês" e as cópias do "Repetir todo mês" seguem o mês da pessoa.
      const goals = await listGoalsWithProgress(ctx, diaInicio);
      alerts.push(
        ...buildGoalAlerts({
          // A chave do aviso é do mês da pessoa: um por meta por mês dela.
          year: mesDela.year,
          month: mesDela.month,
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
    const novos = alerts.filter((a) => !seen.has(a.key));
    if (novos.length === 0) continue;
    // O que ela já respondeu na tela ("Foi pontual", cobriu, "Deixar assim", "Agora não", teto)
    // não sai por push nem e-mail: a mesma regra das telas (lib/avisos). Sem gravar no log, para
    // sair se piorar bem depois. Com o contexto da sessão: no casal, "cobri Lazer" de um vale
    // para o outro, como nas telas.
    const respostas = await carregarRespostasDoMes(ctx, { ano: mesDela.year, mes: mesDela.month }, now);
    const fresh = novos.filter((a) => !alertaResolvido(respostas, a.key));
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
