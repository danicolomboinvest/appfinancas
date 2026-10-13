"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { definirDivisaoDaCasa, marcarMesAcertado } from "@/lib/repositories/casa.repo";

function revalidar() {
  revalidatePath("/mensal/foco", "layout");
}

export async function definirDivisaoAction(divisao: "renda" | "meio"): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const ok = await definirDivisaoDaCasa(ctx, divisao === "meio" ? "meio" : "renda");
  revalidar();
  return { ok };
}

export async function marcarAcertadoAction(ano: number, mes: number, acertado: boolean): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return { ok: false };
  const ok = await marcarMesAcertado(ctx, ano, mes, acertado === true);
  revalidar();
  return { ok };
}
