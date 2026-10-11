"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { chaveDoMes, type ModoDaConta, type ModoDeDivisao } from "@/lib/casal/acerto";
import { lerConfigDoCasal, salvarConfigDoCasal } from "@/lib/repositories/casal.repo";

export type RespostaCasal = { ok: true } | { ok: false; mensagem: string };

/** Nomes das duas pessoas e a forma de dividir os gastos da casa. */
export async function salvarConfigCasalAction(dados: { nomeA: string; nomeB: string; divisao: ModoDeDivisao; pctA?: number }): Promise<RespostaCasal> {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) return { ok: false, mensagem: "Isso é só do perfil Casal." };
  // Login do par: nomes e forma de dividir são da titular (quem paga o Casal).
  if (ctx.par) return { ok: false, mensagem: "Quem muda os nomes e a divisão é quem paga o Casal." };
  const nomeA = String(dados.nomeA ?? "").trim().slice(0, 30);
  const nomeB = String(dados.nomeB ?? "").trim().slice(0, 30);
  if (!nomeA || !nomeB) return { ok: false, mensagem: "Escreva o nome das duas pessoas." };
  const atual = await lerConfigDoCasal(ctx);
  const divisao: ModoDeDivisao = dados.divisao === "meio" ? "meio" : dados.divisao === "combinado" ? "combinado" : "renda";
  const pct = Math.round(Number(dados.pctA));
  const pctA = divisao === "combinado" && pct >= 20 && pct <= 80 ? pct : atual.pctA;
  await salvarConfigDoCasal(ctx, { ...atual, nomeA, nomeB, divisao, ...(pctA ? { pctA } : {}) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Conta por conta: grava o jeito de algumas contas (null = volta para o jeito geral). Os dois
 * podem mudar (a proposta aprovada: "contas, quem cuida, acerto: vê e muda").
 */
export async function definirRegrasDasContasAction(mudancas: Record<string, ModoDaConta | null>): Promise<RespostaCasal> {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) return { ok: false, mensagem: "Isso é só do perfil Casal." };
  const atual = await lerConfigDoCasal(ctx);
  const regras = { ...(atual.regras ?? {}) };
  const entradas = Object.entries(mudancas ?? {}).slice(0, 200);
  for (const [chave, modo] of entradas) {
    if (typeof chave !== "string" || chave.length > 80) continue;
    if (modo === "renda" || modo === "meio" || modo === "um_paga") regras[chave] = modo;
    else delete regras[chave];
  }
  const { regras: _velhas, ...resto } = atual;
  void _velhas;
  await salvarConfigDoCasal(ctx, Object.keys(regras).length ? { ...resto, regras } : resto);
  revalidatePath("/divisao", "layout");
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
