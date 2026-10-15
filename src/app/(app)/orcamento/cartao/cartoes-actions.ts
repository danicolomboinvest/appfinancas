"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { BANCOS_DO_CARTAO } from "@/lib/cartao/bancos";
import { apagarCartao, atualizarCartao, cartaoDoPerfil, criarCartao, listarCartoes, type CartaoGravado } from "@/lib/repositories/cartao.repo";

/** O cartão como o cliente recebe: o que o Digitar e o cadastro precisam. */
export type CartaoNaTela = Pick<CartaoGravado, "id" | "banco" | "apelido" | "diaFechamento" | "diaVencimento">;

const dia = z.number().int().min(1).max(31);
const cartaoSchema = z.object({
  banco: z.enum(BANCOS_DO_CARTAO.map((b) => b.slug) as [string, ...string[]]),
  apelido: z.string().trim().max(40).nullable().optional(),
  diaFechamento: dia,
  diaVencimento: dia,
  /** Os 4 últimos dígitos, quando o cadastro vem da fatura importada. */
  final: z.string().regex(/^\d{4}$/).nullable().optional(),
});

const naTela = (c: CartaoGravado): CartaoNaTela => ({ id: c.id, banco: c.banco, apelido: c.apelido, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento });

function revalidarCartao() {
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal", "layout");
}

/** Os cartões do perfil aberto (o Digitar pede ao abrir). */
export async function listarCartoesAction(): Promise<CartaoNaTela[]> {
  const ctx = await getRequiredSession();
  return (await listarCartoes(ctx)).map(naTela);
}

/** Cria (sem id) ou muda (com id) um cartão: banco, fechamento e vencimento. */
export async function salvarCartaoAction(dados: { id?: string | null; banco: string; apelido?: string | null; diaFechamento: number; diaVencimento: number; final?: string | null }): Promise<{ ok: true; cartao: CartaoNaTela } | { ok: false; error: string }> {
  const r = cartaoSchema.safeParse(dados);
  if (!r.success) return { ok: false, error: "Escolha o banco e os dois dias." };
  const ctx = await getRequiredSession();
  if (dados.id) {
    const ok = await atualizarCartao(ctx, dados.id, r.data);
    const cartao = ok ? await cartaoDoPerfil(ctx, dados.id) : null;
    if (!cartao) return { ok: false, error: "Não achei esse cartão." };
    revalidarCartao();
    return { ok: true, cartao: naTela(cartao) };
  }
  const cartao = await criarCartao(ctx, r.data);
  revalidarCartao();
  return { ok: true, cartao: naTela(cartao) };
}

/**
 * A fatura importada traz os dias e o cartão ainda não tem: ela tocou em "Guardar no cartão". Só
 * preenche o que falta; o dia que ela já escolheu não muda.
 */
export async function preencherDiasDoCartaoAction(id: string, dias: { diaFechamento?: number | null; diaVencimento?: number | null }): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const cartao = await cartaoDoPerfil(ctx, id);
  if (!cartao) return { ok: false };
  const novo: { diaFechamento?: number; diaVencimento?: number } = {};
  if (cartao.diaFechamento === null && dia.safeParse(dias.diaFechamento).success) novo.diaFechamento = dias.diaFechamento!;
  if (cartao.diaVencimento === null && dia.safeParse(dias.diaVencimento).success) novo.diaVencimento = dias.diaVencimento!;
  if (Object.keys(novo).length === 0) return { ok: false };
  const ok = await atualizarCartao(ctx, id, novo);
  if (ok) revalidarCartao();
  return { ok };
}

export async function apagarCartaoAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const ok = await apagarCartao(ctx, id);
  if (ok) revalidarCartao();
  return { ok };
}
