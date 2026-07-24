"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { dismissRecapMonth } from "@/lib/repositories/user.repo";

/** Fecha o Resumo Mensal daquele mês: não aparece de novo (nem o card, nem a tela cheia)
 * até virar o mês seguinte. Chamado tanto pelo X do card pequeno quanto pelo fechar/Concluir
 * da experiência em tela cheia. */
export async function dismissMonthlyRecapAction(monthKey: string): Promise<void> {
  const ctx = await getRequiredSession();
  await dismissRecapMonth(ctx, monthKey);
  revalidatePath("/mensal/[year]/[month]", "page");
}
