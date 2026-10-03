"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { chaveDoMes } from "@/lib/casal/acerto";
import { lerConfigDoCasal, salvarConfigDoCasal } from "@/lib/repositories/casal.repo";

export type RespostaCasal = { ok: true } | { ok: false; mensagem: string };

/** Nomes das duas pessoas e a forma de dividir os gastos da casa. */
export async function salvarConfigCasalAction(dados: { nomeA: string; nomeB: string; divisao: "renda" | "meio" }): Promise<RespostaCasal> {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) return { ok: false, mensagem: "Isso é só do perfil Casal." };
  const nomeA = String(dados.nomeA ?? "").trim().slice(0, 30);
  const nomeB = String(dados.nomeB ?? "").trim().slice(0, 30);
  if (!nomeA || !nomeB) return { ok: false, mensagem: "Escreva o nome das duas pessoas." };
  const atual = await lerConfigDoCasal(ctx);
  await salvarConfigDoCasal(ctx, { ...atual, nomeA, nomeB, divisao: dados.divisao === "meio" ? "meio" : "renda" });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marca (ou desmarca) o acerto de um mês como feito. */
export async function marcarAcertoAction(ano: number, mes: number, acertado: boolean): Promise<RespostaCasal> {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) return { ok: false, mensagem: "Isso é só do perfil Casal." };
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return { ok: false, mensagem: "Mês inválido." };
  const atual = await lerConfigDoCasal(ctx);
  const chave = chaveDoMes(ano, mes);
  const acertos = acertado ? [...new Set([...atual.acertos, chave])] : atual.acertos.filter((c) => c !== chave);
  await salvarConfigDoCasal(ctx, { ...atual, acertos });
  revalidatePath("/", "layout");
  return { ok: true };
}
