import { prisma } from "@/lib/db/prisma";
import { brazilTodayUtc } from "@/lib/date/brazil-day";

/**
 * Grava o preço do dia de cada ticker (um por ticker por dia; o mesmo dia lido de novo só troca o
 * valor). Melhor esforço: o cron de cotações chama isto depois de atualizar a Carteira, e uma falha
 * aqui nunca pode desfazer as cotações já gravadas.
 */
export async function gravarPrecosDoDia(precos: Map<string, number | null>, fonte = "investidor10", hoje = brazilTodayUtc()): Promise<number> {
  const linhas = [...precos].filter((p): p is [string, number] => typeof p[1] === "number" && Number.isFinite(p[1]) && p[1] > 0);
  let gravados = 0;
  for (const [bruto, preco] of linhas) {
    const ticker = bruto.trim().toUpperCase();
    try {
      await prisma.precoDiario.upsert({
        where: { ticker_data: { ticker, data: hoje } },
        update: { preco, fonte },
        create: { ticker, data: hoje, preco, moeda: "BRL", fonte },
      });
      gravados += 1;
    } catch {
      // Um ticker que falhou não segura os outros.
    }
  }
  return gravados;
}

/** Quantos dias de preço o app já tem deste ticker (a linha de 12 meses só aparece com histórico). */
export async function diasDePreco(ticker: string): Promise<number> {
  return prisma.precoDiario.count({ where: { ticker: ticker.trim().toUpperCase() } });
}
