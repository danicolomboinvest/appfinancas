import "server-only";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { formatMoney, toCurrencyCode } from "@/lib/money";
import { sendPushToUser, isPushConfigured } from "@/lib/push/send";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { alertEmail } from "@/lib/email/templates";
import { lancamentosDoPlano, planosDoPerfil } from "@/lib/repositories/plano-da-meta.repo";
import { avisosPorCoisinha, chaveDoAvisoDoTeto, tetosAlcancados, textoDoAvisoDoTeto } from "./plano-gravado";

/**
 * O "aviso no caminho" do plano da meta (16/10/2026): quando o gasto do mês numa coisinha do plano
 * chega a 75% do teto que ela escolheu ("iFood até R$ 200"), avisa. Igual ao aviso do limite do
 * cartão (lib/cartao/avisar.ts): na hora em que o gasto entra, um por coisinha por mês (mesmo em
 * duas metas, vale o teto mais apertado), notificação
 * no celular e e-mail para quem não tem notificação, respeitando o "avisos de orçamento" desligado.
 * Só o mês de agora: lançar um gasto de um mês que já passou não avisa. Nunca lança.
 */
export async function avisarTetosDoPlano(ctx: AuthContext, ano: number, mes: number, baseUrl: string): Promise<"enviado" | "nada" | "falhou"> {
  try {
    const agora = nowInBrazil();
    if (ano !== agora.getFullYear() || mes !== agora.getMonth() + 1) return "nada";
    const planos = await planosDoPerfil(ctx);
    if (planos.size === 0) return "nada";
    const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, currency: true, notifyBudgetAlerts: true } });
    if (!user?.notifyBudgetAlerts) return "nada";
    const metas = await prisma.goal.findMany({ where: { ...doDono(ctx), id: { in: [...planos.keys()] }, status: { not: "ACHIEVED" } }, select: { id: true, name: true } });
    if (metas.length === 0) return "nada";
    const lancamentos = await lancamentosDoPlano(ctx, [{ ano, mes }]);
    const money = (v: number) => formatMoney(v, toCurrencyCode(user.currency), { round: Number.isInteger(v) });
    let enviou = false;
    let falhou = false;
    const todos = metas.flatMap((meta) => {
      const plano = planos.get(meta.id);
      return plano ? tetosAlcancados(plano, lancamentos).map((a) => ({ ...a, meta: meta.name, metaId: meta.id })) : [];
    });
    for (const aviso of avisosPorCoisinha(todos)) {
      const chave = chaveDoAvisoDoTeto(aviso.item.id, ano, mes);
      // Reserva a chave antes de mandar: dois gastos salvos juntos não mandam o mesmo aviso duas vezes.
      try {
        await prisma.notificationLog.create({ data: { userId: ctx.userId, key: chave } });
      } catch {
        continue;
      }
      const { titulo, corpo } = textoDoAvisoDoTeto(aviso, aviso.meta, money);
      const url = `/planejamento/metas/${aviso.metaId}/plano`;
      let chegou = isPushConfigured() ? (await sendPushToUser(ctx.userId, { title: titulo, body: corpo, url, tag: chave })) > 0 : false;
      if (!chegou && isEmailConfigured()) {
        const { subject, html } = alertEmail({
          name: user.name,
          alerts: [{ title: titulo, body: corpo, url: `${baseUrl}${url}` }],
          preferencesUrl: `${baseUrl}/configuracoes/notificacoes`,
          tema: ctx.profileTheme,
          moeda: toCurrencyCode(user.currency),
        });
        chegou = (await sendEmail({ to: user.email, subject, html })).ok;
      }
      if (chegou) enviou = true;
      else {
        // Nada chegou: solta a chave, o próximo gasto tenta de novo.
        await prisma.notificationLog.deleteMany({ where: { userId: ctx.userId, key: chave } });
        falhou = true;
      }
    }
    return enviou ? "enviado" : falhou ? "falhou" : "nada";
  } catch (err) {
    console.error("[plano da meta] aviso falhou:", err);
    return "falhou";
  }
}
