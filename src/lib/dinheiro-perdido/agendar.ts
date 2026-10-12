import { after } from "next/server";
import { formatMoney, toCurrencyCode } from "@/lib/money";
import type { DonoDoPerfil } from "@/lib/repositories/dinheiro-perdido.repo";

/**
 * O gancho do fim da importação: recalcula o Dinheiro perdido e, se apareceu carta nova, avisa no
 * celular ("2 cartas novas"). Roda depois da resposta (não atrasa a importação). Fora de uma
 * requisição (a sincronização do banco num cron), roda na hora. Nunca derruba quem chamou.
 */
export async function agendarCacaDoDinheiroPerdido(ctx: DonoDoPerfil): Promise<void> {
  try {
    after(() => cacarEAvisar(ctx));
  } catch {
    await cacarEAvisar(ctx);
  }
}

async function cacarEAvisar(ctx: DonoDoPerfil): Promise<void> {
  try {
    const { recalcularDinheiroPerdido } = await import("@/lib/repositories/dinheiro-perdido.repo");
    const { novos, anualNovos } = await recalcularDinheiroPerdido(ctx);
    if (novos === 0) return;
    const { sendPushToUser } = await import("@/lib/push/send");
    const { prisma } = await import("@/lib/db/prisma");
    const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { currency: true } });
    const moeda = toCurrencyCode(user?.currency ?? null);
    await sendPushToUser(ctx.userId, {
      title: novos === 1 ? "1 carta nova" : `${novos} cartas novas`,
      body: `O extrato chegou. Achei ${formatMoney(anualNovos, moeda, { round: true })} por ano para conferir.`,
      url: "/orcamento/contas/perdido",
      tag: "dinheiro-perdido",
    });
  } catch (err) {
    console.error("Dinheiro perdido: recalcular falhou (a importação segue)", err);
  }
}
