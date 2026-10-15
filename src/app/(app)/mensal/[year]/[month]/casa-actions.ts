"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { divisaoDaCasaNoMes, marcarEscolhasDoCasal, marcarSoMeu, regrasDaCasaDeQuemLanca } from "@/lib/repositories/casa.repo";
import { lerEscolhasDoFormulario, type DivisaoDaCasa } from "@/lib/casa/escolhas";

/**
 * "Só meu" no lançamento aberto (Casal simples, 13/10/2026): um toque e o gasto some do app do
 * par e dos totais dele. Só no que é de quem está logado (o filtro do repositório garante).
 */
export async function marcarSoMeuAction(id: string, soMeu: boolean): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const r = await marcarSoMeu(ctx, String(id), soMeu === true);
  if (!r) return { ok: false };
  revalidatePath(`/mensal/${r.year}/${r.month}`);
  revalidatePath("/mensal/periodo");
  revalidatePath("/mensal/foco", "layout");
  revalidatePath("/orcamento", "layout");
  return { ok: true };
}

/**
 * As três escolhas de um gasto meu já salvo (Casal simples, versão A de 15/10/2026): de quem é,
 * quem pagou e como divide. Muda o acerto dos dois, então revalida o Resumo e o acerto.
 */
export async function escolhasDoCasalAction(
  id: string,
  campos: { casaDeQuem: string; casaPagou: string; casaDivisao: string; casaParte: string },
): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const e = lerEscolhasDoFormulario({
    casaDeQuem: String(campos?.casaDeQuem ?? ""),
    casaPagou: String(campos?.casaPagou ?? ""),
    casaDivisao: String(campos?.casaDivisao ?? ""),
    casaParte: String(campos?.casaParte ?? ""),
  });
  if (!e) return { ok: false };
  const r = await marcarEscolhasDoCasal(ctx, String(id), e);
  if (!r) return { ok: false };
  revalidatePath(`/mensal/${r.year}/${r.month}`);
  revalidatePath("/mensal/periodo");
  revalidatePath("/mensal/foco", "layout");
  return { ok: true };
}

/**
 * O que o Digitar precisa no Casal simples: a regra da casa no mês (o "Pela renda 55/45") e o que
 * quem lança já ensinou de "Da casa" pela loja (o padrão de "De quem é?").
 */
export async function casalNoDigitarAction(ano: number, mes: number): Promise<{ divisao: DivisaoDaCasa; regras: [string, boolean][] } | null> {
  const ctx = await getRequiredSession();
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  const [divisao, regras] = await Promise.all([divisaoDaCasaNoMes(ctx, ano, mes), regrasDaCasaDeQuemLanca(ctx)]);
  if (!divisao) return null;
  return { divisao, regras };
}
