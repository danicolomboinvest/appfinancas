import { after } from "next/server";
import type { DonoDoPerfil } from "@/lib/repositories/dinheiro-perdido.repo";

/**
 * O gancho do fim da importação e da sincronização do banco: acha as contas no histórico e
 * cadastra sozinho (Recorrentes › Contas). Roda depois da resposta; fora de uma requisição (o cron
 * do Open Finance), roda na hora. Nunca derruba quem chamou.
 */
export async function agendarContasDoHistorico(ctx: DonoDoPerfil): Promise<void> {
  try {
    after(() => acharEGravar(ctx));
  } catch {
    await acharEGravar(ctx);
  }
}

async function acharEGravar(ctx: DonoDoPerfil): Promise<void> {
  try {
    const { sincronizarContasDoHistorico } = await import("@/lib/repositories/contas-do-historico.repo");
    await sincronizarContasDoHistorico(ctx);
  } catch (err) {
    console.error("Contas do histórico: falhou (a importação segue)", err);
  }
}
