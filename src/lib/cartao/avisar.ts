import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { formatMoney, toCurrencyCode } from "@/lib/money";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { alertEmail } from "@/lib/email/templates";
import { gastoNoCartao, lerLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { avisoDevido, chaveDoAviso, MARCOS_DO_LIMITE, type Marco } from "./limite";

/**
 * O aviso do limite do cartão (06/10/2026), na hora em que o gasto entra (lançamento ou fatura
 * importada), não no dia seguinte: quem está na loja precisa saber agora. Um por marco (70%, 90%,
 * 100%) por mês; quem pula vários de uma vez recebe só o maior.
 *
 * Notificação no celular; quem não tem notificação ligada recebe por e-mail, como os outros avisos
 * do app. Respeita o "avisos de orçamento" desligado em Notificações. Nunca lança: roda depois da
 * resposta (after) e um erro aqui não pode desfazer o lançamento.
 */
export async function avisarLimiteDoCartao(ctx: AuthContext, ano: number, mes: number, baseUrl: string): Promise<"enviado" | "nada" | "falhou"> {
  try {
    const limite = await lerLimiteDoCartao(ctx);
    if (limite === null) return "nada";
    const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, currency: true, notifyBudgetAlerts: true } });
    if (!user?.notifyBudgetAlerts) return "nada";

    const gasto = await gastoNoCartao(ctx, ano, mes);
    const prefixo = chaveDoAviso(ctx.profileId, ano, mes, 70).replace(/70$/, "");
    const logs = await prisma.notificationLog.findMany({ where: { userId: ctx.userId, key: { startsWith: prefixo } }, select: { key: true } });
    const jaAvisados = new Set(MARCOS_DO_LIMITE.filter((m) => logs.some((l) => l.key === chaveDoAviso(ctx.profileId, ano, mes, m))));
    const devido = avisoDevido(gasto, limite, jaAvisados);
    if (!devido) return "nada";

    // Reserva a chave antes de mandar: dois gastos salvos juntos não mandam o mesmo aviso duas vezes.
    const chave = chaveDoAviso(ctx.profileId, ano, mes, devido.marco);
    try {
      await prisma.notificationLog.create({ data: { userId: ctx.userId, key: chave } });
    } catch {
      return "nada";
    }

    const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
    const money = (v: number) => formatMoney(v, toCurrencyCode(user.currency), { round: true });
    const nomeDoMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
    const titulo = t.limAvisoTitulo(devido.marco, money(Math.max(0, limite - gasto)));
    const corpo = t.limAvisoCorpo(devido.marco, money(gasto), money(limite), nomeDoMes);
    const url = "/orcamento/cartao";

    let chegou = isPushConfigured() ? (await sendPushToUser(ctx.userId, { title: titulo, body: corpo, url, tag: chave })) > 0 : false;
    if (!chegou && isEmailConfigured()) {
      const { subject, html } = alertEmail({ name: user.name, alerts: [{ title: titulo, body: corpo, url: `${baseUrl}${url}` }], preferencesUrl: `${baseUrl}/configuracoes/notificacoes` });
      chegou = (await sendEmail({ to: user.email, subject, html })).ok;
    }
    if (!chegou) {
      // Nada chegou: solta a chave, o próximo gasto tenta de novo.
      await prisma.notificationLog.deleteMany({ where: { userId: ctx.userId, key: chave } });
      return "falhou";
    }
    // Os marcos menores alcançados junto ficam como avisados: não chegam atrasados depois.
    const menores = devido.marcar.filter((m: Marco) => m !== devido.marco).map((m) => ({ userId: ctx.userId, key: chaveDoAviso(ctx.profileId, ano, mes, m) }));
    if (menores.length > 0) await prisma.notificationLog.createMany({ data: menores, skipDuplicates: true });
    return "enviado";
  } catch (err) {
    console.error("[limite do cartão] aviso falhou:", err);
    return "falhou";
  }
}
